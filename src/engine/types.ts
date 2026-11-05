/** 年度別設定ファイル(src/rules/*.json)の型 */

export interface RateBracket {
  upTo: number | null
  rate: number
  add: number
}

export interface AmountBracket {
  upTo: number | null
  amount: number
}

export interface TaxRateBracket {
  upTo: number | null
  rate: number
  deduct: number
}

export interface InsuranceDeductionConfig {
  steps: RateBracket[]
  totalCap: number
}

export interface Rules {
  year: number
  label: string
  residentTaxLabel: string
  incomeTax: {
    salaryDeduction: {
      minimum: number
      brackets: RateBracket[]
      tableRounding: { from: number; below: number; unit: number }
      overrides: { from: number; below: number; income: number }[]
    }
    basicDeduction: AmountBracket[]
    rates: TaxRateBracket[]
    reconstructionRate: number
    dependent: {
      incomeLimit: number
      general: number
      specific: number
      elderly: number
      elderlyCohabiting: number
    }
    specificRelative: { rows: AmountBracket[] }
    workingStudent: { amount: number; incomeLimit: number }
    lifeInsurance: InsuranceDeductionConfig
    earthquakeInsurance: { cap: number; rate: number }
    medical: { floor: number; incomeRate: number; cap: number }
    ideco: { employeeNoCorporatePensionMonthlyLimit: number; fromDecemberMonthlyLimit: number }
  }
  residentTax: {
    basicDeduction: AmountBracket[]
    incomeRate: number
    perCapita: number
    nonTaxableIncomeSingle: number
    nonTaxableIncomeMinor: number
    dependent: { general: number; specific: number; elderly: number; elderlyCohabiting: number }
    specificRelative: { rows: AmountBracket[] }
    workingStudent: number
    lifeInsurance: InsuranceDeductionConfig
    earthquakeInsurance: { cap: number; rate: number }
    adjustment: {
      rate: number
      threshold: number
      minimumBase: number
      diff: { basic: number; general: number; specific: number; workingStudent: number }
    }
  }
  socialInsurance: {
    region: string
    healthRate: number
    careRate: number
    careAgeFrom: number
    careAgeTo: number
    childSupportRate: number
    pensionRate: number
    employmentEmployeeRate: number
    healthBonusAnnualCap: number
    pensionBonusPerPaymentCap: number
    pensionGradeMin: number
    pensionGradeMax: number
    healthGrades: [number, number][]
    nationalPensionMonthly: number
    nationalHealthApprox: { incomeRate: number; perCapita: number; cap: number }
  }
  walls: {
    socialDependentAnnual: number
    socialDependentAnnualAge19to22: number
    employeeInsuranceMonthly: number
  }
  benefits: {
    birthLumpSum: number
    childAllowanceMonthly: { under3: number; age3to18: number; thirdChildOrLater: number }
    giftTaxBasicExemption: number
  }
}

/** 「なぜ?」ボタンで表示する計算ステップ */
export interface CalcStep {
  label: string
  /** 中学生にもわかる言葉での式(例:「500万円 − 144万円」) */
  formula?: string
  value: number
  note?: string
}

/** 扶養している(またはされる)親族 */
export interface Relative {
  /** その年の12月31日時点の年齢 */
  age: number
  /** 合計所得金額(給与だけなら給与所得) */
  income: number
  cohabitingParent?: boolean
}

export interface LifeInsurancePremiums {
  general: number
  medical: number
  pension: number
}

export interface Deduction {
  key: string
  name: string
  amount: number
}
