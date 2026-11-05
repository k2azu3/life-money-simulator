import { man, yen } from '../engine'
import type { GameState } from '../game/types'
import { yearOf } from '../game/state'
import { BADGES } from '../game/badges'
import type { BadgeId } from '../game/badges'
import {
  COMPANIES_HIGHSCHOOL,
  COMPANIES_UNIV,
  LIVING_COST_MONTHLY,
  premiumsPaid,
  whatIfCompany,
} from '../game/actions'
import { LineChart, MONEY_SERIES, Sankey, StackedBars } from './charts'
import type { FlowNode } from './charts'

type Apply = (f: (s: GameState) => GameState) => void

export function YearCharts({ s }: { s: GameState }) {
  const earning = s.records.filter((r) => r.gross > 0)
  return (
    <>
      {earning.length > 0 && (
        <StackedBars
          title="年ごとの額面と手取り"
          series={MONEY_SERIES}
          rows={earning.map((r) => ({
            label: `${r.age}歳`,
            values: { net: Math.max(0, r.net), si: r.socialInsurance, it: r.incomeTax, rt: r.residentTax },
          }))}
        />
      )}
      {s.records.length > 1 && (
        <LineChart title="貯金の推移" points={s.records.map((r) => ({ label: `${r.age}歳`, value: r.savings }))} />
      )}
    </>
  )
}

export function SummaryView({ s, apply }: { s: GameState; apply: Apply }) {
  const job = s.job
  const rec = job && s.records.find((r) => r.age === job.age)
  if (!job || !rec) return null
  const p = premiumsPaid(s)
  const living = LIVING_COST_MONTHLY * p.months
  const insurance = p.lifeInsurance + p.earthquake
  const medical = s.flags.medicalExpenses ?? 0
  const saved = rec.net - living - insurance - p.ideco - medical
  const levy = s.residentLevies[yearOf(s, job.age)] ?? 0

  const root: FlowNode = {
    name: '額面',
    value: rec.gross,
    color: 'var(--text-secondary)',
    children: [
      {
        name: '手取り',
        value: Math.max(0, rec.net),
        color: 'var(--series-net)',
        children: [
          { name: '生活費', value: living, color: '' },
          { name: '保険料', value: insurance, color: '' },
          { name: 'iDeCo', value: p.ideco, color: '' },
          { name: '医療費', value: medical, color: '' },
          { name: '貯金', value: Math.max(0, saved), color: '' },
        ],
      },
      {
        name: '社会保険料',
        value: rec.socialInsurance,
        color: 'var(--series-si)',
        children: [
          { name: '厚生年金', value: job.siBreakdown.pension, color: '' },
          { name: '健康保険', value: job.siBreakdown.health, color: '' },
          { name: '雇用保険', value: job.siBreakdown.employment, color: '' },
          { name: '子育て支援金', value: job.siBreakdown.childSupport, color: '' },
        ],
      },
      { name: '所得税', value: rec.incomeTax, color: 'var(--series-it)' },
      { name: '住民税', value: rec.residentTax, color: 'var(--series-rt)' },
    ],
  }
  // 子ノードは親の色を引き継ぐ
  root.children!.forEach((c) => c.children?.forEach((g) => (g.color = c.color)))

  const companies = s.flags.path === 'work' ? COMPANIES_HIGHSCHOOL : COMPANIES_UNIV
  const others = companies.filter((c) => c.id !== job.company.id).map((c) => ({ c, w: whatIfCompany(s, c) }))
  const missed = (s.yearEnd?.bestRefund ?? 0) - (s.yearEnd?.refund ?? 0) - (s.finalReturn?.refund ?? 0)

  return (
    <>
      <Sankey title={`${yearOf(s, job.age)}年(社会人1年目)のお金の流れ`} root={root} />
      {saved < 0 && <p className="note">※ 手取りだけでは足りず、貯金から{man(-saved)}を取り崩しました。</p>}

      <section className="card">
        <h2>来年の住民税</h2>
        <p>
          今年の所得に対する住民税は年 <strong>{yen(levy)}</strong>。来年6月から毎月約 <strong>{yen(Math.floor(levy / 12))}</strong> が給料から引かれ始めます。
        </p>
        <p className="note">2年目は「昇給したのに手取りが減った!」となりやすい年です。今のうちに心の準備を。</p>
      </section>

      <section className="card">
        <h2>もしも……</h2>
        <ul>
          {others.map(({ c, w }) => (
            <li key={c.id}>
              <strong>{c.name}</strong>を選んでいたら:1年目の額面 {man(w.gross)}、手取り {man(w.net)}(実際との差{' '}
              <span className={w.net - rec.net >= 0 ? 'plus' : 'minus'}>{w.net - rec.net >= 0 ? '+' : '−'}{yen(Math.abs(w.net - rec.net))}</span>)
            </li>
          ))}
          <li>
            年末調整・確定申告で控除をすべて正しく申告していたら:
            {missed > 0 ? <> あと <strong className="minus">{yen(missed)}</strong> 多く戻っていました。</> : <> 満点!取りこぼしはありません。</>}
          </li>
        </ul>
        <p className="note">生涯の「もしも」比較は、第2部(人生全体)で追加予定です。</p>
      </section>

      <YearCharts s={s} />
      <button className="primary" onClick={() => apply((x) => ({ ...x, sceneId: 'end' }))}>
        第1部のエンディングへ
      </button>
    </>
  )
}

