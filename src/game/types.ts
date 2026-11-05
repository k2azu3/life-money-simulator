import type { RulesMode } from '../rules'
import type { CalcStep, LifeInsurancePremiums, Payslip } from '../engine'

export interface YearRecord {
  age: number
  year: number
  label: string
  gross: number
  socialInsurance: number
  incomeTax: number
  residentTax: number
  net: number
  /** その年の終わりの貯金 */
  savings: number
}

export interface MoneyLog {
  age: number
  text: string
  amount: number
  /** player = 自分のお金、family = 家族(親)のお金 */
  who: 'player' | 'family'
}

export interface Company {
  id: string
  name: string
  monthly: number
  bonuses: { month: number; amount: number }[]
  blurb: string
}

export interface FirstJobYear {
  company: Company
  startMonth: number
  age: number
  payslips: Payslip[]
  grossTotal: number
  siTotal: number
  siBreakdown: { health: number; childSupport: number; pension: number; employment: number }
  withheld: number
  residentTaxPaid: number
}

export interface YearEndOutcome {
  submitted: boolean
  /** 年末調整で申告した内容 */
  declared: {
    lifeInsurance?: LifeInsurancePremiums
    earthquakePremium?: number
    ideco?: number
  }
  /** 申告で決まった年税額(提出しなかった場合は源泉徴収額のまま) */
  annualTax: number
  refund: number
  /** すべて正しく申告していた場合の還付額 */
  bestRefund: number
  /** 書類選びのスコア(0〜100) */
  score: number
  mistakes: string[]
  steps: CalcStep[]
}

export interface FinalReturnOutcome {
  refund: number
  medicalDeduction: number
  steps: CalcStep[]
}

export interface GameFlags {
  otoshidama?: 'all' | 'half' | 'none'
  lottery?: boolean
  highSchoolJob?: number
  path?: 'university' | 'universityLoan' | 'work'
  scholarshipDebt?: number
  uniJob?: number
  lifeInsurance?: boolean
  earthquake?: boolean
  idecoMonthly?: number
  injured?: boolean
  medicalExpenses?: number
}

export interface GameState {
  version: 1
  name: string
  rulesMode: RulesMode
  birthYear: number
  sceneId: string
  age: number
  savings: number
  parentSalary: number
  flags: GameFlags
  records: YearRecord[]
  logs: MoneyLog[]
  badges: string[]
  /** 所得の年(西暦) → その所得にかかる住民税の年額 */
  residentLevies: Record<number, number>
  job?: FirstJobYear
  yearEnd?: YearEndOutcome
  finalReturn?: FinalReturnOutcome
  seed: number
}
