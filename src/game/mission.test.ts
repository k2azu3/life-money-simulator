import { describe, expect, it } from 'vitest'
import { addGauges, newGame, recordMission, starsFor, totalStars } from './state'
import { MISSIONS } from '../content/missions'
import { COMPANIES_UNIV, choosePath, startJob } from './actions'

describe('ゲージ・星・知識カード', () => {
  it('ゲージは40から始まり、0〜100に収まる', () => {
    const s = newGame('t', 'fixed2026')
    expect(s.gauges).toEqual({ money: 40, toku: 40, happy: 40 })
    const n = addGauges(s, { money: 80, toku: -70 })
    expect(n.gauges.money).toBe(100)
    expect(n.gauges.toku).toBe(0)
  })

  it('星は1回目・ヒントなしで3つ。まちがいとヒントで減り、最低1つ', () => {
    expect(starsFor(1, false)).toBe(3)
    expect(starsFor(2, false)).toBe(2)
    expect(starsFor(1, true)).toBe(2)
    expect(starsFor(5, true)).toBe(1)
  })

  it('ミッションを記録すると、知識カードが手に入り星が合計される', () => {
    let s = recordMission(newGame('t', 'fixed2026'), 'birthApply', { cleared: true, tries: 1, hintUsed: false, card: 'birth' })
    s = recordMission(s, 'gift', { cleared: false, tries: 3, hintUsed: true, card: 'otoshidama' })
    expect(s.cards).toEqual(['birth', 'otoshidama'])
    expect(totalStars(s)).toBe(3)
    expect(s.missions.gift.stars).toBe(0)
  })
})

describe('ミッションの正解', () => {
  const s = newGame('t', 'fixed2026')
  const okIds = (id: string, st = s) => MISSIONS[id].options!(st).filter((o) => o.ok).map((o) => o.id)

  it('選択肢型のミッションは、正解がちょうど1つ', () => {
    for (const id of ['birthApply', 'gift', 'hsJob', 'scholarship', 'walls', 'residentQuiz']) {
      expect(okIds(id).length).toBe(1)
    }
  })

  it('高校生バイト:親の税金も自分の保険料も増えない最大は120万円(150万円は両方増える)', () => {
    expect(okIds('hsJob')).toEqual(['1200000'])
    const over = MISSIONS.hsJob.options!(s).find((o) => o.id === '1500000')!
    expect(over.feedback).toContain('親の税金')
  })

  it('大学生バイト:正解は壁の手前の149万円で、選ぶとバイト年収が記録される', () => {
    expect(okIds('walls')).toEqual(['1490000'])
    const n = MISSIONS.walls.onClear!(s, '1490000')
    expect(n.flags.uniJob).toBe(1_490_000)
  })

  it('贈与:こっそりもらうズルを選ぶと徳が下がる', () => {
    const secret = MISSIONS.gift.options!(s).find((o) => o.id === 'secret')!
    expect(secret.ok).toBe(false)
    expect(secret.penalty?.toku).toBeLessThan(0)
  })

  it('初任給の手取り:正解の選択肢は給与明細の手取りと一致する', () => {
    const job = startJob(choosePath(s, 'university'), COMPANIES_UNIV[0])
    const net = job.job!.payslips[0].net
    const ok = MISSIONS.takeHome.options!(job).find((o) => o.ok)!
    expect(ok.label).toBe(`約${(Math.round(net / 1000) / 10).toFixed(1)}万円`)
  })
})
