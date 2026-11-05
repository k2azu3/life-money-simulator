import { describe, expect, it } from 'vitest'
import { getRules } from '../rules'
import {
  analyzeStudentJob,
  bonusSocialInsurance,
  childAllowanceTotal,
  computeIncomeTax,
  computeResidentTax,
  computeWalls,
  insuranceDeduction,
  maxSalaryForIncome,
  monthlySocialInsurance,
  roundEmployeeShare,
  salaryIncome,
  simulateEmploymentYear,
  yearEndAdjustment,
  finalReturn,
} from './index'

const R = getRules(2026)
const R2028 = getRules(2028, 'statutory')

describe('給与所得(令和8年分)', () => {
  it.each([
    [500_000, 0], // 最低保障74万円以下なら所得0
    [1_000_000, 260_000], // 100万 − 74万
    [1_780_000, 1_040_000], // 178万 − 74万
    [2_191_500, 1_451_000], // 国税庁パンフレットの特例表(219.1万〜219.3万)
    [2_195_000, 1_453_000],
    [2_199_999, 1_456_000],
    [2_200_000, 1_460_000], // 220万 × 70% − 8万
    [3_001_000, 2_020_000], // 4,000円単位で切り捨て:300万×70%−8万
    [5_000_000, 3_560_000], // 500万 × 80% − 44万
    [7_000_000, 5_200_000], // 700万 − (70万 + 110万)
    [10_000_000, 8_050_000], // 1000万 − 195万(上限)
  ])('給与収入 %i 円 → 給与所得 %i 円', (gross, expected) => {
    expect(salaryIncome(gross, R)).toBe(expected)
  })

  it('令和10年分以後(法定モード)は最低保障69万円', () => {
    expect(salaryIncome(1_000_000, R2028)).toBe(310_000)
  })
})

describe('年収の壁(令和8年分の設定値から計算)', () => {
  const walls = Object.fromEntries(computeWalls(R, 20).map((w) => [w.id, w.amount]))
  it('所得税の壁は178万円(基礎控除104万+給与所得控除74万)', () => expect(walls.incomeTax).toBe(1_780_000))
  it('住民税の壁は119万円(非課税限度45万+74万)', () => expect(walls.residentTax).toBe(1_190_000))
  it('親の扶養控除の壁は136万円', () => expect(walls.parentDependent).toBe(1_360_000))
  it('特定親族特別控除がゼロになる壁は197万円', () => expect(walls.specificRelative).toBe(1_970_000))
  it('勤労学生控除の壁は163万円', () => expect(walls.workingStudent).toBe(1_630_000))
  it('19〜22歳の社会保険の扶養は150万円', () => expect(walls.socialDependent).toBe(1_500_000))
  it('maxSalaryForIncome は境界ちょうどを返す', () => {
    expect(salaryIncome(maxSalaryForIncome(1_040_000, R) + 1000, R)).toBeGreaterThan(1_040_000)
  })
})

describe('社会保険料(協会けんぽ東京 2026年度)', () => {
  it('端数処理:50銭以下切り捨て、50銭超切り上げ', () => {
    expect(roundEmployeeShare(100.5)).toBe(100)
    expect(roundEmployeeShare(100.51)).toBe(101)
    expect(roundEmployeeShare(20192.499999999)).toBe(20192)
  })

  it('月給416,667円・30歳(標準報酬月額41万円)', () => {
    const si = monthlySocialInsurance(416_667, 30, R)
    expect(si.health).toBe(20_192) // 410,000 × 9.85% ÷ 2 = 20,192.5
    expect(si.childSupport).toBe(471) // 410,000 × 0.23% ÷ 2 = 471.5
    expect(si.pension).toBe(37_515) // 410,000 × 18.3% ÷ 2
    expect(si.employment).toBe(2_083) // 416,667 × 0.5% = 2,083.3
    expect(si.total).toBe(60_261)
  })

  it('45歳は介護保険料が加わる', () => {
    const si = monthlySocialInsurance(416_667, 45, R)
    expect(si.health).toBe(23_513) // 410,000 × (9.85% + 1.62%) ÷ 2 = 23,513.5
  })

  it('厚生年金の標準報酬月額は65万円が上限', () => {
    const si = monthlySocialInsurance(1_000_000, 30, R)
    expect(si.pension).toBe(59_475) // 650,000 × 9.15%
  })

  it('賞与:標準賞与額は1,000円未満切り捨て、厚生年金は1回150万円が上限', () => {
    const b = bonusSocialInsurance(2_000_500, 30, R)
    expect(b.standardBonus).toBe(2_000_000)
    expect(b.pension).toBe(137_250) // 1,500,000 × 9.15%
  })
})

