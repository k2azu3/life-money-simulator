import { useMemo, useState } from 'react'
import { finalReturn, man, yearEndAdjustment, yen } from '../engine'
import type { GameState, YearEndOutcome } from '../game/types'
import { addGauges, recordMission, rulesFor, yearOf } from '../game/state'
import { closeFirstYear, finishFinalReturn, finishYearEnd, premiumsPaid } from '../game/actions'
import { MISSIONS } from '../content/missions'
import { Modal, StepList } from './common'
import { HintBox, MissionCleared, MissionHeader } from './MissionCard'

type Apply = (f: (s: GameState) => GameState) => void

interface Doc {
  id: string
  icon: string
  name: string
  desc: string
  /** 年末調整に出すべきか */
  correct: boolean
  /** 選んだ/選ばなかったときの解説 */
  why: string
}

function buildDocs(s: GameState): Doc[] {
  const p = premiumsPaid(s)
  const docs: Doc[] = [
    {
      id: 'fuyo',
      icon: '📝',
      name: '扶養控除等(異動)申告書(来年分)',
      desc: '扶養する家族がいなくても、毎年会社に出す書類',
      correct: true,
      why: '扶養する家族がいなくても毎年出します。これがないと毎月の所得税が高い「乙欄」で天引きされてしまいます。',
    },
    {
      id: 'kiso',
      icon: '📝',
      name: '基礎控除申告書 兼 配偶者控除等申告書 兼 …',
      desc: '今年の所得の見込みを書く申告書',
      correct: true,
      why: '基礎控除(令和8年分は最大104万円)を年末調整で受けるための申告書です。',
    },
  ]
  if (s.flags.lifeInsurance)
    docs.push({
      id: 'life',
      icon: '🛡️',
      name: '生命保険料控除証明書',
      desc: '10月ごろ保険会社からハガキで届いた',
      correct: true,
      why: `払った保険料(${yen(p.lifeInsurance)})に応じて生命保険料控除が受けられます。`,
    })
  if (s.flags.earthquake)
    docs.push({
      id: 'quake',
      icon: '🏠',
      name: '地震保険料控除証明書',
      desc: '損害保険会社から届いた',
      correct: true,
      why: `地震保険料(${yen(p.earthquake)})は全額が地震保険料控除になります(上限5万円)。`,
    })
  if (p.ideco > 0)
    docs.push({
      id: 'ideco',
      icon: '🌱',
      name: '小規模企業共済等掛金払込証明書',
      desc: '国民年金基金連合会から届いた(iDeCo)',
      correct: true,
      why: `iDeCoの掛金(${yen(p.ideco)})は全額が所得控除になります。`,
    })
  docs.push(
    {
      id: 'medical',
      icon: '🏥',
      name: '病院・薬局の領収書の束',
      desc: `今年の医療費 合計${yen(s.flags.medicalExpenses ?? 0)}`,
      correct: false,
      why: '医療費控除は年末調整では受けられません。確定申告で申告します。',
    },
    {
      id: 'payslip',
      icon: '📄',
      name: '11月の給与明細',
      desc: '会社からもらったもの',
      correct: false,
      why: '給与の情報は会社がすでに持っているので、出す必要はありません。',
    },
    {
      id: 'friend',
      icon: '🤫',
      name: '友だちの生命保険料控除証明書',
      desc: '「貸したるで。控除が増えるかもよ」',
      correct: false,
      why: '他人の証明書で控除を受けるのは不正や。バレたら追加の税金まで取られるで。',
    },
    {
      id: 'receipt',
      icon: '🧾',
      name: 'スーパーのレシート',
      desc: '食費は節約したい……',
      correct: false,
      why: '会社員の生活費は経費になりません(会社員の経費は「給与所得控除」としてまとめて引かれています)。',
    },
  )
  return docs
}

const FRAUD_PENALTY = { toku: -20 }

