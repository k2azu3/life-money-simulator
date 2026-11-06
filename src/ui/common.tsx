import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { CalcStep } from '../engine'
import { yen } from '../engine'
import { CARD_ORDER, EXPLAINS } from '../content/explain'
import { Diagram } from './Diagrams'
import type { GameState, GaugeDelta, Gauges } from '../game/types'
import { speak, stopSpeaking, voiceSupported } from './voice'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="tertiary" onClick={onClose}>
            閉じる
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** 案内役「ゼイ吉」:ブタの貯金箱の妖精 */
export function Zeikichi({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="案内役のゼイ吉(ブタの貯金箱の妖精)">
      <circle cx="50" cy="50" r="48" fill="#FFE5EC" />
      <ellipse cx="50" cy="60" rx="32" ry="25" fill="#F59BB4" />
      <rect x="42" y="34" width="16" height="4" rx="2" fill="#B23A5D" />
      <path d="M26 42 L30 26 L40 37 Z" fill="#F59BB4" />
      <path d="M74 42 L70 26 L60 37 Z" fill="#F59BB4" />
      <circle cx="40" cy="55" r="3.6" fill="#1A1A1A" />
      <circle cx="60" cy="55" r="3.6" fill="#1A1A1A" />
      <circle cx="41.2" cy="53.8" r="1.1" fill="#fff" />
      <circle cx="61.2" cy="53.8" r="1.1" fill="#fff" />
      <ellipse cx="50" cy="67" rx="9.5" ry="7" fill="#FBC6D4" />
      <circle cx="46.5" cy="67" r="1.8" fill="#B23A5D" />
      <circle cx="53.5" cy="67" r="1.8" fill="#B23A5D" />
      <circle cx="31" cy="64" r="4" fill="#FF7A9C" opacity="0.45" />
      <circle cx="69" cy="64" r="4" fill="#FF7A9C" opacity="0.45" />
      <path d="M80 18 l2.5 -6 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 Z" fill="#E8A300" />
    </svg>
  )
}

/** ゼイ吉の吹き出し。音声オンなら、セリフが変わったときに読み上げる */
export function Guide({ lines, voiceOn }: { lines: string[]; voiceOn: boolean }) {
  const text = lines.join('\n')
  useEffect(() => {
    if (voiceOn) speak(lines)
    // セリフの中身が変わったときだけ読み上げる
  }, [text, voiceOn])
  useEffect(() => () => stopSpeaking(), [])
  return (
    <div className="guide">
      <Zeikichi />
      <div className="bubble" aria-live="polite">
        <div className="guide-head">
          <span className="guide-name">ゼイ吉</span>
          {voiceSupported && (
            <button className="icon-btn" onClick={() => speak(lines)} aria-label="ゼイ吉のセリフをもう一度聞く">
              <SpeakerIcon />
            </button>
          )}
        </div>
        {lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
    </div>
  )
}

export function SpeakerIcon({ off = false }: { off?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
      {off ? (
        <path d="m22 9-6 6M16 9l6 6" />
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  )
}

export const GAUGE_META = {
  money: { icon: '💰', label: 'お金' },
  toku: { icon: '🙏', label: '徳' },
  happy: { icon: '😊', label: 'しあわせ' },
} as const

export function GaugeBars({ g, compact = false }: { g: Gauges; compact?: boolean }) {
  return (
    <ul className={`gauges ${compact ? 'compact' : ''}`} aria-label="3つのゲージ">
      {(Object.keys(GAUGE_META) as (keyof Gauges)[]).map((k) => (
        <li key={k} className={`gauge gauge-${k}`}>
          <span className="gauge-label">
            <span aria-hidden="true">{GAUGE_META[k].icon}</span>
            <span className="gauge-text">{GAUGE_META[k].label}</span>
          </span>
          <span className="gauge-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={g[k]} aria-label={GAUGE_META[k].label}>
            <span className="gauge-fill" style={{ width: `${g[k]}%` }} />
          </span>
          <span className="gauge-value">{g[k]}</span>
        </li>
      ))}
    </ul>
  )
}

/** 選択肢の横に出す「💰+8 😊−2」 */
export function EffectChips({ d }: { d?: GaugeDelta }) {
  if (!d) return null
  const items = (Object.keys(GAUGE_META) as (keyof Gauges)[]).filter((k) => d[k])
  if (!items.length) return null
  return (
    <span className="effects">
      {items.map((k) => (
        <span key={k} className={`effect ${d[k]! > 0 ? 'up' : 'down'}`}>
          {GAUGE_META[k].icon}
          <span className="sr-only">{GAUGE_META[k].label}</span>
          {d[k]! > 0 ? '+' : '−'}
          {Math.abs(d[k]!)}
        </span>
      ))}
    </span>
  )
}

export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <span className="stars" aria-label={`星${n}つ(${max}つ中)`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? 'on' : 'off'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  )
}

export function StepList({ steps }: { steps: CalcStep[] }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={i}>
          <span>{s.label}</span>
          <span className="v">{yen(s.value)}</span>
          {s.formula && <span className="formula">{s.formula}</span>}
          {s.note && <span className="step-note">※ {s.note}</span>}
        </li>
      ))}
    </ol>
  )
}

export function ExplainBody({ id }: { id: string }) {
  const e = EXPLAINS[id]
  if (!e) return null
  return (
    <div className="card-body">
      <p className="card-lead">{e.lead}</p>
      <ul className="points">
        {e.points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
      {e.diagram && <Diagram name={e.diagram} />}
      {e.simplified && (
        <details className="simplified">
          <summary>ゲーム用に簡単にしているところ</summary>
          <ul>
            {e.simplified.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function Money({ value, signed = false }: { value: number; signed?: boolean }) {
  const cls = signed ? (value > 0 ? 'plus' : value < 0 ? 'minus' : '') : ''
  const prefix = signed && value > 0 ? '+' : signed && value < 0 ? '−' : ''
  return <span className={cls}>{prefix + yen(signed ? Math.abs(value) : value)}</span>
}

/** 知識カードの図鑑 */
export function CardShelf({ s, onOpen }: { s: GameState; onOpen: (id: string) => void }) {
  return (
    <div className="card-shelf">
      {CARD_ORDER.map((id) => {
        const c = EXPLAINS[id]
        const got = s.cards.includes(id)
        return got ? (
          <button key={id} className="kcard" onClick={() => onOpen(id)}>
            <span className="kcard-icon" aria-hidden="true">{c.icon}</span>
            <span className="kcard-title">{c.title}</span>
          </button>
        ) : (
          <div key={id} className="kcard locked" aria-label="まだ持っていないカード">
            <span className="kcard-icon" aria-hidden="true">?</span>
            <span className="kcard-title">???</span>
          </div>
        )
      })}
    </div>
  )
}

