import {
  analyzeStudentJob,
  childAllowanceTotal,
  computeIncomeTax,
  computeResidentTax,
  simulateEmploymentYear,
} from '../engine'
import type { Company, FinalReturnOutcome, GameState, YearEndOutcome } from './types'
import { addBadge, addLog, rand, rulesFor, upsertRecord, yearOf } from './state'

export const COMPANIES_UNIV: Company[] = [
  {
    id: 'shoji',
    name: 'マルマル商事',
    monthly: 230_000,
    bonuses: [{ month: 12, amount: 230_000 }],
    blurb: '月給23万円+冬のボーナス(1年目は1か月分)。安定の大企業',
  },
  {
    id: 'venture',
    name: 'ベンチャー・ハヤテ',
    monthly: 270_000,
    bonuses: [],
    blurb: '月給27万円、ボーナスなし。勢いのあるスタートアップ',
  },
]

export const COMPANIES_HIGHSCHOOL: Company[] = [
  {
    id: 'factory',
    name: 'ミライ精機',
    monthly: 190_000,
    bonuses: [{ month: 12, amount: 190_000 }],
    blurb: '月給19万円+冬のボーナス1か月分。ものづくりの会社',
  },
  {
    id: 'shop',
    name: 'ハヤテ物流',
    monthly: 215_000,
    bonuses: [],
    blurb: '月給21.5万円、ボーナスなし',
  },
]

/** 1年目の生活費(家賃・食費など)の月額。手取りから引いて貯金を計算する */
export const LIVING_COST_MONTHLY = 150_000
export const LIFE_INSURANCE_MONTHLY = 5_000
export const EARTHQUAKE_PREMIUM = 9_600

export function enterBirth(s: GameState): GameState {
  if (s.logs.length > 0) return s
  const r = rulesFor(s)
  let n = addLog(s, { text: '出産育児一時金(健康保険から)', amount: r.benefits.birthLumpSum, who: 'family' })
  n = addLog(n, { text: '児童手当(0〜18歳の合計見込み)', amount: childAllowanceTotal(1, r), who: 'family' })
  return n
}

export function chooseOtoshidama(s: GameState, choice: 'all' | 'half' | 'none'): GameState {
  const total = 300_000 // 6〜15歳の10年間、毎年3万円
  const saved = choice === 'all' ? total : choice === 'half' ? total / 2 : 0
  let n: GameState = { ...s, age: 15, flags: { ...s.flags, otoshidama: choice }, savings: s.savings + saved }
  n = addLog(n, { text: 'お年玉の貯金(10年分)', amount: saved, who: 'player' })
  if (rand(s, 'lottery') < 0.3) {
    n = { ...n, savings: n.savings + 10_000, flags: { ...n.flags, lottery: true } }
    n = addLog(n, { text: 'おまけ:宝くじで1万円当せん(非課税)', amount: 10_000, who: 'player' })
  }
  if (choice === 'all') n = addBadge(n, 'savingKid')
  for (let age = 6; age <= 15; age++) {
    n = upsertRecord(n, blankRecord(n, age, '子ども時代'))
  }
  return n
}

function blankRecord(s: GameState, age: number, label: string) {
  return { age, year: yearOf(s, age), label, gross: 0, socialInsurance: 0, incomeTax: 0, residentTax: 0, net: 0, savings: s.savings }
}

/** 学生アルバイトの1年分を記録する(高校生は半分、大学生は3割を貯金できると仮定) */
function studentYear(s: GameState, age: number, salary: number, label: string): GameState {
  const saveRate = age <= 17 ? 0.5 : 0.3
  const r = rulesFor(s, age)
  const a = analyzeStudentJob(salary, age, s.parentSalary, r)
  // 住民税は翌年に払う。前年の分をこの年に払う
  const residentPaid = s.residentLevies[yearOf(s, age - 1)] ?? 0
  const net = salary - a.ownIncomeTax - a.ownHealthInsurance - residentPaid
  const savings = s.savings + Math.floor(net * saveRate)
  let n: GameState = {
    ...s,
    age,
    savings,
    residentLevies: { ...s.residentLevies, [yearOf(s, age)]: a.ownResidentTaxNextYear },
  }
  n = upsertRecord(n, {
    age,
    year: yearOf(s, age),
    label,
    gross: salary,
    socialInsurance: a.ownHealthInsurance,
    incomeTax: a.ownIncomeTax,
    residentTax: residentPaid,
    net,
    savings,
  })
  return n
}

