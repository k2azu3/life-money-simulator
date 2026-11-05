import type { CalcStep, Deduction, Relative, Rules } from './types'
import type { IncomeTaxInput } from './incomeTax'
import { insuranceDeduction } from './incomeTax'
import { salaryIncome } from './salary'
import { floorTo, lookupAmount, man, sum } from './util'

export interface ResidentTaxInput extends IncomeTaxInput {
  /** 未成年(18歳未満)なら合計所得135万円以下で非課税 */
  minor?: boolean
}

export interface ResidentTaxResult {
  totalIncome: number
  deductions: Deduction[]
  totalDeductions: number
  taxableIncome: number
  incomeLevyBeforeAdjustment: number
  adjustment: number
  /** 所得割 */
  incomeLevy: number
  /** 均等割(森林環境税を含む) */
  perCapita: number
  total: number
  nonTaxable: 'none' | 'all' | 'incomeLevyOnly'
  steps: CalcStep[]
}

function residentDependentDeductions(dependents: Relative[], rules: Rules): { deductions: Deduction[]; diff: number } {
  const it = rules.incomeTax.dependent
  const rt = rules.residentTax
  const deductions: Deduction[] = []
  let diff = 0
  dependents.forEach((p, i) => {
    if (p.age < 16) return
    // 簡略化:扶養の所得要件は所得税と同じ値を使う
    if (p.income <= it.incomeLimit) {
      if (p.age >= 19 && p.age <= 22) {
        deductions.push({ key: `dependent${i}`, name: `特定扶養控除(${p.age}歳)`, amount: rt.dependent.specific })
        diff += rt.adjustment.diff.specific
      } else if (p.age >= 70) {
        const amount = p.cohabitingParent ? rt.dependent.elderlyCohabiting : rt.dependent.elderly
        deductions.push({ key: `dependent${i}`, name: `老人扶養控除(${p.age}歳)`, amount })
        diff += rt.adjustment.diff.general
      } else {
        deductions.push({ key: `dependent${i}`, name: `一般の扶養控除(${p.age}歳)`, amount: rt.dependent.general })
        diff += rt.adjustment.diff.general
      }
    } else if (p.age >= 19 && p.age <= 22) {
      const amount = lookupAmount(rt.specificRelative.rows, p.income, 0)
      if (amount > 0) deductions.push({ key: `specificRelative${i}`, name: `特定親族特別控除(${p.age}歳)`, amount })
    }
  })
  return { deductions, diff }
}

/**
 * 個人住民税(所得割+均等割)。その年の所得に対して、翌年6月から1年かけて払う。
 * 簡略化:都道府県民税と市区町村民税を分けずに計算し、税率は標準税率(10%)、
 * 非課税限度額は1級地(東京23区など)の基準、扶養の所得要件は所得税と同じ値を使う。
 */
