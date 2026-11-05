import base2026 from './2026.json'
import patch2028 from './2028.json'
import type { Rules } from '../engine/types'

/**
 * 制度モード
 * - fixed2026: ゲーム内のすべての年に「令和8年分(2026年)の制度」がずっと続くと仮定する(既定)
 * - statutory: 成立済みの法律どおり。2028年以降は令和8・9年分限りの特例が終わった値を使う
 * どちらのモードでも、それより先の年は最後の設定がずっと続くと仮定する。
 */
export type RulesMode = 'fixed2026' | 'statutory'

type Json = unknown

function isPlainObject(v: Json): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** オブジェクトは再帰的にマージし、配列や値は上書きする */
export function deepMerge<T>(base: T, patch: Json): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch ?? base) as T
  const out: Record<string, Json> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    out[k] = k in out ? deepMerge(out[k], v) : v
  }
  return out as T
}

const RULES_2026 = base2026 as unknown as Rules
const RULES_2028 = deepMerge(RULES_2026, patch2028)

export const LATEST_RULES_YEAR = 2026

export function getRules(year: number, mode: RulesMode = 'fixed2026'): Rules {
  if (mode === 'statutory' && year >= 2028) return RULES_2028
  return RULES_2026
}
