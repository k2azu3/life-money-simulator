import { describe, expect, it } from 'vitest'
import { newGame } from './state'
import { chooseUniJob, closeFirstYear, finishYearEnd, startJob, uniJobMarginals, uniJobSweetSpot, COMPANIES_UNIV, COMPANIES_HIGHSCHOOL, choosePath, chooseHighSchoolJob } from './actions'

describe('ゲーム進行', () => {
  it('大学生バイトの「壁の手前」は149万円(150万円以上で社会保険の扶養から外れる)', () => {
    const s = newGame('t', 'fixed2026')
    expect(uniJobSweetSpot(s)).toBe(1_490_000)
    const m = uniJobMarginals(s).find((x) => x.analysis.salary === 1_780_000)!
    expect(m.marginal).toBeLessThan(0.5)
    expect(chooseUniJob(s, 1_490_000).badges).toContain('wallWatcher')
  })

  it('前年のバイト代に住民税がかかると、就職1年目の6月から天引きされる', () => {
    let s = choosePath(newGame('t', 'fixed2026'), 'university')
    s = chooseUniJob(s, 1_780_000)
    s = startJob(s, COMPANIES_UNIV[0])
    const june = s.job!.payslips.find((p) => p.month === 6 && p.kind === '給与')!
    const april = s.job!.payslips.find((p) => p.month === 4)!
    expect(april.residentTax).toBe(0)
    expect(june.residentTax).toBeGreaterThan(0)
  })

  it('高卒ルート:18歳で就職し、1年目を締めると翌年の住民税が決まる', () => {
    let s = chooseHighSchoolJob(newGame('t', 'fixed2026'), 800_000)
    s = choosePath(s, 'work')
    s = startJob(s, COMPANIES_HIGHSCHOOL[0])
    expect(s.job!.age).toBe(18)
    s = finishYearEnd(s, { submitted: true, declared: {}, annualTax: 0, refund: 0, bestRefund: 0, score: 100, mistakes: [], steps: [] })
    s = closeFirstYear(s)
    expect(s.residentLevies[2026 + 18]).toBeGreaterThan(0)
    expect(s.records.find((r) => r.age === 18)?.gross).toBe(190_000 * 10)
  })
})
