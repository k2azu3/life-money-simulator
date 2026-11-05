import type { Rules } from './types'

/**
 * 児童手当(1年分)。0歳〜高校生年代(18歳になった後の最初の3月まで)。
 * 簡略化:年齢は「その年の誕生日を迎えた後の年齢」で1年まとめて判定する。
 */
export function childAllowanceForYear(age: number, childOrder: number, rules: Rules): number {
  const c = rules.benefits.childAllowanceMonthly
  if (age > 18) return 0
  if (childOrder >= 3) return c.thirdChildOrLater * 12
  if (age < 3) return c.under3 * 12
  return c.age3to18 * 12
}

/** 0歳から18歳までにもらえる児童手当の合計 */
export function childAllowanceTotal(childOrder: number, rules: Rules): number {
  let total = 0
  for (let age = 0; age <= 18; age++) total += childAllowanceForYear(age, childOrder, rules)
  return total
}
