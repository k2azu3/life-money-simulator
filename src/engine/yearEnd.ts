import type { LifeInsurancePremiums, Relative, Rules } from './types'
import type { IncomeTaxResult } from './incomeTax'
import { computeIncomeTax } from './incomeTax'

export interface YearEndDeclaration {
  dependents: Relative[]
  lifeInsurance?: LifeInsurancePremiums
  earthquakePremium?: number
  ideco?: number
}

export interface YearEndResult {
  tax: IncomeTaxResult
  withheld: number
  /** プラスなら還付(戻ってくる)、マイナスなら追徴(追加で引かれる) */
  refund: number
}

/**
 * 年末調整:会社が1年分の正しい所得税を計算し、毎月天引きした額との差を精算する。
 * 医療費控除・寄附金控除(ふるさと納税)・雑損控除などは年末調整では扱えない(確定申告が必要)。
 */
export function yearEndAdjustment(
  grossTotal: number,
  socialInsurance: number,
  withheld: number,
  decl: YearEndDeclaration,
  rules: Rules,
): YearEndResult {
  const tax = computeIncomeTax(
    {
      salaryGross: grossTotal,
      socialInsurance,
      dependents: decl.dependents,
      lifeInsurance: decl.lifeInsurance,
      earthquakePremium: decl.earthquakePremium,
      ideco: decl.ideco,
    },
    rules,
  )
  return { tax, withheld, refund: withheld - tax.tax }
}

export interface FinalReturnInput extends YearEndDeclaration {
  grossTotal: number
  socialInsurance: number
  medicalExpenses?: number
  /** その年に最終的に納めた(源泉徴収+年末調整後)所得税 */
  alreadyPaid: number
}

/** 確定申告:年末調整で漏れた控除や、年末調整では使えない控除を自分で申告して精算する */
export function finalReturn(input: FinalReturnInput, rules: Rules): YearEndResult {
  const tax = computeIncomeTax(
    {
      salaryGross: input.grossTotal,
      socialInsurance: input.socialInsurance,
      dependents: input.dependents,
      lifeInsurance: input.lifeInsurance,
      earthquakePremium: input.earthquakePremium,
      ideco: input.ideco,
      medicalExpenses: input.medicalExpenses,
    },
    rules,
  )
  return { tax, withheld: input.alreadyPaid, refund: input.alreadyPaid - tax.tax }
}
