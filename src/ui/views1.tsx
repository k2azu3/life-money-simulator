import { useState } from 'react'
import {
  computeIncomeTax,
  healthStandardMonthly,
  man,
  monthlySocialInsurance,
  pensionStandardMonthly,
  yen,
} from '../engine'
import type { GameState } from '../game/types'
import { rulesFor } from '../game/state'
import { addGauges } from '../game/state'
import type { GaugeDelta } from '../game/types'
import {
  chooseFirstYearOptions,
  COMPANIES_HIGHSCHOOL,
  COMPANIES_UNIV,
  EARTHQUAKE_PREMIUM,
  LIFE_INSURANCE_MONTHLY,
  startJob,
} from '../game/actions'
import { EffectChips, Modal, StepList } from './common'

type Apply = (f: (s: GameState) => GameState) => void

/** 安定の会社はしあわせ、勢いのある会社はお金が少し上がる */
const COMPANY_EFFECT: Record<string, GaugeDelta> = {
  shoji: { happy: 6 },
  factory: { happy: 6 },
  venture: { money: 3, happy: 2 },
  shop: { money: 3 },
}

export function CompanyView({ s, apply }: { s: GameState; apply: Apply }) {
  const list = s.flags.path === 'work' ? COMPANIES_HIGHSCHOOL : COMPANIES_UNIV
  return (
    <div className="option-grid">
      {list.map((c) => {
        const firstYear = c.monthly * 9 + c.bonuses.reduce((a, b) => a + b.amount, 0)
        return (
          <button key={c.id} className="option-card" onClick={() => apply((x) => ({ ...addGauges(startJob(x, c), COMPANY_EFFECT[c.id]), sceneId: 'payslip' }))}>
            <span className="option-card-head">
              <strong>{c.name}</strong>
              <EffectChips d={COMPANY_EFFECT[c.id]} />
            </span>
            <span className="option-card-blurb">{c.blurb}</span>
            <dl>
              <dt>月給(額面)</dt><dd>{yen(c.monthly)}</dd>
              <dt>1年目の額面(4〜12月)</dt><dd>{man(firstYear)}</dd>
              <dt>2年目以降の年収の目安</dt><dd>{man(c.monthly * 12 + c.bonuses.reduce((a, b) => a + b.amount, 0) * (c.bonuses.length ? 2 : 0))}</dd>
            </dl>
          </button>
        )
      })}
    </div>
  )
}

const ROW_HELP: Record<string, string> = {
  health: '病院代を3割負担にしてくれる保険。会社も同じ額を払っている。',
  childSupport: '2026年度に始まった、社会全体で子育てを支えるお金。',
  pension: '老後の年金のための保険料。会社も同じ額を払っている。',
  employment: '失業したときや育休のときの給付のための保険料。',
  incomeTax: '毎月は「だいたい」の額。12月の年末調整で正しくなる。',
  residentTax: '去年の所得にかかる税金。1年目はほぼ0円。',
}

