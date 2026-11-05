import { getRules } from '../rules'
import type { RulesMode } from '../rules'
import type { Rules } from '../engine'
import type { GameState, MoneyLog, YearRecord } from './types'
import { BADGES } from './badges'

export const SAVE_KEY = 'life-money-simulator:save:v1'

export function newGame(name: string, rulesMode: RulesMode): GameState {
  return {
    version: 1,
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
    return s.version === 1 ? s : null
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
