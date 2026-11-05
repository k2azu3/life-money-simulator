export const BADGES = {
  savingKid: { icon: '🐷', title: 'お年玉バンク', desc: 'お年玉を全部貯金した' },
  wallWatcher: { icon: '🧱', title: '壁を見きわめた者', desc: '働き損にならない「壁の手前」のバイト年収を選んだ' },
  wall178: { icon: '📏', title: '103万円の壁は昔の話', desc: '令和8年分の「178万円の壁」を知った' },
  firstSalary: { icon: '💴', title: 'はじめての給料', desc: '初めての給与明細を読んだ' },
  nenchoMaster: { icon: '🏅', title: '年末調整マスター', desc: '年末調整の書類を満点で出した' },
  deductionHunter: { icon: '🎯', title: '控除ハンター', desc: '受けられる控除をすべて回収した' },
  kakuteiDebut: { icon: '📮', title: '確定申告デビュー', desc: '自分で確定申告をした' },
  idecoStart: { icon: '🌱', title: 'iDeCoデビュー', desc: '老後のための積立を始めた' },
  part1Clear: { icon: '🎓', title: '第1部クリア', desc: '誕生から初めての年末調整までを体験した' },
} as const

export type BadgeId = keyof typeof BADGES