export function PayslipView({ s, apply }: { s: GameState; apply: Apply }) {
  const [help, setHelp] = useState<string | null>(null)
  const [why, setWhy] = useState(false)
  const job = s.job
  if (!job) return null
  const p = job.payslips[0]
  const r = rulesFor(s, job.age)
  const rows: [string, string, number][] = [
    ['health', '健康保険料', p.si.health],
    ['childSupport', '子ども・子育て支援金', p.si.childSupport],
    ['pension', '厚生年金保険料', p.si.pension],
    ['employment', '雇用保険料', p.si.employment],
    ['incomeTax', '所得税(源泉徴収)', p.incomeTax],
    ['residentTax', '住民税', p.residentTax],
  ]
  const totalDeduct = p.gross - p.net
  const hStd = healthStandardMonthly(p.gross, r)
  const pStd = pensionStandardMonthly(p.gross, r)
  const si = monthlySocialInsurance(p.gross, job.age, r)
  const annualized = computeIncomeTax({ salaryGross: p.gross * 12, socialInsurance: si.total * 12 }, r)

  return (
    <>
      <section className="card" aria-labelledby="payslip-title">
        <h2 id="payslip-title">給与明細 {job.company.name} 4月分</h2>
        <div className="payslip">
          <div>
            <h3>支給</h3>
            <div className="payslip-row"><span>基本給</span><span className="amt">{yen(p.gross)}</span></div>
            <div className="payslip-row"><span><strong>総支給額(額面)</strong></span><span className="amt">{yen(p.gross)}</span></div>
          </div>
          <div>
            <h3>控除(天引き)</h3>
            {rows.map(([k, label, v]) => (
              <div key={k}>
                <div className="payslip-row">
                  <span>
                    {label}{' '}
                    <button className="tertiary small" aria-expanded={help === k} onClick={() => setHelp(help === k ? null : k)}>
                      これは?
                    </button>
                  </span>
                  <span className="amt">{yen(v)}</span>
                </div>
                {help === k && <p className="note callout">{ROW_HELP[k]}</p>}
              </div>
            ))}
            <div className="payslip-row"><span><strong>控除合計</strong></span><span className="amt minus">−{yen(totalDeduct)}</span></div>
          </div>
        </div>
        <p className="net-box">差引支給額(手取り):{yen(p.net)}</p>
        <p className="note">額面の {((p.net / p.gross) * 100).toFixed(1)}% が手取りになりました。</p>
        <div className="tool-row">
          <button className="tertiary" onClick={() => setWhy(true)}>🔍 計算の内訳を見る</button>
        </div>
      </section>
      <div className="actions">
        <button className="primary" onClick={() => apply((x) => ({ ...x, sceneId: 'firstYearChoices' }))}>
          5月へ進む
        </button>
      </div>
      {why && (
        <Modal title="なぜこの金額?" onClose={() => setWhy(false)}>
          <h3>社会保険料</h3>
          <StepList
            steps={[
              { label: '月給', value: p.gross },
              { label: '標準報酬月額(健康保険)', formula: '月給を等級表にあてはめた金額', value: hStd },
              { label: '健康保険料', formula: `${yen(hStd)} × ${(r.socialInsurance.healthRate * 100).toFixed(2)}% ÷ 2(会社と折半)`, value: p.si.health },
              { label: '子ども・子育て支援金', formula: `${yen(hStd)} × ${(r.socialInsurance.childSupportRate * 100).toFixed(2)}% ÷ 2`, value: p.si.childSupport },
              { label: '標準報酬月額(厚生年金)', value: pStd },
              { label: '厚生年金保険料', formula: `${yen(pStd)} × ${(r.socialInsurance.pensionRate * 100).toFixed(1)}% ÷ 2`, value: p.si.pension },
              { label: '雇用保険料', formula: `${yen(p.gross)} × ${(r.socialInsurance.employmentEmployeeRate * 100).toFixed(1)}%`, value: p.si.employment },
            ]}
          />
          <h3>毎月の所得税(このゲームの計算方法)</h3>
          <p className="note">「この月給が12か月続いたら年税額はいくら?」を計算して12で割っています。</p>
          <StepList steps={annualized.steps} />
          <StepList steps={[{ label: '÷ 12(10円未満切り捨て)', value: p.incomeTax }]} />
          <div className="simplified">
            <strong>簡略化しています:</strong>実際は国税庁の「源泉徴収税額表」で決まります。また、社会保険料は翌月の給与から引く会社が多いですが、ここでは当月の給与から引いています。
          </div>
        </Modal>
      )}
    </>
  )
}

export function FirstYearChoicesView({ s, apply }: { s: GameState; apply: Apply }) {
  const r = rulesFor(s, s.job?.age ?? 22)
  const [life, setLife] = useState(true)
  const [quake, setQuake] = useState(true)
  const [ideco, setIdeco] = useState(5000)
  const limit = r.incomeTax.ideco.employeeNoCorporatePensionMonthlyLimit
  // 保険は安心(しあわせ)、iDeCoは将来のお金
  const effect: GaugeDelta = { happy: (life ? 4 : 0) + (quake ? 3 : 0), money: ideco > 0 ? 3 : 0 }
  return (
    <section className="card">
      <fieldset className="q-group">
        <legend><strong>① 医療保険(生命保険の一種)に入る?</strong> 月{LIFE_INSURANCE_MONTHLY.toLocaleString()}円</legend>
        <div className="radio-row">
          <label><input type="radio" name="life" checked={life} onChange={() => setLife(true)} />入る</label>
          <label><input type="radio" name="life" checked={!life} onChange={() => setLife(false)} />入らない</label>
        </div>
      </fieldset>
      <fieldset className="q-group">
        <legend><strong>② 賃貸の火災保険に地震保険をつける?</strong> 年{EARTHQUAKE_PREMIUM.toLocaleString()}円</legend>
        <div className="radio-row">
          <label><input type="radio" name="quake" checked={quake} onChange={() => setQuake(true)} />つける</label>
          <label><input type="radio" name="quake" checked={!quake} onChange={() => setQuake(false)} />つけない</label>
        </div>
      </fieldset>
      <fieldset className="q-group">
        <legend><strong>③ iDeCo(個人型確定拠出年金)を始める?</strong> 上限 月{limit.toLocaleString()}円(企業年金のない会社員)</legend>
        <div className="radio-row">
          {[0, 5000, 10000, limit].map((v) => (
            <label key={v}>
              <input type="radio" name="ideco" checked={ideco === v} onChange={() => setIdeco(v)} />
              {v === 0 ? 'やらない' : `月${v.toLocaleString()}円`}
            </label>
          ))}
        </div>
        <p className="note">※ 2026年12月分からは上限が月6.2万円に上がります(1年目は旧上限で計算)。</p>
      </fieldset>
      <div className="actions">
        <EffectChips d={effect} />
        <button
          className="primary"
          onClick={() => apply((x) => ({ ...addGauges(chooseFirstYearOptions(x, { lifeInsurance: life, earthquake: quake, idecoMonthly: ideco }), effect), sceneId: 'june' }))}
        >
          決めた!6月へ進む
        </button>
      </div>
    </section>
  )
}