export function chooseHighSchoolJob(s: GameState, salary: number): GameState {
  let n: GameState = { ...s, flags: { ...s.flags, highSchoolJob: salary } }
  n = studentYear(n, 16, salary, '高校生')
  n = studentYear(n, 17, salary, '高校生')
  return { ...n, age: 17 }
}

export function choosePath(s: GameState, path: 'university' | 'universityLoan' | 'work'): GameState {
  const scholarshipDebt = path === 'universityLoan' ? 50_000 * 48 : 0
  let n: GameState = { ...s, age: 18, flags: { ...s.flags, path, scholarshipDebt } }
  if (path === 'universityLoan') {
    n = addLog(n, { text: '貸与型奨学金(4年間・あとで返す借金)', amount: scholarshipDebt, who: 'player' })
  }
  return n
}

export function chooseUniJob(s: GameState, salary: number): GameState {
  let n: GameState = { ...s, flags: { ...s.flags, uniJob: salary } }
  for (let age = 18; age <= 21; age++) n = studentYear(n, age, salary, '大学生')
  // 「壁の手前」を選んだか
  if (uniJobSweetSpot(s) === salary) n = addBadge(n, 'wallWatcher')
  return addBadge({ ...n, age: 21 }, 'wall178')
}

export const UNI_JOB_OPTIONS = [600_000, 1_100_000, 1_300_000, 1_490_000, 1_780_000, 2_000_000]

/** 1つ前の選択肢から年収が増えた分のうち、家族全体の手元に残る割合 */
export function uniJobMarginals(s: GameState) {
  const r = rulesFor(s, 20)
  const a = UNI_JOB_OPTIONS.map((x) => analyzeStudentJob(x, 20, s.parentSalary, r))
  return a.map((x, i) => ({
    analysis: x,
    marginal: i === 0 ? 1 : (x.familyNet - a[i - 1].familyNet) / (x.salary - a[i - 1].salary),
  }))
}

/** 増えた分の9割以上が手元に残る範囲で、一番多い年収(=壁の手前) */
export function uniJobSweetSpot(s: GameState): number {
  const m = uniJobMarginals(s)
  let best = m[0].analysis.salary
  for (const x of m) {
    if (x.marginal >= 0.9) best = x.analysis.salary
    else break
  }
  return best
}
export const HIGH_SCHOOL_JOB_OPTIONS = [0, 360_000, 800_000, 1_200_000]

export function jobStartAge(s: GameState): number {
  return s.flags.path === 'work' ? 18 : 22
}

export function startJob(s: GameState, company: Company): GameState {
  const age = jobStartAge(s)
  const r = rulesFor(s, age)
  const year = simulateEmploymentYear(
    {
      monthlySalary: company.monthly,
      startMonth: 4,
      bonuses: company.bonuses,
      age,
      declaredDependents: [],
      residentTaxJanToMay: 0,
      residentTaxJunToDec: s.residentLevies[yearOf(s, age - 1)] ?? 0,
    },
    r,
  )
  return addBadge(
    {
      ...s,
      age,
      job: {
        company,
        startMonth: 4,
        age,
        payslips: year.payslips,
        grossTotal: year.grossTotal,
        siTotal: year.si.total,
        siBreakdown: {
          health: year.si.health,
          childSupport: year.si.childSupport,
          pension: year.si.pension,
          employment: year.si.employment,
        },
        withheld: year.withheldIncomeTax,
        residentTaxPaid: year.residentTaxPaid,
      },
    },
    'firstSalary',
  )
}

export function chooseFirstYearOptions(
  s: GameState,
  opts: { lifeInsurance: boolean; earthquake: boolean; idecoMonthly: number },
): GameState {
  const injured = rand(s, 'injury') < 0.35
  const medicalExpenses = injured ? 150_000 + Math.floor(rand(s, 'injury-amount') * 4) * 10_000 : 18_000
  let n: GameState = { ...s, flags: { ...s.flags, ...opts, injured, medicalExpenses } }
  if (opts.idecoMonthly > 0) n = addBadge(n, 'idecoStart')
  return n
}

