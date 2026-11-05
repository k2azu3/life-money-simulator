import type { Rules } from './types'
import { floorTo, roundEmployeeShare } from './util'

export interface SocialInsuranceBreakdown {
  /** 健康保険(40〜64歳は介護保険を含む) */
  health: number
  /** 健康保険のうち介護保険の分(表示用の目安) */
  care: number
  childSupport: number
  pension: number
  employment: number
  total: number
}

export const ZERO_SI: SocialInsuranceBreakdown = {
  health: 0,
  care: 0,
  childSupport: 0,
  pension: 0,
  employment: 0,
  total: 0,
}

export function addSI(a: SocialInsuranceBreakdown, b: SocialInsuranceBreakdown): SocialInsuranceBreakdown {
  return {
    health: a.health + b.health,
    care: a.care + b.care,
    childSupport: a.childSupport + b.childSupport,
    pension: a.pension + b.pension,
    employment: a.employment + b.employment,
    total: a.total + b.total,
  }
}

/** 標準報酬月額(健康保険)。月給を等級表にあてはめた「キリのいい金額」 */
export function healthStandardMonthly(monthly: number, rules: Rules): number {
  const grades = rules.socialInsurance.healthGrades
  let std = grades[0][1]
  for (const [lower, s] of grades) if (monthly >= lower) std = s
  return std
}

/** 標準報酬月額(厚生年金)。健康保険の等級を8.8万〜65万円の範囲に収めたもの */
export function pensionStandardMonthly(monthly: number, rules: Rules): number {
  const si = rules.socialInsurance
  return Math.min(si.pensionGradeMax, Math.max(si.pensionGradeMin, healthStandardMonthly(monthly, rules)))
}

function hasCare(age: number, rules: Rules): boolean {
  return age >= rules.socialInsurance.careAgeFrom && age <= rules.socialInsurance.careAgeTo
}

function build(
  healthBase: number,
  pensionBase: number,
  employmentBase: number,
  age: number,
  rules: Rules,
): SocialInsuranceBreakdown {
  const si = rules.socialInsurance
  const careRate = hasCare(age, rules) ? si.careRate : 0
  // 健康保険と介護保険は合計の料率で計算して1回だけ端数処理する(折半)
  const health = roundEmployeeShare((healthBase * (si.healthRate + careRate)) / 2)
  const care = careRate > 0 ? roundEmployeeShare((healthBase * careRate) / 2) : 0
  const childSupport = roundEmployeeShare((healthBase * si.childSupportRate) / 2)
  const pension = roundEmployeeShare((pensionBase * si.pensionRate) / 2)
  const employment = roundEmployeeShare(employmentBase * si.employmentEmployeeRate)
  return { health, care, childSupport, pension, employment, total: health + childSupport + pension + employment }
}

/** 毎月の給与から天引きされる社会保険料(会社員本人の負担分) */
export function monthlySocialInsurance(monthlyGross: number, age: number, rules: Rules): SocialInsuranceBreakdown {
  return build(
    healthStandardMonthly(monthlyGross, rules),
    pensionStandardMonthly(monthlyGross, rules),
    monthlyGross,
    age,
    rules,
  )
}

/**
 * 賞与から天引きされる社会保険料
 * @param healthBonusSoFar その年度にすでに支給された標準賞与額の累計(健康保険の年間上限の判定用)
 */
export function bonusSocialInsurance(
  bonus: number,
  age: number,
  rules: Rules,
  healthBonusSoFar = 0,
): SocialInsuranceBreakdown & { standardBonus: number } {
  const si = rules.socialInsurance
  const standardBonus = floorTo(bonus, 1000)
  const healthBase = Math.max(0, Math.min(standardBonus, si.healthBonusAnnualCap - healthBonusSoFar))
  const pensionBase = Math.min(standardBonus, si.pensionBonusPerPaymentCap)
  return { ...build(healthBase, pensionBase, bonus, age, rules), standardBonus }
}
