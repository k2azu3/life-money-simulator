import { useState } from 'react'
import {
  computeIncomeTax,
  computeWalls,
  healthStandardMonthly,
  man,
  monthlySocialInsurance,
  pensionStandardMonthly,
  yen,
} from '../engine'
import type { GameState } from '../game/types'
import { rulesFor } from '../game/state'
import {
  chooseFirstYearOptions,
  chooseUniJob,
  COMPANIES_HIGHSCHOOL,
  COMPANIES_UNIV,
  EARTHQUAKE_PREMIUM,
  LIFE_INSURANCE_MONTHLY,
  startJob,
  UNI_JOB_OPTIONS,
  uniJobMarginals,
  uniJobSweetSpot,
} from '../game/actions'
import { Modal, StepList } from './common'

type Apply = (f: (s: GameState) => GameState) => void

export function WallsView({ s, apply }: { s: GameState; apply: Apply }) {
  const r = rulesFor(s, 20)
  const walls = computeWalls(r, 20)
  const options = uniJobMarginals(s)
  const sweet = uniJobSweetSpot(s)
  return (
    <>
      <section className="card" aria-labelledby="wall-map">
        <h2 id="wall-map">年収の壁マップ(20歳・給与だけの場合)</h2>
        <ul className="wall-list">
          {walls.map((w) => (
            <li key={w.id}>
              <span className="wall-amount">{man(w.amount)}{w.id === 'socialDependent' ? '以上' : '超'}</span>
              <span>
                <strong>{w.title}</strong>
                <br />
                <span className="note">{w.whatHappens}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="note">※ 金額はすべて設定ファイル(令和8年分)から計算しています。住民税の非課税ラインは自治体によって少し違います。</p>
      </section>
      <section aria-labelledby="choose-job">
        <h2 id="choose-job">1年あたりのバイト年収を選ぼう(4年間つづけます)</h2>
        <div className="option-grid">
          {options.map(({ analysis: a, marginal }, i) => (
            <button key={a.salary} className="option-card" onClick={() => apply((x) => ({ ...chooseUniJob(x, a.salary), sceneId: 'company' }))}>
              <strong>年収 {man(a.salary)}</strong>{' '}
              {a.salary === sweet && <span className="tag best">✔ 壁の手前でコスパ最大</span>}
              {marginal < 0.5 && <span className="tag bad">⚠ 働き損ゾーン</span>}
              <dl>
                <dt>自分の所得税</dt><dd>{yen(a.ownIncomeTax)}</dd>
                <dt>自分の住民税(翌年)</dt><dd>{yen(a.ownResidentTaxNextYear)}</dd>
                <dt>自分の国民健康保険(概算)</dt><dd>{yen(a.ownHealthInsurance)}</dd>
                <dt>親の税金の増加</dt><dd>{yen(a.parentTaxIncrease)}</dd>
                <dt><strong>家族全体の手取り</strong></dt><dd><strong>{yen(a.familyNet)}</strong></dd>
              </dl>
              {i > 0 && (
                <p className="note" style={{ margin: '6px 0 0' }}>
                  {man(UNI_JOB_OPTIONS[i - 1])}から増やした{man(a.salary - UNI_JOB_OPTIONS[i - 1])}のうち、手元に残るのは <strong>{Math.round(marginal * 100)}%</strong>
                </p>
              )}
            </button>
          ))}
        </div>
        <p className="note">「手元に残る割合」は、年収を増やした分から、自分の税金・保険料の増加と親の税金の増加を引いて計算しています。親は年収{man(s.parentSalary)}の会社員として計算しています。</p>
      </section>
    </>
  )
}

export function CompanyView({ s, apply }: { s: GameState; apply: Apply }) {
  const list = s.flags.path === 'work' ? COMPANIES_HIGHSCHOOL : COMPANIES_UNIV
  return (
    <div className="option-grid">
      {list.map((c) => {
        const firstYear = c.monthly * 9 + c.bonuses.reduce((a, b) => a + b.amount, 0)
        return (
          <button key={c.id} className="option-card" onClick={() => apply((x) => ({ ...startJob(x, c), sceneId: 'payslip' }))}>
            <strong>{c.name}</strong>
            <p style={{ margin: '4px 0' }}>{c.blurb}</p>
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
  health: '病気やケガのときの医療費を3割負担にしてくれる保険。会社も同じ額を払っています。',
  childSupport: '2026年度から始まった「子ども・子育て支援金」。社会全体で子育てを支える仕組みで、健康保険料と一緒に集められます。',
  pension: '老後の年金や、障害・遺族年金のための保険料。会社も同じ額を払っています。',
  employment: '失業したときの給付や育児休業給付のための保険料。会社はもっと多く払っています。',
  incomeTax: '毎月は「だいたい」の額。12月の年末調整で正しい額に直します。',
  residentTax: '前の年の所得にかかる税金。1年目は前の年の所得が少ないので、ほとんどかかりません。',
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
                    <button className="ghost" aria-expanded={help === k} onClick={() => setHelp(help === k ? null : k)}>
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
          <button onClick={() => setWhy(true)}>なぜ?(計算の内訳)</button>
        </div>
      </section>
      <button className="primary" onClick={() => apply((x) => ({ ...x, sceneId: 'firstYearChoices' }))}>
        5月へ進む
      </button>
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
  return (
    <section className="card">
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
        <legend><strong>① 医療保険(生命保険の一種)に入る?</strong> 月{LIFE_INSURANCE_MONTHLY.toLocaleString()}円</legend>
        <div className="radio-row">
          <label><input type="radio" name="life" checked={life} onChange={() => setLife(true)} />入る</label>
          <label><input type="radio" name="life" checked={!life} onChange={() => setLife(false)} />入らない</label>
        </div>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
        <legend><strong>② 賃貸の火災保険に地震保険をつける?</strong> 年{EARTHQUAKE_PREMIUM.toLocaleString()}円</legend>
        <div className="radio-row">
          <label><input type="radio" name="quake" checked={quake} onChange={() => setQuake(true)} />つける</label>
          <label><input type="radio" name="quake" checked={!quake} onChange={() => setQuake(false)} />つけない</label>
        </div>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
        <legend><strong>③ iDeCo(個人型確定拠出年金)を始める?</strong> 上限 月{limit.toLocaleString()}円(企業年金のない会社員)</legend>
        <div className="radio-row">
          {[0, 5000, 10000, limit].map((v) => (
            <label key={v}>
              <input type="radio" name="ideco" checked={ideco === v} onChange={() => setIdeco(v)} />
              {v === 0 ? 'やらない' : `月${v.toLocaleString()}円`}
            </label>
          ))}
        </div>
        <p className="note">※ 2026年12月分の掛金からは上限が月6.2万円に上がります(このゲームでは1年目は旧上限で計算)。</p>
      </fieldset>
      <button className="primary" onClick={() => apply((x) => ({ ...chooseFirstYearOptions(x, { lifeInsurance: life, earthquake: quake, idecoMonthly: ideco }), sceneId: 'june' }))}>
        決めた!6月へ進む
      </button>
    </section>
  )
}

