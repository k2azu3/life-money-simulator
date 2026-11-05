import type { Relative, Rules } from './types'
import { computeIncomeTax } from './incomeTax'
import type { SocialInsuranceBreakdown } from './socialInsurance'
import { ZERO_SI, addSI, bonusSocialInsurance, monthlySocialInsurance } from './socialInsurance'
import { floorTo } from './util'

export interface Payslip {
  month: number
  kind: '給与' | '賞与'
  gross: number
  si: SocialInsuranceBreakdown
  incomeTax: number
  residentTax: number
  net: number
}

export interface EmploymentYearInput {
  monthlySalary: number
  /** 入社した月(1〜12)。その年の途中入社なら4など */
  startMonth: number
  bonuses: { month: number; amount: number }[]
  age: number
  /** 扶養控除等申告書に書いた扶養親族(毎月の源泉徴収に反映される) */
  declaredDependents: Relative[]
  /** 1〜5月に天引きされる住民税の年額(前々年の所得に対するもの) */
  residentTaxJanToMay: number
  /** 6〜12月に天引きされる住民税の年額(前年の所得に対するもの) */
  residentTaxJunToDec: number
}

export interface EmploymentYear {
  payslips: Payslip[]
  grossTotal: number
  si: SocialInsuranceBreakdown
  withheldIncomeTax: number
  residentTaxPaid: number
  netTotal: number
}

/**
 * 毎月の源泉徴収(概算)。
 * 実際は「源泉徴収税額表」を使うが、ここでは「この月給が12か月続いたら年税額はいくら?」を
 * 計算して12で割る方法で近似する(簡略化)。途中入社でも12か月分あると仮定して天引きされるため、
 * 1年目は年末調整で還付されやすい ― という現実の仕組みはそのまま再現される。
 */
export function monthlyWithholding(
  monthlyGross: number,
  monthlySI: number,
  dependents: Relative[],
  rules: Rules,
): number {
  const annual = computeIncomeTax(
    { salaryGross: monthlyGross * 12, socialInsurance: monthlySI * 12, dependents },
    rules,
  ).tax
  return floorTo(annual / 12, 10)
}

/**
 * 賞与の源泉徴収(概算)。月給12か月分に賞与を足したとき増える年税額を賞与から天引きする。
 */
export function bonusWithholding(
  monthlyGross: number,
  monthlySI: number,
  bonus: number,
  bonusSI: number,
  dependents: Relative[],
  rules: Rules,
): number {
  const base = computeIncomeTax(
    { salaryGross: monthlyGross * 12, socialInsurance: monthlySI * 12, dependents },
    rules,
  ).tax
  const withBonus = computeIncomeTax(
    { salaryGross: monthlyGross * 12 + bonus, socialInsurance: monthlySI * 12 + bonusSI, dependents },
    rules,
  ).tax
  return floorTo(Math.max(0, withBonus - base), 10)
}

/** 1年分の給与明細を作る */
export function simulateEmploymentYear(input: EmploymentYearInput, rules: Rules): EmploymentYear {
  const payslips: Payslip[] = []
  const mSI = monthlySocialInsurance(input.monthlySalary, input.age, rules)
  const mTax = monthlyWithholding(input.monthlySalary, mSI.total, input.declaredDependents, rules)
  // 住民税は「前年の所得」に対してかかり、6月〜翌5月の12回に分けて天引きされる(端数処理は簡略化)
  const residentEarly = Math.floor(input.residentTaxJanToMay / 12)
  const residentLate = Math.floor(input.residentTaxJunToDec / 12)
  let healthBonusSoFar = 0

  for (let m = input.startMonth; m <= 12; m++) {
    const residentTax = m <= 5 ? residentEarly : residentLate
    payslips.push({
      month: m,
      kind: '給与',
      gross: input.monthlySalary,
      si: mSI,
      incomeTax: mTax,
      residentTax,
      net: input.monthlySalary - mSI.total - mTax - residentTax,
    })
    for (const b of input.bonuses.filter((x) => x.month === m)) {
      const bSI = bonusSocialInsurance(b.amount, input.age, rules, healthBonusSoFar)
      healthBonusSoFar += bSI.standardBonus
      const tax = bonusWithholding(input.monthlySalary, mSI.total, b.amount, bSI.total, input.declaredDependents, rules)
      payslips.push({
        month: m,
        kind: '賞与',
        gross: b.amount,
        si: bSI,
        incomeTax: tax,
        residentTax: 0,
        net: b.amount - bSI.total - tax,
      })
    }
  }

  const si = payslips.reduce((acc, p) => addSI(acc, p.si), ZERO_SI)
  const grossTotal = payslips.reduce((a, p) => a + p.gross, 0)
  const withheldIncomeTax = payslips.reduce((a, p) => a + p.incomeTax, 0)
  const residentTaxPaid = payslips.reduce((a, p) => a + p.residentTax, 0)
  return {
    payslips,
    grossTotal,
    si,
    withheldIncomeTax,
    residentTaxPaid,
    netTotal: grossTotal - si.total - withheldIncomeTax - residentTaxPaid,
  }
}