describe('年収500万円・独身・扶養なし・30歳の1年分', () => {
  // 社会保険料:月60,261円 × 12 = 723,132円(上のテスト参照)
  const si = 60_261 * 12

  it('所得税:給与所得356万 − 社保72.3万 − 基礎控除104万 → 課税所得179.6万 × 5% × 1.021', () => {
    const t = computeIncomeTax({ salaryGross: 5_000_000, socialInsurance: si }, R)
    expect(t.salaryIncome).toBe(3_560_000)
    expect(t.deductions.find((d) => d.key === 'basic')?.amount).toBe(1_040_000)
    expect(t.taxableIncome).toBe(1_796_000)
    expect(t.baseTax).toBe(89_800)
    expect(t.tax).toBe(91_600) // 89,800 × 1.021 = 91,685.8 → 100円未満切り捨て
  })

  it('住民税:課税所得240.6万 × 10% − 調整控除2,500 + 均等割5,000', () => {
    const r = computeResidentTax({ salaryGross: 5_000_000, socialInsurance: si }, R)
    expect(r.taxableIncome).toBe(2_406_000)
    expect(r.incomeLevyBeforeAdjustment).toBe(240_600)
    expect(r.adjustment).toBe(2_500)
    expect(r.incomeLevy).toBe(238_100)
    expect(r.total).toBe(243_100)
  })

  it('手取りはおよそ394万円(額面の約79%)', () => {
    const t = computeIncomeTax({ salaryGross: 5_000_000, socialInsurance: si }, R).tax
    const r = computeResidentTax({ salaryGross: 5_000_000, socialInsurance: si }, R).total
    const net = 5_000_000 - si - t - r
    expect(net).toBe(3_942_168)
  })

  it('法定モードの2028年は基礎控除が62万円に戻り、所得税が増える', () => {
    const t = computeIncomeTax({ salaryGross: 5_000_000, socialInsurance: si }, R2028)
    expect(t.deductions.find((d) => d.key === 'basic')?.amount).toBe(620_000)
    expect(t.taxableIncome).toBe(2_216_000)
    expect(t.tax).toBe(126_700) // (221.6万×10% − 97,500) × 1.021 = 126,706.1
  })
})

describe('控除の計算', () => {
  it('生命保険料控除(新契約)', () => {
    const cfg = R.incomeTax.lifeInsurance
    expect(insuranceDeduction({ general: 20_000, medical: 0, pension: 0 }, cfg)).toBe(20_000)
    expect(insuranceDeduction({ general: 30_000, medical: 0, pension: 0 }, cfg)).toBe(25_000)
    expect(insuranceDeduction({ general: 60_000, medical: 0, pension: 0 }, cfg)).toBe(35_000)
    expect(insuranceDeduction({ general: 100_000, medical: 100_000, pension: 100_000 }, cfg)).toBe(120_000)
  })

  it('医療費控除:10万円(または所得の5%)を超えた分', () => {
    const t = computeIncomeTax({ salaryGross: 3_000_000, socialInsurance: 0, medicalExpenses: 150_000 }, R)
    expect(t.deductions.find((d) => d.key === 'medical')?.amount).toBe(50_000)
  })

  it('扶養控除:16歳は一般38万、20歳は特定63万、15歳は対象外', () => {
    const t = computeIncomeTax(
      {
        salaryGross: 6_000_000,
        socialInsurance: 0,
        dependents: [
          { age: 15, income: 0 },
          { age: 16, income: 0 },
          { age: 20, income: 0 },
        ],
      },
      R,
    )
    const amounts = t.deductions.filter((d) => d.key.startsWith('dependent')).map((d) => d.amount)
    expect(amounts).toEqual([380_000, 630_000])
  })

  it('特定親族特別控除:20歳の子の所得100万円なら41万円', () => {
    const t = computeIncomeTax(
      { salaryGross: 6_000_000, socialInsurance: 0, dependents: [{ age: 20, income: 1_000_000 }] },
      R,
    )
    expect(t.deductions.find((d) => d.key.startsWith('specificRelative'))?.amount).toBe(410_000)
  })
})

