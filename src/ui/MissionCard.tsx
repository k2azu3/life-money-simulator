import { useState } from 'react'
import type { ReactNode } from 'react'
import { MISSIONS } from '../content/missions'
import type { Mission } from '../content/missions'
import { EXPLAINS } from '../content/explain'
import type { GameState } from '../game/types'
import { addGauges, recordMission, starsFor } from '../game/state'
import { Stars } from './common'
import { speak, voiceEnabled } from './voice'

type Apply = (f: (s: GameState) => GameState) => void

/** ミッションの見出し部分(選択肢型・専用UI型で共通) */
export function MissionHeader({ m, tries, hintUsed }: { m: Mission; tries: number; hintUsed: boolean }) {
  const preview = starsFor(tries + 1, hintUsed)
  return (
    <div className="mission-head">
      <span className="mission-chip">ミッション</span>
      <h2 className="mission-goal">{m.goal}</h2>
      <span className="mission-stars" title="今クリアしたときにもらえる星">
        <Stars n={preview} />
      </span>
    </div>
  )
}

/** ヒント:見ると★が1つ減る。知識カードも開ける */
export function HintBox({
  m,
  used,
  onUse,
  onOpenCard,
}: {
  m: Mission
  used: boolean
  onUse: () => void
  onOpenCard: (id: string) => void
}) {
  if (!used)
    return (
      <button className="tertiary hint-btn" onClick={onUse}>
        💡 ゼイ吉にヒントをもらう(★−1)
      </button>
    )
  return (
    <div className="hint" role="note">
      <p>
        <strong>ヒント:</strong>
        {m.hint}
      </p>
      {EXPLAINS[m.card] && (
        <button className="secondary small" onClick={() => onOpenCard(m.card)}>
          {EXPLAINS[m.card].icon} 知識カード「{EXPLAINS[m.card].title}」を見る
        </button>
      )}
    </div>
  )
}

/** クリア済みの表示 */
export function MissionCleared({ m, s, message, children }: { m: Mission; s: GameState; message?: string; children?: ReactNode }) {
  const r = s.missions[m.id]
  if (!r) return null
  const card = EXPLAINS[m.card]
  return (
    <section className={`mission done ${r.stars === 0 ? 'failed' : ''}`} aria-label="ミッションの結果">
      <div className="mission-head">
        <span className="mission-chip">{r.stars > 0 ? 'クリア' : '失敗'}</span>
        <h2 className="mission-goal">{m.goal}</h2>
        <Stars n={r.stars} />
      </div>
      {message && <p className="mission-feedback">{message}</p>}
      {card && (
        <p className="got-card">
          <span aria-hidden="true">{card.icon}</span> 知識カード「{card.title}」を手に入れた
        </p>
      )}
      {children}
    </section>
  )
}

/** 選択肢型のミッション */
export function MissionCard({ s, apply, id, onOpenCard }: { s: GameState; apply: Apply; id: string; onOpenCard: (id: string) => void }) {
  const m = MISSIONS[id]
  const [tries, setTries] = useState(0)
  const [hintUsed, setHintUsed] = useState(false)
  const [wrong, setWrong] = useState<{ id: string; text: string } | null>(null)
  const [cleared, setCleared] = useState<string | null>(null)
  const [penalized, setPenalized] = useState<string[]>([])
  if (!m?.options) return null

  if (s.missions[id]) return <MissionCleared m={m} s={s} message={cleared ?? undefined} />

  const options = m.options(s)
  const choose = (optId: string) => {
    const o = options.find((x) => x.id === optId)!
    const n = tries + 1
    setTries(n)
    if (voiceEnabled()) speak([o.feedback])
    if (o.ok) {
      setCleared(o.feedback)
      apply((x) => {
        let y = recordMission(x, id, { cleared: true, tries: n, hintUsed, card: m.card })
        y = addGauges(y, m.reward)
        return m.onClear ? m.onClear(y, optId) : y
      })
    } else {
      setWrong({ id: optId, text: o.feedback })
      // 同じズルを何度選んでも、減るのは1回だけ
      if (o.penalty && !penalized.includes(o.id)) {
        setPenalized([...penalized, o.id])
        apply((x) => addGauges(x, o.penalty))
      }
    }
  }

  return (
    <section className="mission" aria-label="ミッション">
      <MissionHeader m={m} tries={tries} hintUsed={hintUsed} />
      <p className="mission-question">{m.question(s)}</p>
      <div className="mission-options" role="group" aria-label="選択肢">
        {options.map((o) => (
          <button
            key={o.id}
            className={`option ${wrong?.id === o.id ? 'is-wrong' : ''}`}
            onClick={() => choose(o.id)}
          >
            <span className="option-label">{o.label}</span>
            {o.detail && <span className="option-detail">{o.detail}</span>}
          </button>
        ))}
      </div>
      {wrong && (
        <div className="banner error" role="alert">
          <strong>ざんねん!</strong> {wrong.text}
          <span className="banner-sub">もう一度選んでみよう。</span>
        </div>
      )}
      <HintBox m={m} used={hintUsed} onUse={() => setHintUsed(true)} onOpenCard={onOpenCard} />
    </section>
  )
}
