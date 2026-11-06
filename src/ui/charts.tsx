import { useState } from 'react'
import type { ReactNode } from 'react'
import { man, yen } from '../engine'

export interface Series {
  key: string
  name: string
  color: string
}

/** 家計の4系列。順番(=色の割り当て)は固定 */
export const MONEY_SERIES: Series[] = [
  { key: 'net', name: '手取り', color: 'var(--series-net)' },
  { key: 'si', name: '社会保険料', color: 'var(--series-si)' },
  { key: 'it', name: '所得税', color: 'var(--series-it)' },
  { key: 'rt', name: '住民税', color: 'var(--series-rt)' },
]

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="legend" aria-label="凡例">
      {series.map((s) => (
        <li key={s.key}>
          <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
          {s.name}
        </li>
      ))}
    </ul>
  )
}

function niceMax(v: number): number {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * p
}

function ChartFrame({
  title,
  table,
  children,
}: {
  title: string
  table: ReactNode
  children: ReactNode
}) {
  const [showTable, setShowTable] = useState(false)
  return (
    <figure className="card" style={{ margin: '0 0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <figcaption>
          <h3 style={{ margin: 0 }}>{title}</h3>
        </figcaption>
        <button className="tertiary small" onClick={() => setShowTable(!showTable)} aria-pressed={showTable}>
          {showTable ? 'グラフで見る' : '表で見る'}
        </button>
      </div>
      {showTable ? <div className="table-scroll">{table}</div> : children}
    </figure>
  )
}

export interface StackRow {
  label: string
  values: Record<string, number>
}

/** 年ごとの「額面 = 手取り + 社会保険料 + 所得税 + 住民税」の積み上げ棒グラフ */
export function StackedBars({ title, rows, series }: { title: string; rows: StackRow[]; series: Series[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 260
  const m = { t: 16, r: 8, b: 32, l: 52 }
  const total = (r: StackRow) => series.reduce((a, s) => a + Math.max(0, r.values[s.key] ?? 0), 0)
  const max = niceMax(Math.max(...rows.map(total), 1))
  const iw = W - m.l - m.r
  const ih = H - m.t - m.b
  const band = iw / Math.max(rows.length, 1)
  const bw = Math.min(36, band * 0.7)
  const y = (v: number) => m.t + ih - (v / max) * ih
  const ticks = [0, max / 2, max]

  const table = (
    <table>
      <thead>
        <tr>
          <th>年</th>
          {series.map((s) => (
            <th key={s.key} className="num">{s.name}</th>
          ))}
          <th className="num">額面</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            {series.map((s) => (
              <td key={s.key} className="num">{yen(r.values[s.key] ?? 0)}</td>
            ))}
            <td className="num">{yen(total(r))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <ChartFrame title={title} table={table}>
      <Legend series={series} />
      <div className="chart-wrap">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}。詳しい数値は「表で見る」で確認できます`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={m.l - 6} y={y(t) + 4} textAnchor="end">{man(t)}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const cx = m.l + band * i + band / 2
            let acc = 0
            const segs = series.map((s, si) => {
              const v = Math.max(0, r.values[s.key] ?? 0)
              const y0 = y(acc)
              acc += v
              const y1 = y(acc)
              const h = Math.max(0, y0 - y1 - (si > 0 && v > 0 ? 2 : 0))
              return v > 0 ? <rect key={s.key} x={cx - bw / 2} y={y1} width={bw} height={h} fill={s.color} rx={si === series.length - 1 ? 0 : 0} /> : null
            })
            return (
              <g key={r.label} opacity={hover === null || hover === i ? 1 : 0.55}>
                {segs}
                <text x={cx} y={H - m.b + 16} textAnchor="middle">{r.label}</text>
                <rect
                  x={m.l + band * i}
                  y={m.t}
                  width={band}
                  height={ih}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${r.label}:${series.map((s) => `${s.name}${man(r.values[s.key] ?? 0)}`).join('、')}`}
                />
              </g>
            )
          })}
          <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke="var(--text-muted)" strokeWidth={1} />
        </svg>
        {hover !== null && rows[hover] && (
          <div className="tooltip" style={{ left: `${((m.l + band * hover + band) / W) * 100}%`, top: 0 }}>
            <strong>{rows[hover].label}</strong>(額面 {man(total(rows[hover]))})
            {series.map((s) => (
              <div className="tooltip-row" key={s.key}>
                <span><span className="swatch" style={{ background: s.color }} /> {s.name}</span>
                <span>{yen(rows[hover].values[s.key] ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ChartFrame>
  )
}

/** 貯金の推移(1系列の折れ線) */
export function LineChart({ title, points }: { title: string; points: { label: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 220
  const m = { t: 16, r: 16, b: 32, l: 56 }
  const vals = points.map((p) => p.value)
  const max = niceMax(Math.max(...vals, 1))
  const min = Math.min(0, ...vals)
  const iw = W - m.l - m.r
  const ih = H - m.t - m.b
  const x = (i: number) => m.l + (points.length <= 1 ? iw / 2 : (iw * i) / (points.length - 1))
  const y = (v: number) => m.t + ih - ((v - min) / (max - min || 1)) * ih
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')
  const last = points.length - 1

  const table = (
    <table>
      <thead><tr><th>年齢</th><th className="num">貯金</th></tr></thead>
      <tbody>{points.map((p) => <tr key={p.label}><td>{p.label}</td><td className="num">{yen(p.value)}</td></tr>)}</tbody>
    </table>
  )

  return (
    <ChartFrame title={title} table={table}>
      <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
        <svg
          className="chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title}。最新は${man(points[last]?.value ?? 0)}`}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
            const px = ((e.clientX - rect.left) / rect.width) * W
            const i = Math.round(((px - m.l) / iw) * (points.length - 1))
            setHover(Math.max(0, Math.min(last, i)))
          }}
        >
          {[min, (min + max) / 2, max].map((t) => (
            <g key={t}>
              <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
              <text x={m.l - 6} y={y(t) + 4} textAnchor="end">{man(t)}</text>
            </g>
          ))}
          {points.map((p, i) =>
            i % Math.ceil(points.length / 8) === 0 || i === last ? (
              <text key={p.label} x={x(i)} y={H - m.b + 16} textAnchor="middle">{p.label}</text>
            ) : null,
          )}
          <path d={d} fill="none" stroke="var(--series-net)" strokeWidth={2} strokeLinejoin="round" />
          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} stroke="var(--text-muted)" strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(points[hover].value)} r={5} fill="var(--series-net)" stroke="var(--surface-1)" strokeWidth={2} />
            </>
          )}
          {last >= 0 && (
            <text className="value-label" x={x(last)} y={y(points[last].value) - 10} textAnchor="end">
              {man(points[last].value)}
            </text>
          )}
        </svg>
        {hover !== null && (
          <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%`, top: 0 }}>
            {points[hover].label}:{yen(points[hover].value)}
          </div>
        )}
      </div>
    </ChartFrame>
  )
}

export interface FlowNode {
  name: string
  value: number
  color: string
  children?: FlowNode[]
}

/** 3列のサンキー図(額面 → 行き先 → 内訳) */
export function Sankey({ title, root }: { title: string; root: FlowNode }) {
  const [hover, setHover] = useState<string | null>(null)
  const W = 680
  const H = 400
  const nodeW = 14
  const gap = 10
  const cols = [16, 260, 470]
  const top = 30
  const usable = H - top - 12

  const level1 = (root.children ?? []).filter((c) => c.value > 0)
  const level2 = level1.flatMap((c) => (c.children ?? []).filter((g) => g.value > 0).map((g) => ({ ...g, parent: c.name })))
  const scale1 = (usable - gap * (level1.length - 1)) / root.value
  const scale2 = (usable - gap * Math.max(level2.length - 1, 0)) / root.value
  const scale = Math.min(scale1, scale2)

  type Placed = { name: string; value: number; color: string; x: number; y: number; h: number; parent?: string }
  const rootP: Placed = { ...root, x: cols[0], y: top, h: root.value * scale }
  let yy = top
  const l1: Placed[] = level1.map((c) => {
    const p = { ...c, x: cols[1], y: yy, h: c.value * scale }
    yy += p.h + gap
    return p
  })
  yy = top
  const l2: Placed[] = level2.map((c) => {
    const p = { ...c, x: cols[2], y: yy, h: c.value * scale }
    yy += p.h + gap
    return p
  })

  const band = (sx: number, sy: number, tx: number, ty: number, h: number) => {
    const mx = (sx + tx) / 2
    return `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty} L${tx},${ty + h} C${mx},${ty + h} ${mx},${sy + h} ${sx},${sy + h} Z`
  }

  const links: { id: string; d: string; color: string; label: string }[] = []
  let off = 0
  for (const c of l1) {
    links.push({ id: c.name, d: band(rootP.x + nodeW, rootP.y + off, c.x, c.y, c.h), color: c.color, label: `${root.name} → ${c.name}:${yen(c.value)}` })
    off += c.h
  }
  for (const c of l1) {
    let o = 0
    for (const g of l2.filter((x) => x.parent === c.name)) {
      links.push({ id: `${c.name}/${g.name}`, d: band(c.x + nodeW, c.y + o, g.x, g.y, g.h), color: c.color, label: `${c.name} → ${g.name}:${yen(g.value)}` })
      o += g.h
    }
  }

  const table = (
    <table>
      <thead><tr><th>流れ</th><th className="num">金額</th><th className="num">額面に対する割合</th></tr></thead>
      <tbody>
        {l1.map((c) => (
          <tr key={c.name}><td>{root.name} → {c.name}</td><td className="num">{yen(c.value)}</td><td className="num">{((c.value / root.value) * 100).toFixed(1)}%</td></tr>
        ))}
        {l2.map((g) => (
          <tr key={g.parent + g.name}><td>{g.parent} → {g.name}</td><td className="num">{yen(g.value)}</td><td className="num">{((g.value / root.value) * 100).toFixed(1)}%</td></tr>
        ))}
      </tbody>
    </table>
  )

  const label = (p: Placed, anchor: 'start' | 'end', dx: number) =>
    p.h >= 4 && (
      <text x={p.x + dx} y={p.y + p.h / 2 + 4} textAnchor={anchor}>
        <tspan className="value-label">{p.name}</tspan> {man(p.value)}
      </text>
    )

  return (
    <ChartFrame title={title} table={table}>
      <div className="chart-wrap">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}。数値は「表で見る」で確認できます`}>
          {links.map((l) => (
            <path
              key={l.id}
              d={l.d}
              fill={l.color}
              opacity={hover === null ? 0.35 : hover === l.id ? 0.7 : 0.15}
              onMouseEnter={() => setHover(l.id)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{l.label}</title>
            </path>
          ))}
          <rect x={rootP.x} y={rootP.y} width={nodeW} height={rootP.h} fill="var(--text-secondary)" rx={3} />
          <text x={rootP.x} y={rootP.y - 10}>
            <tspan className="value-label">{root.name}</tspan> {man(root.value)}
          </text>
          {l1.map((p) => (
            <g key={p.name}>
              <rect x={p.x} y={p.y} width={nodeW} height={Math.max(p.h, 1)} fill={p.color} rx={3} />
              {label(p, 'end', -6)}
            </g>
          ))}
          {l2.map((p) => (
            <g key={p.parent + p.name}>
              <rect x={p.x} y={p.y} width={nodeW} height={Math.max(p.h, 1)} fill={p.color} rx={3} />
              {label(p, 'start', nodeW + 6)}
            </g>
          ))}
        </svg>
        {hover && (
          <div className="tooltip" style={{ right: 8, top: 0 }}>
            {links.find((l) => l.id === hover)?.label}
          </div>
        )}
      </div>
    </ChartFrame>
  )
}
