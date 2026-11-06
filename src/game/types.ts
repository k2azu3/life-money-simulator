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
  /** 6月:医療費の領収書をとっておいたか */
  keptReceipts?: boolean
}

/** 3つのゲージ(0〜100) */
export interface Gauges {
  /** お金:かしこい選択で増える */
  money: number
  /** 徳:正直さ・まわりへの思いやり。ズルや不正で減る */
  toku: number
  /** しあわせ:楽しい体験や安心で増える */
  happy: number
}

export type GaugeDelta = Partial<Gauges>

/** ミッションの結果。stars = 0 は失敗(あきらめて先へ進んだ) */
export interface MissionResult {
  stars: number
  tries: number
  hintUsed: boolean
}

export interface GameState {
  version: 2
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
  gauges: Gauges
  /** ミッションID → 結果 */
  missions: Record<string, MissionResult>
  /** 手に入れた知識カードのID */
  cards: string[]
  /** 所得の年(西暦) → その所得にかかる住民税の年額 */
  residentLevies: Record<number, number>
  job?: FirstJobYear
  yearEnd?: YearEndOutcome
  finalReturn?: FinalReturnOutcome
  seed: number
}