export function YearEndGame({ s, apply, onOpenCard }: { s: GameState; apply: Apply; onOpenCard: (id: string) => void }) {
  const m = MISSIONS.yearEnd
  const [tries, setTries] = useState(0)
  const [hintUsed, setHintUsed] = useState(false)
  const docs = useMemo(() => buildDocs(s), [s])
  const p = premiumsPaid(s)
  const job = s.job!
  const r = rulesFor(s, job.age)
  const [phase, setPhase] = useState<'select' | 'form' | 'result'>(s.yearEnd ? 'result' : 'select')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lifeAmt, setLifeAmt] = useState<number | null>(null)
  const [idecoAmt, setIdecoAmt] = useState<number | null>(null)
  const [why, setWhy] = useState(false)

  const toggle = (id: string) => {
    const n = new Set(selected)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setSelected(n)
  }

  const idecoPaidSoFar = (s.flags.idecoMonthly ?? 0) * (10 - job.startMonth + 1)

  const best = yearEndAdjustment(
    job.grossTotal,
    job.siTotal,
    job.withheld,
    {
      dependents: [],
      lifeInsurance: p.lifeInsurance ? { general: p.lifeInsurance, medical: 0, pension: 0 } : undefined,
      earthquakePremium: p.earthquake || undefined,
      ideco: p.ideco || undefined,
    },
    r,
  )

  const submit = (submitted: boolean) => {
    setTries(tries + 1)
    const mistakes: string[] = []
    let correctCount = 0
    for (const d of docs) {
      const picked = selected.has(d.id)
      if (picked === d.correct) correctCount++
      else mistakes.push(`${picked ? '出さなくてよい' : '出し忘れ'}:${d.name} ― ${d.why}`)
    }
    const declared: YearEndOutcome['declared'] = {}
    if (selected.has('life') && p.lifeInsurance) {
      const v = lifeAmt ?? p.lifeInsuranceAsOfSeptember
      if (v !== p.lifeInsurance) mistakes.push(`生命保険料の金額:証明書の「証明額(9月末時点)」ではなく「申告額(12月末までの見込み)」${yen(p.lifeInsurance)}を書きます。`)
      declared.lifeInsurance = { general: v, medical: 0, pension: 0 }
    }
    if (selected.has('quake') && p.earthquake) declared.earthquakePremium = p.earthquake
    if (selected.has('ideco') && p.ideco) {
      const v = idecoAmt ?? idecoPaidSoFar
      if (v !== p.ideco) mistakes.push(`iDeCoの金額:払い込み済みの額だけでなく、12月までの予定額を含めた合計${yen(p.ideco)}を書きます。`)
      declared.ideco = v
    }
    const amountMistakes = mistakes.filter((m) => m.includes('の金額:')).length
    const score = Math.max(0, Math.round((correctCount / docs.length) * 100) - amountMistakes * 10)

    let outcome: YearEndOutcome
    if (!submitted) {
      outcome = {
        submitted: false,
        declared: {},
        annualTax: job.withheld,
        refund: 0,
        bestRefund: best.refund,
        score: 0,
        mistakes: ['年末調整の書類を出さなかったので、控除が反映されていません。'],
        steps: [],
      }
    } else {
      const ye = yearEndAdjustment(job.grossTotal, job.siTotal, job.withheld, { dependents: [], ...declared }, r)
      outcome = {
        submitted: true,
        declared,
        annualTax: ye.tax.tax,
        refund: ye.refund,
        bestRefund: best.refund,
        score,
        mistakes,
        steps: ye.tax.steps,
      }
    }
    const fraud = submitted && selected.has('friend')
    const cleared = submitted && !fraud && outcome.refund >= outcome.bestRefund
    apply((x) => {
      let y = finishYearEnd(x, outcome)
      if (fraud) {
        // ズルをした年は、年末調整のバッジはもらえない
        y = addGauges({ ...y, badges: y.badges.filter((b) => x.badges.includes(b)) }, FRAUD_PENALTY)
      }
      if (cleared) y = addGauges(recordMission(y, m.id, { cleared: true, tries: tries + 1, hintUsed, card: m.card }), m.reward)
      return y
    })
    setPhase('result')
  }

  /** 失敗のまま先へ進む(星0) */
  const giveUp = (x: GameState) => (x.missions[m.id] ? x : recordMission(x, m.id, { cleared: false, tries, hintUsed, card: m.card }))

  const retry = () => {
    setSelected(new Set())
    setLifeAmt(null)
    setIdecoAmt(null)
    setPhase('select')
  }

  const header = (
    <>
      <MissionHeader m={m} tries={tries} hintUsed={hintUsed} />
      <HintBox m={m} used={hintUsed} onUse={() => setHintUsed(true)} onOpenCard={onOpenCard} />
    </>
  )

  if (phase === 'select')
    return (
      <section className="mission" aria-labelledby="desk">
        {header}
        <h3 id="desk" className="step-title"><span className="step-no">1</span>出す書類を選ぶ</h3>
        <p className="note">机の上から、会社に出すものをタップ(何枚でもOK)。</p>
        <div className="desk">
          {docs.map((d) => (
            <button key={d.id} className="doc-card" aria-pressed={selected.has(d.id)} onClick={() => toggle(d.id)}>
              <span className="doc-icon" aria-hidden="true">{d.icon}</span>
              <strong>{d.name}</strong>
              <span className="note">{d.desc}</span>
              <span className="doc-check" />
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="primary" onClick={() => setPhase('form')}>
            選んだ書類で申告書を書く
          </button>
          <button className="tertiary" onClick={() => submit(false)}>
            めんどくさいから出さない
          </button>
        </div>
      </section>
    )

  if (phase === 'form')
    return (
      <section className="mission" aria-labelledby="form">
        {header}
        <h3 id="form" className="step-title"><span className="step-no">2</span>申告書に金額を書く</h3>
        {!selected.has('life') && !selected.has('ideco') && <p>金額を書く証明書はありません。このまま提出できます。</p>}
        {selected.has('life') && p.lifeInsurance > 0 && (
          <fieldset className="q-group">
            <legend><strong>生命保険料控除証明書</strong></legend>
            <div className="certificate" aria-label="証明書の内容">
              ◯◯生命 一般生命保険料(新制度)<br />
              証明額(令和{yearOf(s, job.age) - 2018}年9月末現在):{yen(p.lifeInsuranceAsOfSeptember)}<br />
              申告額(令和{yearOf(s, job.age) - 2018}年12月末までの見込み):{yen(p.lifeInsurance)}
            </div>
            <p>申告書の「一般の生命保険料」の欄に書く金額は?</p>
            <div className="radio-row">
              {[p.lifeInsuranceAsOfSeptember, p.lifeInsurance].map((v) => (
                <label key={v}><input type="radio" name="lifeAmt" checked={lifeAmt === v} onChange={() => setLifeAmt(v)} />{yen(v)}</label>
              ))}
            </div>
          </fieldset>
        )}
        {selected.has('ideco') && p.ideco > 0 && (
          <fieldset className="q-group">
            <legend><strong>小規模企業共済等掛金払込証明書</strong></legend>
            <div className="certificate" aria-label="証明書の内容">
              個人型年金加入者掛金<br />
              払込済(4月〜10月):{yen(idecoPaidSoFar)}<br />
              払込予定(11月〜12月):{yen(p.ideco - idecoPaidSoFar)}<br />
              合計(年間):{yen(p.ideco)}
            </div>
            <p>申告書の「個人型年金加入者掛金」の欄に書く金額は?</p>
            <div className="radio-row">
              {[idecoPaidSoFar, p.ideco].map((v) => (
                <label key={v}><input type="radio" name="idecoAmt" checked={idecoAmt === v} onChange={() => setIdecoAmt(v)} />{yen(v)}</label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="actions">
          <button className="primary" onClick={() => submit(true)} disabled={(selected.has('life') && p.lifeInsurance > 0 && lifeAmt === null) || (selected.has('ideco') && p.ideco > 0 && idecoAmt === null)}>
            会社に提出する
          </button>
          <button className="tertiary" onClick={() => setPhase('select')}>書類を選び直す</button>
        </div>
      </section>
    )

  const o = s.yearEnd
  if (!o) return null
  const lost = o.bestRefund - o.refund
  const canFile = !o.submitted || lost > 0 || (s.flags.medicalExpenses ?? 0) > 0
  const cleared = !!s.missions[m.id] && s.missions[m.id].stars > 0
  const result = (
    <>
      {o.submitted ? (
        <>
          <p className={`banner ${o.refund >= 0 ? 'success' : 'error'}`}>
            {o.refund >= 0 ? (
              <>12月の給料と一緒に <strong>{yen(o.refund)}</strong> 戻ってきた!(還付)</>
            ) : (
              <>12月の給料から <strong>{yen(-o.refund)}</strong> 追加で引かれた……(追徴)</>
            )}
          </p>
          <table>
            <tbody>
              <tr><td>1年間に天引きされた所得税</td><td className="num">{yen(job.withheld)}</td></tr>
              <tr><td>正しい年税額</td><td className="num">{yen(o.annualTax)}</td></tr>
              <tr className="total"><td>戻ってきたお金</td><td className="num">{yen(o.refund)}</td></tr>
            </tbody>
          </table>
        </>
      ) : (
        <p className="banner error">年末調整を出さなかったので、戻るはずの <strong>{yen(o.bestRefund)}</strong> が戻ってきていません。</p>
      )}
      {lost > 0 && o.submitted && (
        <p className="banner error">全部正しく出していたら、あと <strong>{yen(lost)}</strong> 戻ってきました。</p>
      )}
      {o.mistakes.length > 0 && (
        <>
          <h3>ゼイ吉のチェック</h3>
          <ul className="checklist">{o.mistakes.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </>
      )}
    </>
  )
  const next = (
    <div className="actions">
      {canFile && (
        <button className={cleared ? 'secondary' : 'primary'} onClick={() => apply((x) => ({ ...giveUp(x), sceneId: 'finalReturn' }))}>
          確定申告で取り返す
        </button>
      )}
      <button className={canFile ? 'tertiary' : 'primary'} onClick={() => apply((x) => ({ ...closeFirstYear(giveUp(x)), sceneId: 'summary' }))}>
        {canFile ? '確定申告はしないで、1年のまとめへ' : '1年のまとめへ'}
      </button>
      {o.steps.length > 0 && <button className="tertiary" onClick={() => setWhy(true)}>🔍 年税額の内訳</button>}
    </div>
  )
  return (
    <>
      {cleared ? (
        <MissionCleared m={m} s={s} message="満額取り戻したで!証明書の金額の読み方も完ぺきや。">
          {result}
          {next}
        </MissionCleared>
      ) : (
        <section className="mission" aria-labelledby="ye-result">
          {s.missions[m.id] ? (
            <MissionCleared m={m} s={s} />
          ) : (
            <MissionHeader m={m} tries={tries} hintUsed={hintUsed} />
          )}
          <h3 id="ye-result" className="step-title"><span className="step-no">3</span>結果</h3>
          {result}
          {!s.missions[m.id] && (
            <div className="banner warn">
              <strong>ミッション失敗……</strong> 書類を選び直して、もう一度挑戦できるで。
              <div className="actions">
                <button className="primary" onClick={retry}>やり直す</button>
              </div>
            </div>
          )}
          {next}
        </section>
      )}
      {why && (
        <Modal title="年税額の計算" onClose={() => setWhy(false)}>
          <StepList steps={o.steps} />
          <p className="note">年税額 − 天引き済みの税額 = {yen(o.annualTax)} − {yen(job.withheld)} = {yen(-o.refund)}(マイナスなら還付)</p>
        </Modal>
      )}
    </>
  )
}

export function FinalReturnView({ s, apply, onOpenCard }: { s: GameState; apply: Apply; onOpenCard: (id: string) => void }) {
  const m = MISSIONS.kakutei
  const job = s.job!
  const r = rulesFor(s, job.age)
  const p = premiumsPaid(s)
  const ye = s.yearEnd
  const alreadyPaid = ye?.annualTax ?? job.withheld
  const med = s.flags.medicalExpenses ?? 0
  const receipts = !!s.flags.keptReceipts
  const [inc, setInc] = useState({ life: false, quake: false, ideco: false, medical: false, travel: false })
  const [tries, setTries] = useState(0)
  const [hintUsed, setHintUsed] = useState(false)
  const [sent, setSent] = useState<{ refund: number; fraud: boolean; best: number } | null>(null)
  const [why, setWhy] = useState(false)

  // 年末調整で申告ずみの控除は、確定申告でも同じ金額を書く(書かないと税額が増える)
  const calc = (o: { life: boolean; quake: boolean; ideco: boolean; medical: boolean; medicalExtra?: number }) =>
    finalReturn(
      {
        grossTotal: job.grossTotal,
        socialInsurance: job.siTotal,
        dependents: [],
        lifeInsurance: o.life && p.lifeInsurance ? { general: p.lifeInsurance, medical: 0, pension: 0 } : undefined,
        earthquakePremium: o.quake && p.earthquake ? p.earthquake : undefined,
        ideco: o.ideco && p.ideco ? p.ideco : undefined,
        medicalExpenses: o.medical ? med + (o.medicalExtra ?? 0) : undefined,
        alreadyPaid,
      },
      r,
    )
  /** 本当に受けられる最大の還付(領収書があれば医療費も) */
  const best = Math.max(0, calc({ life: true, quake: true, ideco: true, medical: true }).refund)
  /** 今の自分が受けられる最大(領収書を捨てていたら医療費控除は使えない) */
  const reachable = Math.max(0, calc({ life: true, quake: true, ideco: true, medical: receipts }).refund)
  const TRAVEL = 200_000

  const items: { key: 'life' | 'quake' | 'ideco' | 'medical'; label: string; amount: number; disabled?: string }[] = [
    { key: 'life', label: '生命保険料控除', amount: p.lifeInsurance },
    { key: 'quake', label: '地震保険料控除', amount: p.earthquake },
    { key: 'ideco', label: '小規模企業共済等掛金控除(iDeCo)', amount: p.ideco },
    {
      key: 'medical',
      label: '医療費控除(1年間の医療費)',
      amount: med,
      disabled: receipts ? undefined : '6月に領収書を捨ててしまったので、申告できない……',
    },
  ]

  const submit = () => {
    const n = tries + 1
    setTries(n)
    const fraud = inc.travel
    // ウソの申告は、あとで税務署に見つかって正しい金額に直される
    const honest = calc({ ...inc, medical: inc.medical && receipts })
    const refund = Math.max(0, honest.refund)
    const cleared = !fraud && refund >= best
    const medDed = honest.tax.deductions.find((d) => d.key === 'medical')?.amount ?? 0
    setSent({ refund, fraud, best })
    apply((x) => {
      let y = finishFinalReturn(x, { refund, medicalDeduction: medDed, steps: honest.tax.steps })
      if (fraud) y = addGauges({ ...y, badges: y.badges.filter((b) => x.badges.includes(b) || b === 'kakuteiDebut') }, { toku: -20, money: -10 })
      if (cleared) y = addGauges(recordMission(y, m.id, { cleared: true, tries: n, hintUsed, card: m.card }), m.reward)
      return y
    })
  }

  const giveUp = (x: GameState) => (x.missions[m.id] ? x : recordMission(x, m.id, { cleared: false, tries, hintUsed, card: m.card }))
  const toSummary = (
    <div className="actions">
      <button className="primary" onClick={() => apply((x) => ({ ...closeFirstYear(giveUp(x)), sceneId: 'summary' }))}>
        1年のまとめへ
      </button>
      {s.finalReturn && <button className="tertiary" onClick={() => setWhy(true)}>🔍 税額の内訳</button>}
    </div>
  )
  const whyModal = why && s.finalReturn && (
    <Modal title="確定申告の計算" onClose={() => setWhy(false)}>
      <StepList steps={s.finalReturn.steps} />
    </Modal>
  )

  if (sent && s.finalReturn) {
    const fr = s.finalReturn
    const cleared = !!s.missions[m.id] && s.missions[m.id].stars > 0
    const body = (
      <>
        {sent.fraud && (
          <p className="banner error">
            <strong>税務署から連絡が来た!</strong> 旅行代は医療費やない。ウソの分は取り消され、罰の税金(加算税)も払うことに。🙏徳と💰お金が下がった。
          </p>
        )}
        <p className={`banner ${fr.refund > 0 ? 'success' : 'info'}`}>
          {fr.refund > 0 ? <>約1か月後、口座に <strong>{yen(fr.refund)}</strong> が振り込まれる(還付金)。</> : <>今回は戻ってくるお金はなかった。</>}
        </p>
        {fr.medicalDeduction === 0 && med > 0 && receipts && inc.medical && (
          <p className="note">医療費が{man(med)}で10万円を超えていないので、医療費控除は0円。</p>
        )}
      </>
    )
    if (cleared)
      return (
        <>
          <MissionCleared m={m} s={s} message="取りこぼしゼロ!確定申告デビューおめでとさん。">
            {body}
            {toSummary}
          </MissionCleared>
          {whyModal}
        </>
      )
    const unreachable = reachable < best
    return (
      <section className="mission">
        <MissionHeader m={m} tries={tries} hintUsed={hintUsed} />
        {body}
        <div className="banner warn">
          <strong>ミッション失敗……</strong>
          {unreachable ? (
            <> 領収書がないと医療費控除は使えへん。あと{yen(best - fr.refund)}戻るはずやった。6月の選択が響いたな……</>
          ) : (
            <> まだ取り返せるお金が残っとるで。申告をやり直せる。</>
          )}
          {!unreachable && (
            <div className="actions">
              <button
                className="primary"
                onClick={() => {
                  setSent(null)
                  setInc({ life: false, quake: false, ideco: false, medical: false, travel: false })
                }}
              >
                申告をやり直す
              </button>
            </div>
          )}
        </div>
        {toSummary}
        {whyModal}
      </section>
    )
  }

  return (
    <section className="mission etax" aria-labelledby="etax">
      <MissionHeader m={m} tries={tries} hintUsed={hintUsed} />
      <HintBox m={m} used={hintUsed} onUse={() => setHintUsed(true)} onOpenCard={onOpenCard} />
      <h3 id="etax" className="step-title">確定申告書(e-Tax風)令和{yearOf(s, job.age) - 2018}年分</h3>
      <h4>源泉徴収票(会社からもらった)</h4>
      <table>
        <tbody>
          <tr><td>支払金額</td><td className="num">{yen(job.grossTotal)}</td></tr>
          <tr><td>社会保険料等の金額</td><td className="num">{yen(job.siTotal)}</td></tr>
          <tr><td>源泉徴収税額(年末調整後)</td><td className="num">{yen(alreadyPaid)}</td></tr>
        </tbody>
      </table>
      <h4>申告する控除を選ぶ</h4>
      <div className="check-list">
        {items.filter((i) => i.amount > 0).map((i) => (
          <label key={i.key} className={`check ${i.disabled ? 'is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={inc[i.key] && !i.disabled}
              disabled={!!i.disabled}
              onChange={(e) => setInc({ ...inc, [i.key]: e.target.checked })}
            />
            <span>
              {i.label}:{yen(i.amount)}
              {i.disabled && <span className="check-note">{i.disabled}</span>}
            </span>
          </label>
        ))}
        {med > 0 && receipts && (
          <label className="check temptation">
            <input type="checkbox" checked={inc.travel} onChange={(e) => setInc({ ...inc, travel: e.target.checked })} />
            <span>
              家族旅行の費用{yen(TRAVEL)}も医療費に入れちゃう?
              <span className="check-note">「旅行でリフレッシュしたし、健康のためやろ?」</span>
            </span>
          </label>
        )}
      </div>
      <div className="actions">
        <button className="primary" onClick={submit}>
          送信する
        </button>
      </div>
    </section>
  )
}