export function computeResidentTax(input: ResidentTaxInput, rules: Rules): ResidentTaxResult {
  const rt = rules.residentTax
  const gross = input.salaryGross ?? 0
  const totalIncome = salaryIncome(gross, rules) + (input.otherIncome ?? 0)
  const dependents = input.dependents ?? []
  const steps: CalcStep[] = [{ label: '合計所得金額', value: totalIncome }]

  const n = dependents.length
  const perCapitaLimit = n === 0 ? rt.nonTaxableIncomeSingle : 350000 * (1 + n) + 100000 + 210000
  const incomeLevyLimit = n === 0 ? rt.nonTaxableIncomeSingle : 350000 * (1 + n) + 100000 + 320000

  const empty = (nonTaxable: ResidentTaxResult['nonTaxable'], note: string): ResidentTaxResult => {
    steps.push({ label: '住民税', value: 0, note })
    return {
      totalIncome,
      deductions: [],
      totalDeductions: 0,
      taxableIncome: 0,
      incomeLevyBeforeAdjustment: 0,
      adjustment: 0,
      incomeLevy: 0,
      perCapita: 0,
      total: 0,
      nonTaxable,
      steps,
    }
  }
  if (input.minor && totalIncome <= rt.nonTaxableIncomeMinor) {
    return empty('all', `未成年で所得が${man(rt.nonTaxableIncomeMinor)}以下なので非課税`)
  }
  if (totalIncome <= perCapitaLimit) {
    return empty('all', `所得が${man(perCapitaLimit)}以下なので非課税`)
  }

  const deductions: Deduction[] = []
  if (input.socialInsurance > 0)
    deductions.push({ key: 'socialInsurance', name: '社会保険料控除', amount: input.socialInsurance })
  if (input.ideco && input.ideco > 0)
    deductions.push({ key: 'ideco', name: '小規模企業共済等掛金控除(iDeCo)', amount: input.ideco })
  if (input.lifeInsurance) {
    const a = insuranceDeduction(input.lifeInsurance, rt.lifeInsurance)
    if (a > 0) deductions.push({ key: 'lifeInsurance', name: '生命保険料控除', amount: a })
  }
  if (input.earthquakePremium && input.earthquakePremium > 0) {
    const a = Math.min(rt.earthquakeInsurance.cap, Math.floor(input.earthquakePremium * rt.earthquakeInsurance.rate))
    deductions.push({ key: 'earthquake', name: '地震保険料控除', amount: a })
  }
  if (input.medicalExpenses && input.medicalExpenses > 0) {
    const m = rules.incomeTax.medical
    const floor = Math.min(m.floor, Math.floor(totalIncome * m.incomeRate))
    const a = Math.min(m.cap, Math.max(0, input.medicalExpenses - floor))
    if (a > 0) deductions.push({ key: 'medical', name: '医療費控除', amount: a })
  }
  let diff = rt.adjustment.diff.basic
  if (input.workingStudent && totalIncome <= rules.incomeTax.workingStudent.incomeLimit) {
    deductions.push({ key: 'workingStudent', name: '勤労学生控除', amount: rt.workingStudent })
    diff += rt.adjustment.diff.workingStudent
  }
  const dep = residentDependentDeductions(dependents, rules)
  deductions.push(...dep.deductions)
  diff += dep.diff
  deductions.push({ key: 'basic', name: '基礎控除', amount: lookupAmount(rt.basicDeduction, totalIncome) })

  const totalDeductions = sum(deductions.map((d) => d.amount))
  steps.push({
    label: '所得控除の合計(住民税用)',
    formula: deductions.map((d) => `${d.name} ${man(d.amount)}`).join(' + '),
    value: totalDeductions,
    note: '住民税の控除額は所得税より少し小さい(例:基礎控除は43万円)',
  })
  const taxableIncome = Math.max(0, floorTo(totalIncome - totalDeductions, 1000))
  steps.push({ label: '課税所得(住民税用)', formula: `${man(totalIncome)} − ${man(totalDeductions)}`, value: taxableIncome })

  const before = Math.floor(taxableIncome * rt.incomeRate)
  steps.push({ label: '所得割(調整前)', formula: `課税所得 × ${Math.round(rt.incomeRate * 100)}%`, value: before })

  const a = rt.adjustment
  let adjBase: number
  if (taxableIncome <= a.threshold) adjBase = Math.min(diff, taxableIncome)
  else adjBase = Math.max(diff - (taxableIncome - a.threshold), a.minimumBase)
  const adjustment = totalIncome > 25_000_000 ? 0 : Math.min(before, Math.floor(adjBase * a.rate))
  steps.push({
    label: '調整控除',
    formula: '所得税と住民税の控除額の差による負担増を調整する',
    value: adjustment,
  })

  const levyExempt = totalIncome <= incomeLevyLimit
  const incomeLevy = levyExempt ? 0 : floorTo(before - adjustment, 100)
  steps.push({ label: '所得割', value: incomeLevy, note: levyExempt ? '所得割は非課税ライン以下' : undefined })
  const perCapita = rt.perCapita
  steps.push({ label: '均等割(森林環境税1,000円を含む)', value: perCapita, note: 'ほぼ全員が同じ額を払う「会費」のような部分' })
  const total = incomeLevy + perCapita
  steps.push({ label: '住民税の合計(年額)', value: total })

  return {
    totalIncome,
    deductions,
    totalDeductions,
    taxableIncome,
    incomeLevyBeforeAdjustment: before,
    adjustment,
    incomeLevy,
    perCapita,
    total,
    nonTaxable: levyExempt ? 'incomeLevyOnly' : 'none',
    steps,
  }
}
