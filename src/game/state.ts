import { getRules } from '../rules'
import type { RulesMode } from '../rules'
import type { Rules } from '../engine'
import type { GameState, GaugeDelta, Gauges, MoneyLog, YearRecord } from './types'
import { BADGES } from './badges'

export const SAVE_KEY = 'life-money-simulator:save:v2'

export function newGame(name: string, rulesMode: RulesMode): GameState {
  return {
    version: 2,
    name: name.trim() || 'あなた',
    rulesMode,
    birthYear: 2026,
    sceneId: 'birth',
    age: 0,
    savings: 0,
    parentSalary: 6_000_000,
    flags: {},
    records: [],
    logs: [],
    badges: [],
    gauges: { money: 40, toku: 40, happy: 40 },
    missions: {},
    cards: [],
    residentLevies: {},
    seed: Math.floor(Math.random() * 2 ** 31),
  }
}

export function rulesFor(s: GameState, age = s.age): Rules {
  return getRules(s.birthYear + age, s.rulesMode)
}

export function yearOf(s: GameState, age = s.age): number {
  return s.birthYear + age
}

/** 再現できる乱数(セーブ/ロードしても同じ結果になる) */
export function rand(s: GameState, salt: string): number {
  let h = s.seed ^ 0x9e3779b9
  for (let i = 0; i < salt.length; i++) {
    h = Math.imul(h ^ salt.charCodeAt(i), 0x85ebca6b)
    h ^= h >>> 13
  }
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 2 ** 32
}

export function addLog(s: GameState, log: Omit<MoneyLog, 'age'> & { age?: number }): GameState {
  return { ...s, logs: [...s.logs, { age: log.age ?? s.age, ...log }] }
}

export function addBadge(s: GameState, id: keyof typeof BADGES): GameState {
  if (s.badges.includes(id)) return s
  return { ...s, badges: [...s.badges, id] }
}

export function upsertRecord(s: GameState, r: YearRecord): GameState {
  const records = s.records.filter((x) => x.age !== r.age)
  records.push(r)
  records.sort((a, b) => a.age - b.age)
  return { ...s, records }
}

export function save(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch {
    // 保存できない環境(プライベートモードなど)でもゲームは続けられる
  }
}

export function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as GameState
    return s.version === 2 ? s : null
  } catch {
    return null
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* noop */
  }
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

/** ゲージを増減する(0〜100に収める) */
export function addGauges(s: GameState, d: GaugeDelta | undefined): GameState {
  if (!d) return s
  const g: Gauges = {
    money: clamp(s.gauges.money + (d.money ?? 0)),
    toku: clamp(s.gauges.toku + (d.toku ?? 0)),
    happy: clamp(s.gauges.happy + (d.happy ?? 0)),
  }
  return { ...s, gauges: g }
}

/** 知識カードを手に入れる */
export function addCard(s: GameState, id: string | undefined): GameState {
  if (!id || s.cards.includes(id)) return s
  return { ...s, cards: [...s.cards, id] }
}

/** 星の数:1回目でヒントなし=3。まちがえるたび・ヒントを見たら1つ減る(最低1) */
export function starsFor(tries: number, hintUsed: boolean): number {
  return Math.max(1, 3 - (tries - 1) - (hintUsed ? 1 : 0))
}

/** ミッションの結果を記録する。成功したら知識カードももらえる */
export function recordMission(
  s: GameState,
  id: string,
  r: { cleared: boolean; tries: number; hintUsed: boolean; card?: string },
): GameState {
  const stars = r.cleared ? starsFor(r.tries, r.hintUsed) : 0
  let n: GameState = { ...s, missions: { ...s.missions, [id]: { stars, tries: r.tries, hintUsed: r.hintUsed } } }
  // 失敗しても、ゼイ吉が教えてくれたカードは手に入る(次に活かせるように)
  n = addCard(n, r.card)
  return n
}

export function totalStars(s: GameState): number {
  return Object.values(s.missions).reduce((a, m) => a + m.stars, 0)
}