/** 申告書に書ける控除の金額(4〜12月の9か月分) */
export function premiumsPaid(s: GameState) {
  const months = 12 - (s.job?.startMonth ?? 4) + 1
  return {
    lifeInsurance: s.flags.lifeInsurance ? LIFE_INSURANCE_MONTHLY * months : 0,
    lifeInsuranceAsOfSeptember: s.flags.lifeInsurance ? LIFE_INSURANCE_MONTHLY * (9 - (s.job?.startMonth ?? 4) + 1) : 0,
    earthquake: s.flags.earthquake ? EARTHQUAKE_PREMIUM : 0,
    ideco: (s.flags.idecoMonthly ?? 0) * months,
    months,
  }
}

export function finishYearEnd(s: GameState, outcome: YearEndOutcome): GameState {
  let n: GameState = { ...s, yearEnd: outcome }
  if (outcome.submitted && outcome.score === 100) n = addBadge(n, 'nenchoMaster')
  if (outcome.submitted && outcome.refund >= outcome.bestRefund) n = addBadge(n, 'deductionHunter')
  return n
}

export function finishFinalReturn(s: GameState, outcome: FinalReturnOutcome): GameState {
  let n: GameState = { ...s, finalReturn: outcome }
  n = addBadge(n, 'kakuteiDebut')
  if (s.yearEnd && s.yearEnd.refund + outcome.refund >= s.yearEnd.bestRefund) n = addBadge(n, 'deductionHunter')
  return n
}

/** 1年目を締める:最終的な税額・住民税(翌年分)・貯金を確定する */
export function closeFirstYear(s: GameState): GameState {
  const job = s.job
  if (!job) return s
  const r = rulesFor(s, job.age)
  const p = premiumsPaid(s)
  const ye = s.yearEnd
  const fr = s.finalReturn
  const finalIncomeTax = job.withheld - (ye?.refund ?? 0) - (fr?.refund ?? 0)
  const net = job.grossTotal - job.siTotal - finalIncomeTax - job.residentTaxPaid
  const living = LIVING_COST_MONTHLY * p.months
  const spent = living + p.lifeInsurance + p.earthquake + p.ideco + (s.flags.medicalExpenses ?? 0)
  const savings = s.savings + net - spent

  // 来年の住民税(1年目の所得に対して)。確定申告した控除も住民税に反映される
  // 簡略化:確定申告をした場合は、受けられる控除をすべて申告したものとして計算する
  const declared = fr
    ? {
        lifeInsurance: p.lifeInsurance ? { general: p.lifeInsurance, medical: 0, pension: 0 } : undefined,
        earthquakePremium: p.earthquake || undefined,
        ideco: p.ideco || undefined,
      }
    : ye?.declared
  const levy = computeResidentTax(
    {
      salaryGross: job.grossTotal,
      socialInsurance: job.siTotal,
      lifeInsurance: declared?.lifeInsurance,
      earthquakePremium: declared?.earthquakePremium,
      ideco: declared?.ideco,
      medicalExpenses: fr ? s.flags.medicalExpenses : undefined,
    },
    r,
  ).total

  let n: GameState = {
    ...s,
    savings,
    residentLevies: { ...s.residentLevies, [yearOf(s, job.age)]: levy },
  }
  n = upsertRecord(n, {
    age: job.age,
    year: yearOf(s, job.age),
    label: '社会人1年目',
    gross: job.grossTotal,
    socialInsurance: job.siTotal,
    incomeTax: finalIncomeTax,
    residentTax: job.residentTaxPaid,
    net,
    savings,
  })
  return addBadge(n, 'part1Clear')
}

/** 「もしも」:別の会社を選んでいたら1年目の手取りはいくら? */
export function whatIfCompany(s: GameState, company: Company) {
  const age = jobStartAge(s)
  const r = rulesFor(s, age)
  const y = simulateEmploymentYear(
    {
      monthlySalary: company.monthly,
      startMonth: 4,
      bonuses: company.bonuses,
      age,
      declaredDependents: [],
      residentTaxJanToMay: 0,
      residentTaxJunToDec: s.residentLevies[yearOf(s, age - 1)] ?? 0,
    },
    r,
  )
  const tax = computeIncomeTax({ salaryGross: y.grossTotal, socialInsurance: y.si.total }, r).tax
  return { gross: y.grossTotal, net: y.grossTotal - y.si.total - tax - y.residentTaxPaid }
}
