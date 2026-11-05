import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { CalcStep } from '../engine'
import { yen } from '../engine'
import { EXPLAINS } from '../content/explain'
import { Diagram } from './Diagrams'

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
          <button className="ghost" onClick={onClose} aria-label="閉じる">
            ✕ 閉じる
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** 案内役「ゼイ吉」:ブタの貯金箱の妖精 */
export function Zeikichi({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="案内役のゼイ吉(ブタの貯金箱の妖精)">
      <ellipse cx="50" cy="58" rx="38" ry="30" fill="#f4a7b9" stroke="#7a3448" strokeWidth="3" />
      <rect x="40" y="27" width="20" height="5" rx="2" fill="#7a3448" />
      <path d="M22 36 L28 20 L38 32 Z" fill="#f4a7b9" stroke="#7a3448" strokeWidth="3" strokeLinejoin="round" />
      <path d="M78 36 L72 20 L62 32 Z" fill="#f4a7b9" stroke="#7a3448" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="38" cy="52" r="4" fill="#2b1a1f" />
      <circle cx="62" cy="52" r="4" fill="#2b1a1f" />
      <ellipse cx="50" cy="66" rx="11" ry="8" fill="#f8c9d4" stroke="#7a3448" strokeWidth="2.5" />
      <circle cx="46" cy="66" r="2" fill="#7a3448" />
      <circle cx="54" cy="66" r="2" fill="#7a3448" />
      <path d="M84 24 l3 -7 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 Z" fill="#eda100" />
    </svg>
  )
}

export function Guide({ lines }: { lines: string[] }) {
  return (
    <div className="guide">
      <Zeikichi />
      <div className="bubble" aria-live="polite">
        <div className="guide-name">ゼイ吉</div>
        {lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
    </div>
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
    <div>
      {e.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {e.diagram && <Diagram name={e.diagram} />}
      {e.simplified && (
        <div className="simplified">
          <strong>簡略化しています:</strong>
          <ul>
            {e.simplified.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function Money({ value, signed = false }: { value: number; signed?: boolean }) {
  const cls = signed ? (value > 0 ? 'plus' : value < 0 ? 'minus' : '') : ''
  const prefix = signed && value > 0 ? '+' : signed && value < 0 ? '−' : ''
  return <span className={cls}>{prefix + yen(signed ? Math.abs(value) : value)}</span>
}
