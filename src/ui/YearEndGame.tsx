import { useMemo, useState } from 'react'
import { finalReturn, man, yearEndAdjustment, yen } from '../engine'
import type { GameState, YearEndOutcome } from '../game/types'
import { rulesFor, yearOf } from '../game/state'
import { closeFirstYear, finishFinalReturn, finishYearEnd, premiumsPaid } from '../game/actions'
import { Modal, StepList } from './common'

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

export function YearEndGame({ s, apply }: { s: GameState; apply: Apply }) {
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
    apply((x) => finishYearEnd(x, outcome))
    setPhase('result')
  }

  if (phase === 'select')
    return (
      <section className="card" aria-labelledby="desk">
        <h2 id="desk">ステップ1:年末調整に出す書類を選ぼう</h2>
        <p className="note">机の上の書類から、会社に出すものをタップして選んでください(何枚でもOK)。</p>
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
        <div className="tool-row" style={{ marginTop: 16 }}>
          <button className="primary" onClick={() => setPhase('form')}>
            選んだ書類で申告書を書く
          </button>
          <button className="ghost" onClick={() => submit(false)}>
            めんどくさいから出さない
          </button>
        </div>
      </section>
    )

  if (phase === 'form')
    return (
      <section className="card" aria-labelledby="form">
        <h2 id="form">ステップ2:申告書に金額を書こう</h2>
        {!selected.has('life') && !selected.has('ideco') && <p>金額を書く証明書はありません。このまま提出できます。</p>}
        {selected.has('life') && p.lifeInsurance > 0 && (
          <fieldset style={{ border: 0, padding: 0 }}>
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
          <fieldset style={{ border: 0, padding: 0 }}>
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
        <div className="tool-row">
          <button className="primary" onClick={() => submit(true)} disabled={(selected.has('life') && p.lifeInsurance > 0 && lifeAmt === null) || (selected.has('ideco') && p.ideco > 0 && idecoAmt === null)}>
            会社に提出する
          </button>
          <button className="ghost" onClick={() => setPhase('select')}>書類を選び直す</button>
        </div>
      </section>
    )

  const o = s.yearEnd
  if (!o) return null
  const lost = o.bestRefund - o.refund
  const canFile = !o.submitted || lost > 0 || (s.flags.medicalExpenses ?? 0) > 0
  return (
    <section className="card" aria-labelledby="ye-result">
      <h2 id="ye-result">ステップ3:年末調整の結果</h2>
      {o.submitted ? (
        <>
          <p className={`callout ${o.refund >= 0 ? 'good' : 'bad'}`}>
            {o.refund >= 0 ? (
              <>12月の給与と一緒に <strong>{yen(o.refund)}</strong> が戻ってきた!(還付)</>
            ) : (
              <>12月の給与から <strong>{yen(-o.refund)}</strong> が追加で引かれた……(追徴)</>
            )}
          </p>
          <table>
            <tbody>
              <tr><td>毎月・賞与で天引きされた所得税の合計</td><td className="num">{yen(job.withheld)}</td></tr>
              <tr><td>年末調整で計算した正しい年税額</td><td className="num">{yen(o.annualTax)}</td></tr>
              <tr className="total"><td>差額</td><td className="num">{yen(o.refund)}</td></tr>
            </tbody>
          </table>
          <p className="note">
            1年目は4月入社なのに、毎月の天引きは「12か月働く」前提で計算されています。そのぶん引かれすぎになりやすく、年末調整で戻ってきやすいんです。
          </p>
          <p>書類のスコア:<strong>{o.score}点</strong></p>
        </>
      ) : (
        <p className="callout bad">年末調整を出さなかったので、天引きされた {yen(job.withheld)} がそのまま。控除が反映されず、本当は戻るはずの <strong>{yen(o.bestRefund)}</strong> が戻ってきていません。</p>
      )}
      {lost > 0 && o.submitted && (
        <p className="callout bad">もしも全部正しく出していたら、あと <strong>{yen(lost)}</strong> 多く戻ってきました。</p>
      )}
      {o.mistakes.length > 0 && (
        <>
          <h3>ゼイ吉のチェック</h3>
          <ul>{o.mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </>
      )}
      <div className="tool-row">
        {o.steps.length > 0 && <button onClick={() => setWhy(true)}>なぜ?(年税額の内訳)</button>}
        {canFile && (
          <button className="primary" onClick={() => apply((x) => ({ ...x, sceneId: 'finalReturn' }))}>
            確定申告で取り返す
          </button>
        )}
        <button className={canFile ? 'ghost' : 'primary'} onClick={() => apply((x) => ({ ...closeFirstYear(x), sceneId: 'summary' }))}>
          {canFile ? '確定申告はしないで、1年のまとめへ' : '1年のまとめへ'}
        </button>
      </div>
      {why && (
        <Modal title="年税額の計算" onClose={() => setWhy(false)}>
          <StepList steps={o.steps} />
          <p className="note">年税額 − 天引き済みの税額 = {yen(o.annualTax)} − {yen(job.withheld)} = {yen(-o.refund)}(マイナスなら還付)</p>
        </Modal>
      )}
    </section>
  )
}

export function FinalReturnView({ s, apply }: { s: GameState; apply: Apply }) {
  const job = s.job!
  const r = rulesFor(s, job.age)
  const p = premiumsPaid(s)
  const ye = s.yearEnd
  const alreadyPaid = ye?.annualTax ?? job.withheld
  const [inc, setInc] = useState({ life: true, quake: true, ideco: true, medical: true })
  const [done, setDone] = useState(!!s.finalReturn)
  const med = s.flags.medicalExpenses ?? 0
  const result = finalReturn(
    {
      grossTotal: job.grossTotal,
      socialInsurance: job.siTotal,
      dependents: [],
      lifeInsurance: inc.life && p.lifeInsurance ? { general: p.lifeInsurance, medical: 0, pension: 0 } : undefined,
      earthquakePremium: inc.quake && p.earthquake ? p.earthquake : undefined,
      ideco: inc.ideco && p.ideco ? p.ideco : undefined,
      medicalExpenses: inc.medical ? med : undefined,
      alreadyPaid,
    },
    r,
  )
  const medDed = result.tax.deductions.find((d) => d.key === 'medical')?.amount ?? 0

  const items: { key: keyof typeof inc; label: string; amount: number }[] = [
    { key: 'life', label: '生命保険料控除(支払額)', amount: p.lifeInsurance },
    { key: 'quake', label: '地震保険料控除(支払額)', amount: p.earthquake },
    { key: 'ideco', label: '小規模企業共済等掛金控除(iDeCo)', amount: p.ideco },
    { key: 'medical', label: '医療費控除(支払った医療費)', amount: med },
  ]

  if (done && s.finalReturn) {
    const fr = s.finalReturn
    return (
      <section className="card">
        <h2>申告完了!</h2>
        <p className={`callout ${fr.refund > 0 ? 'good' : ''}`}>
          {fr.refund > 0 ? <>約1か月後、銀行口座に <strong>{yen(fr.refund)}</strong> が振り込まれます(還付金)。</> : <>今回は戻ってくるお金はありませんでした。</>}
        </p>
        {fr.medicalDeduction === 0 && med > 0 && (
          <p className="note">医療費が{man(med)}で、10万円を超えていないので医療費控除は0円でした。</p>
        )}
        <p className="note">確定申告の内容は、税務署から市区町村に送られ、来年の住民税にも反映されます。</p>
        <button className="primary" onClick={() => apply((x) => ({ ...closeFirstYear(x), sceneId: 'summary' }))}>
          1年のまとめへ
        </button>
      </section>
    )
  }

  return (
    <section className="card" aria-labelledby="etax">
      <h2 id="etax">確定申告書(e-Tax風)令和{yearOf(s, job.age) - 2018}年分</h2>
      <h3>源泉徴収票の内容(会社からもらった)</h3>
      <table>
        <tbody>
          <tr><td>支払金額</td><td className="num">{yen(job.grossTotal)}</td></tr>
          <tr><td>社会保険料等の金額</td><td className="num">{yen(job.siTotal)}</td></tr>
          <tr><td>源泉徴収税額(年末調整後)</td><td className="num">{yen(alreadyPaid)}</td></tr>
        </tbody>
      </table>
      <h3 style={{ marginTop: 16 }}>申告する控除を選ぶ</h3>
      {items.filter((i) => i.amount > 0).map((i) => (
        <label key={i.key} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
          <input type="checkbox" checked={inc[i.key]} onChange={(e) => setInc({ ...inc, [i.key]: e.target.checked })} />
          {i.label}:{yen(i.amount)}
        </label>
      ))}
      <StepList steps={result.tax.steps} />
      <p className="callout">
        還付される金額(見込み):<strong>{yen(Math.max(0, result.refund))}</strong>
      </p>
      <button
        className="primary"
        onClick={() => {
          apply((x) => finishFinalReturn(x, { refund: Math.max(0, result.refund), medicalDeduction: medDed, steps: result.tax.steps }))
          setDone(true)
        }}
      >
        送信する
      </button>
    </section>
  )
}
