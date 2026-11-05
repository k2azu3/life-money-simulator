import type { Rules } from './types'
import { clean, floorTo } from './util'

/**
 * 給与所得(給与収入 − 給与所得控除)
 * 国税庁「年末調整等のための給与所得控除後の給与等の金額の表」と同じく、
 * 一定の範囲では収入を4,000円単位に切り捨ててから計算する。
 */
export function salaryIncome(gross: number, rules: Rules): number {
  if (gross <= 0) return 0
  const cfg = rules.incomeTax.salaryDeduction
  for (const o of cfg.overrides) {
    if (gross >= o.from && gross < o.below) return o.income
  }
  const r = cfg.tableRounding
  const base = gross >= r.from && gross < r.below ? floorTo(gross, r.unit) : gross
  const deduction = Math.max(cfg.minimum, formulaDeduction(base, rules))
  return Math.max(0, Math.floor(clean(base - deduction)))
}

/** 表示用の給与所得控除額(収入 − 給与所得) */
export function salaryDeduction(gross: number, rules: Rules): number {
  return gross - salaryIncome(gross, rules)
}

function formulaDeduction(gross: number, rules: Rules): number {
  for (const b of rules.incomeTax.salaryDeduction.brackets) {
    if (b.upTo === null || gross <= b.upTo) return clean(gross * b.rate + b.add)
  }
  return 0
}

/** 給与が1円増えたときに給与所得控除が増える割合(0〜0.4) */
export function marginalSalaryDeductionRate(gross: number, rules: Rules): number {
  const cfg = rules.incomeTax.salaryDeduction
  if (formulaDeduction(gross, rules) <= cfg.minimum) return 0
  for (const b of cfg.brackets) {
    if (b.upTo === null || gross <= b.upTo) return b.rate
  }
  return 0
}

/**
 * 給与所得が所得税の基準額以下になる最大の給与収入(「○○万円の壁」の計算用)
 * 1,000円単位で探索する。
 */
export function maxSalaryForIncome(limitIncome: number, rules: Rules): number {
  let lo = 0
  let hi = 30_000_000
  while (hi - lo > 1000) {
    const mid = floorTo((lo + hi) / 2, 1000)
    if (salaryIncome(mid, rules) <= limitIncome) lo = mid
    else hi = mid
  }
  return lo
}
