import type { Rules } from './types'
import { computeIncomeTax } from './incomeTax'
import { computeResidentTax } from './residentTax'
import { maxSalaryForIncome, salaryIncome } from './salary'
import { monthlySocialInsurance } from './socialInsurance'

/** 年収の「壁」(給与だけの場合の年収ライン)を設定値から計算する */
export interface IncomeWall {
  id: string
  amount: number
  title: string
  whatHappens: string
}

export function computeWalls(rules: Rules, age: number): IncomeWall[] {
  const it = rules.incomeTax
  const basicMax = it.basicDeduction[0].amount
  const walls: IncomeWall[] = [
    {
      id: 'residentTax',
      amount: maxSalaryForIncome(rules.residentTax.nonTaxableIncomeSingle, rules),
      title: '住民税がかかり始める',
      whatHappens: '翌年の住民税(まずは均等割5,000円から)がかかる。※自治体によって少し違う',
    },
    {
      id: 'incomeTax',
      amount: maxSalaryForIncome(basicMax, rules),
      title: '自分に所得税がかかり始める',
      whatHappens: `基礎控除${basicMax / 10000}万円+給与所得控除${it.salaryDeduction.minimum / 10000}万円を超えた分に所得税`,
    },
    {
      id: 'parentDependent',
      amount: maxSalaryForIncome(it.dependent.incomeLimit, rules),
      title: '親の扶養控除が外れる',
      whatHappens:
        age >= 19 && age <= 22
          ? '親は「特定扶養控除」の代わりに「特定親族特別控除」を受けられる。控除は少しずつ減る'
          : '親の扶養控除(38万円)がなくなり、親の税金が増える',
    },
  ]
  if (age >= 19 && age <= 22) {
    const last = it.specificRelative.rows[it.specificRelative.rows.length - 1]
    walls.push({
      id: 'specificRelative',
      amount: maxSalaryForIncome(last.upTo ?? 0, rules),
      title: '親の特定親族特別控除もゼロに',
      whatHappens: '親の税金の控除がまったくなくなる',
    })
  }
  if (age >= 16 && age <= 22) {
    // 勤労学生控除(学生の場合)
    walls.push({
      id: 'workingStudent',
      amount: maxSalaryForIncome(it.workingStudent.incomeLimit, rules),
      title: '勤労学生控除が使えなくなる',
      whatHappens: '学生なら、ここまでは勤労学生控除(27万円)で所得税がさらに軽くなる',
    })
  }
  walls.push({
    id: 'socialDependent',
    amount:
      age >= 19 && age <= 22 ? rules.walls.socialDependentAnnualAge19to22 : rules.walls.socialDependentAnnual,
    title: '親の健康保険の扶養から外れる',
    whatHappens: '自分で国民健康保険などに入る必要がある(見込みの年収で判定)',
  })
  return walls.sort((a, b) => a.amount - b.amount)
}

export interface StudentJobAnalysis {
  salary: number
  ownIncomeTax: number
  ownResidentTaxNextYear: number
  /** 親の健康保険の扶養から外れた場合に自分で払う国民健康保険料(概算) */
  ownHealthInsurance: number
  parentTaxIncrease: number
  netForStudent: number
  familyNet: number
}

/**
 * 学生アルバイトの年収ごとに、本人と親のお金がどう変わるか(家族全体の損得)を計算する。
 * 学生は原則として会社の社会保険・雇用保険の対象外(昼間学生)として扱う。
 */
export function analyzeStudentJob(salary: number, age: number, parentSalary: number, rules: Rules): StudentJobAnalysis {
  const isStudentAge = age >= 16 && age <= 22
  const own = computeIncomeTax({ salaryGross: salary, socialInsurance: 0, workingStudent: isStudentAge }, rules)
  const childIncome = salaryIncome(salary, rules)

  const limit = age >= 19 && age <= 22 ? rules.walls.socialDependentAnnualAge19to22 : rules.walls.socialDependentAnnual
  let ownHealthInsurance = 0
  if (salary >= limit) {
    const n = rules.socialInsurance.nationalHealthApprox
    const base = Math.max(0, childIncome - 430000)
    ownHealthInsurance = Math.min(n.cap, Math.floor(base * n.incomeRate + n.perCapita))
  }
  const ownResident = computeResidentTax(
    { salaryGross: salary, socialInsurance: ownHealthInsurance, workingStudent: isStudentAge, minor: age < 18 },
    rules,
  )

  const parentSI = monthlySocialInsurance(parentSalary / 12, 50, rules).total * 12
  const parentTax = (childInc: number) => {
    const dependents = [{ age, income: childInc }]
    const i = computeIncomeTax({ salaryGross: parentSalary, socialInsurance: parentSI, dependents }, rules).tax
    const r = computeResidentTax({ salaryGross: parentSalary, socialInsurance: parentSI, dependents }, rules).total
    return i + r
  }
  const parentTaxIncrease = parentTax(childIncome) - parentTax(0)
  const netForStudent = salary - own.tax - ownResident.total - ownHealthInsurance
  return {
    salary,
    ownIncomeTax: own.tax,
    ownResidentTaxNextYear: ownResident.total,
    ownHealthInsurance,
    parentTaxIncrease,
    netForStudent,
    familyNet: netForStudent - parentTaxIncrease,
  }
}