export function BadgeGrid({ s }: { s: GameState }) {
  return (
    <div className="badges">
      {(Object.keys(BADGES) as BadgeId[]).map((id) => {
        const b = BADGES[id]
        const got = s.badges.includes(id)
        return (
          <div key={id} className={`badge ${got ? '' : 'locked'}`}>
            <span className="icon" aria-hidden="true">{got ? b.icon : '🔒'}</span>
            <div><strong>{b.title}</strong>{got ? '' : '(未獲得)'}</div>
            <div className="note">{b.desc}</div>
          </div>
        )
      })}
    </div>
  )
}

export function EndView({ s, onRestart }: { s: GameState; onRestart: () => void }) {
  const t = s.records.reduce(
    (a, r) => ({ gross: a.gross + r.gross, si: a.si + r.socialInsurance, it: a.it + r.incomeTax, rt: a.rt + r.residentTax, net: a.net + r.net }),
    { gross: 0, si: 0, it: 0, rt: 0, net: 0 },
  )
  return (
    <>
      <section className="card">
        <h2>ここまでのお金の総決算({s.records[s.records.length - 1]?.age ?? 0}歳まで)</h2>
        <table>
          <tbody>
            <tr><td>稼いだお金(額面)</td><td className="num">{yen(t.gross)}</td></tr>
            <tr><td>社会保険料</td><td className="num">{yen(t.si)}</td></tr>
            <tr><td>所得税</td><td className="num">{yen(t.it)}</td></tr>
            <tr><td>住民税</td><td className="num">{yen(t.rt)}</td></tr>
            <tr className="total"><td>手取り</td><td className="num">{yen(t.net)}</td></tr>
            <tr><td>今の貯金</td><td className="num">{yen(s.savings)}</td></tr>
            {s.flags.scholarshipDebt ? <tr><td>奨学金の残り(借金)</td><td className="num minus">{yen(s.flags.scholarshipDebt)}</td></tr> : null}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>獲得したバッジ({s.badges.length}/{Object.keys(BADGES).length})</h2>
        <BadgeGrid s={s} />
      </section>
      <section className="card">
        <h2>第2部の予告</h2>
        <p>2年目の住民税ショック、ふるさと納税、NISA、副業と確定申告、結婚と配偶者控除、住宅ローン控除、転職、親の介護と相続、そして年金生活とエンディング……。</p>
      </section>
      <button className="primary" onClick={onRestart}>もう一度はじめから遊ぶ</button>
    </>
  )
}