describe('学生アルバイトと親の税金', () => {
  it('年収178万円なら本人の所得税は0円、180万円なら1,000円', () => {
    expect(analyzeStudentJob(1_780_000, 20, 6_000_000, R).ownIncomeTax).toBe(0)
    expect(analyzeStudentJob(1_800_000, 20, 6_000_000, R).ownIncomeTax).toBe(1_000) // 2万×5%×1.021
  })

  it('20歳で149万円までなら親の税金は増えない(特定親族特別控除が63万円のまま)', () => {
    expect(analyzeStudentJob(1_490_000, 20, 6_000_000, R).parentTaxIncrease).toBe(0)
  })

  it('20歳で200万円なら親の控除(所得税63万・住民税45万)がなくなり親の税金が増える', () => {
    // 親(年収600万)の課税所得は5%と10%の境目付近:所得税 約5.5万 + 住民税 4.5万
    expect(analyzeStudentJob(2_000_000, 20, 6_000_000, R).parentTaxIncrease).toBe(99_600)
  })

  it('150万円以上だと社会保険の扶養から外れて国保に入る', () => {
    expect(analyzeStudentJob(1_490_000, 20, 6_000_000, R).ownHealthInsurance).toBe(0)
    expect(analyzeStudentJob(1_500_000, 20, 6_000_000, R).ownHealthInsurance).toBeGreaterThan(0)
  })

  it('高校生(未成年)は所得135万円以下なら住民税非課税', () => {
    expect(analyzeStudentJob(1_500_000, 17, 6_000_000, R).ownResidentTaxNextYear).toBe(0)
  })
})

describe('新卒1年目(4月入社)の給与と年末調整', () => {
  const year = simulateEmploymentYear(
    {
      monthlySalary: 230_000,
      startMonth: 4,
      bonuses: [{ month: 12, amount: 230_000 }],
      age: 22,
      declaredDependents: [],
      residentTaxJanToMay: 0,
      residentTaxJunToDec: 0,
    },
    R,
  )

  it('4〜12月の9か月分+冬の賞与', () => {
    expect(year.payslips.filter((p) => p.kind === '給与')).toHaveLength(9)
    expect(year.grossTotal).toBe(230_000 * 10)
  })

  it('月給23万円の社会保険料(標準報酬月額24万円)', () => {
    const p = year.payslips[0]
    expect(p.si.health).toBe(11_820) // 240,000 × 4.925%
    expect(p.si.pension).toBe(21_960) // 240,000 × 9.15%
    expect(p.si.employment).toBe(1_150)
  })

  it('12か月分を前提に天引きされるので、1年目は年末調整で還付になる', () => {
    const ye = yearEndAdjustment(year.grossTotal, year.si.total, year.withheldIncomeTax, { dependents: [] }, R)
    expect(ye.refund).toBeGreaterThan(0)
    expect(ye.refund).toBe(year.withheldIncomeTax - ye.tax.tax)
  })

  it('生命保険料控除を申告すると還付が増える(または同じ)', () => {
    const base = yearEndAdjustment(year.grossTotal, year.si.total, year.withheldIncomeTax, { dependents: [] }, R)
    const withIns = yearEndAdjustment(
      year.grossTotal,
      year.si.total,
      year.withheldIncomeTax,
      { dependents: [], lifeInsurance: { general: 60_000, medical: 0, pension: 0 }, ideco: 276_000 },
      R,
    )
    expect(withIns.refund).toBeGreaterThanOrEqual(base.refund)
  })

  it('確定申告で医療費控除を追加すると、さらに還付される', () => {
    const fr = finalReturn(
      {
        grossTotal: 4_000_000,
        socialInsurance: 580_000,
        dependents: [],
        medicalExpenses: 300_000,
        alreadyPaid: computeIncomeTax({ salaryGross: 4_000_000, socialInsurance: 580_000 }, R).tax,
      },
      R,
    )
    expect(fr.refund).toBe(10_200) // 課税所得114万(税率5%):医療費控除20万 × 5% × 1.021 = 10,210 → 100円単位
  })
})

describe('児童手当', () => {
  it('第1子:0〜2歳 月1.5万、3〜18歳 月1万(年単位に簡略化)', () => {
    expect(childAllowanceTotal(1, R)).toBe(15_000 * 36 + 10_000 * 12 * 16)
  })
})
