import type { CalcStep, Deduction, LifeInsurancePremiums, Relative, Rules, InsuranceDeductionConfig } from './types'
import { salaryIncome } from './salary'
import { applySteps, clean, floorTo, lookupAmount, man, sum } from './util'

export interface IncomeTaxInput {
  /** 給与の収入金額(額面の年額。賞与を含む) */
  salaryGross?: number
  /** 給与以外の所得(事業所得など。今回は所得金額で受け取る) */
  otherIncome?: number
  /** 支払った社会保険料(厚生年金・健康保険・雇用保険・国民年金など) */
  socialInsurance: number
  /** iDeCo などの小規模企業共済等掛金 */
  ideco?: number
  lifeInsurance?: LifeInsurancePremiums
  earthquakePremium?: number
  /** 保険などで補てんされた分を引いた後の医療費 */
  medicalExpenses?: number
  dependents?: Relative[]
  /** 勤労学生控除を受けるか(所得要件を満たす場合のみ適用) */
  workingStudent?: boolean
}

export interface IncomeTaxResult {
  salaryGross: number
  salaryIncome: number
  totalIncome: number
  deductions: Deduction[]
  totalDeductions: number
  taxableIncome: number
  rate: number
  baseTax: number
  reconstructionTax: number
  /** 納めるべき所得税(復興特別所得税を含む、100円未満切り捨て) */
  tax: number
  steps: CalcStep[]
}

export function insuranceDeduction(premiums: LifeInsurancePremiums, cfg: InsuranceDeductionConfig): number {
  const each = [premiums.general, premiums.medical, premiums.pension].map((p) =>
    p > 0 ? Math.ceil(applySteps(cfg.steps, p)) : 0,
  )
  return Math.min(cfg.totalCap, sum(each))
}

/** 扶養控除・特定親族特別控除の内訳 */
export function dependentDeductions(dependents: Relative[], rules: Rules): Deduction[] {
  const d = rules.incomeTax.dependent
  const out: Deduction[] = []
  dependents.forEach((p, i) => {
    const who = `扶養親族${dependents.length > 1 ? i + 1 : ''}(${p.age}歳)`
    if (p.age < 16) return
    if (p.income <= d.incomeLimit) {
      let amount = d.general
      let kind = '一般の扶養控除'
      if (p.age >= 19 && p.age <= 22) {
        amount = d.specific
        kind = '特定扶養控除'
      } else if (p.age >= 70) {
        amount = p.cohabitingParent ? d.elderlyCohabiting : d.elderly
        kind = '老人扶養控除'
      }
      out.push({ key: `dependent${i}`, name: `${kind}:${who}`, amount })
    } else if (p.age >= 19 && p.age <= 22) {
      const amount = lookupAmount(rules.incomeTax.specificRelative.rows, p.income, 0)
      if (amount > 0) out.push({ key: `specificRelative${i}`, name: `特定親族特別控除:${who}`, amount })
    }
  })
  return out
}

export function taxFromTaxable(taxable: number, rules: Rules): { rate: number; baseTax: number; reconstructionTax: number; tax: number } {
  if (taxable <= 0) return { rate: 0, baseTax: 0, reconstructionTax: 0, tax: 0 }
  const b = rules.incomeTax.rates.find((r) => r.upTo === null || taxable <= r.upTo)!
  const baseTax = Math.max(0, Math.floor(clean(taxable * b.rate - b.deduct)))
  // 所得税と復興特別所得税(基本の税額 × 2.1%)の合計を100円未満切り捨て
  const tax = floorTo(baseTax * (1 + rules.incomeTax.reconstructionRate), 100)
  return { rate: b.rate, baseTax, reconstructionTax: tax - baseTax, tax }
}

export function computeIncomeTax(input: IncomeTaxInput, rules: Rules): IncomeTaxResult {
  const it = rules.incomeTax
  const gross = input.salaryGross ?? 0
  const sIncome = salaryIncome(gross, rules)
  const totalIncome = sIncome + (input.otherIncome ?? 0)
  const steps: CalcStep[] = []

  steps.push({ label: '給与の収入(額面)', value: gross })
  steps.push({
    label: '給与所得控除',
    formula: `会社員の「みなし経費」。額面 ${man(gross)} に応じて決まる`,
    value: gross - sIncome,
  })
  steps.push({ label: '給与所得', formula: `${man(gross)} − ${man(gross - sIncome)}`, value: sIncome })
  if (input.otherIncome) steps.push({ label: 'その他の所得', value: input.otherIncome })

  const deductions: Deduction[] = []
  if (input.socialInsurance > 0)
    deductions.push({ key: 'socialInsurance', name: '社会保険料控除', amount: input.socialInsurance })
  if (input.ideco && input.ideco > 0)
    deductions.push({ key: 'ideco', name: '小規模企業共済等掛金控除(iDeCo)', amount: input.ideco })
  if (input.lifeInsurance) {
    const a = insuranceDeduction(input.lifeInsurance, it.lifeInsurance)
    if (a > 0) deductions.push({ key: 'lifeInsurance', name: '生命保険料控除', amount: a })
  }
  if (input.earthquakePremium && input.earthquakePremium > 0) {
    const a = Math.min(it.earthquakeInsurance.cap, input.earthquakePremium * it.earthquakeInsurance.rate)
    deductions.push({ key: 'earthquake', name: '地震保険料控除', amount: a })
  }
  if (input.medicalExpenses && input.medicalExpenses > 0) {
    const floor = Math.min(it.medical.floor, Math.floor(totalIncome * it.medical.incomeRate))
    const a = Math.min(it.medical.cap, Math.max(0, input.medicalExpenses - floor))
    if (a > 0) deductions.push({ key: 'medical', name: '医療費控除', amount: a })
  }
  if (input.workingStudent && totalIncome <= it.workingStudent.incomeLimit) {
    deductions.push({ key: 'workingStudent', name: '勤労学生控除', amount: it.workingStudent.amount })
  }
  deductions.push(...dependentDeductions(input.dependents ?? [], rules))
  deductions.push({ key: 'basic', name: '基礎控除', amount: lookupAmount(it.basicDeduction, totalIncome) })

  const totalDeductions = sum(deductions.map((d) => d.amount))
  steps.push({
    label: '所得控除の合計',
    formula: deductions.map((d) => `${d.name} ${man(d.amount)}`).join(' + '),
    value: totalDeductions,
  })
  const taxableIncome = Math.max(0, floorTo(totalIncome - totalDeductions, 1000))
  steps.push({
    label: '課税所得',
    formula: `${man(totalIncome)} − ${man(totalDeductions)}(1,000円未満は切り捨て)`,
    value: taxableIncome,
  })
  const t = taxFromTaxable(taxableIncome, rules)
  steps.push({
    label: '所得税(基本)',
    formula: t.rate > 0 ? `課税所得 × ${Math.round(t.rate * 100)}% − 控除額` : '課税所得が0円なので0円',
    value: t.baseTax,
  })
  steps.push({
    label: '所得税+復興特別所得税',
    formula: `基本の税額 × 102.1%(100円未満は切り捨て)`,
    value: t.tax,
  })

  return {
    salaryGross: gross,
    salaryIncome: sIncome,
    totalIncome,
    deductions,
    totalDeductions,
    taxableIncome,
    rate: t.rate,
    baseTax: t.baseTax,
    reconstructionTax: t.reconstructionTax,
    tax: t.tax,
    steps,
  }
}
