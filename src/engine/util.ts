import type { AmountBracket, RateBracket } from './types'

/** 浮動小数点の誤差を消してから扱う(例: 20192.499999 → 20192.5) */
export function clean(x: number): number {
  return Math.round(x * 1e6) / 1e6
}

export function floorTo(x: number, unit: number): number {
  return Math.floor(clean(x) / unit) * unit
}

/**
 * 社会保険料の被保険者負担分の端数処理(給与から天引きする場合)
 * 50銭以下は切り捨て、50銭を超えたら切り上げ
 */
export function roundEmployeeShare(x: number): number {
  const v = clean(x)
  const f = Math.floor(v)
  return v - f > 0.5 ? f + 1 : f
}

export function lookupAmount(rows: AmountBracket[], value: number, fallback = 0): number {
  for (const r of rows) {
    if (r.upTo === null || value <= r.upTo) return r.amount
  }
  return fallback
}

export function applySteps(steps: RateBracket[], value: number): number {
  for (const s of steps) {
    if (s.upTo === null || value <= s.upTo) return clean(value * s.rate + s.add)
  }
  return 0
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}

/** 「1,234,567円」形式 */
export function yen(n: number): string {
  return `${Math.round(n).toLocaleString('ja-JP')}円`
}

/** 「123.4万円」形式(1万円未満は円表記) */
export function man(n: number): string {
  const abs = Math.abs(n)
  if (abs < 10000) return yen(n)
  const v = Math.round(n / 1000) / 10
  return `${v.toLocaleString('ja-JP')}万円`
}
