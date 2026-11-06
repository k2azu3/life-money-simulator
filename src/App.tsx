import { useCallback, useEffect, useRef, useState } from 'react'
import { man } from './engine'
import type { RulesMode } from './rules'
import { SCENES, STAGES, stageIndex } from './content/scenes'
import { CARD_ORDER, EXPLAINS } from './content/explain'
import { MISSIONS } from './content/missions'
import type { GameState, Gauges } from './game/types'
import { clearSave, load, newGame, save, totalStars } from './game/state'
import { BADGES } from './game/badges'
import type { BadgeId } from './game/badges'
import { CardShelf, EffectChips, ExplainBody, GAUGE_META, GaugeBars, Guide, Modal, SpeakerIcon, StepList, Zeikichi } from './ui/common'
import { MissionCard } from './ui/MissionCard'
import { CompanyView, FirstYearChoicesView, PayslipView } from './ui/views1'
import { FinalReturnView, YearEndGame } from './ui/YearEndGame'
import { BadgeGrid, EndView, SummaryView, YearCharts } from './ui/views2'
import { setVoiceEnabled, stopSpeaking, voiceEnabled, voiceSupported } from './ui/voice'

type Apply = (f: (s: GameState) => GameState) => void
type Panel = { kind: 'card'; id: string } | { kind: 'why' } | { kind: 'records' } | null

function gaugeToast(prev: Gauges, next: Gauges): string | null {
  const parts = (Object.keys(GAUGE_META) as (keyof Gauges)[])
    .map((k) => ({ k, d: next[k] - prev[k] }))
    .filter((x) => x.d !== 0)
    .map(({ k, d }) => `${GAUGE_META[k].icon}${GAUGE_META[k].label} ${d > 0 ? '+' : '−'}${Math.abs(d)}`)
  return parts.length ? parts.join(' ') : null
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [voiceOn, setVoiceOn] = useState(voiceEnabled())
  const headingRef = useRef<HTMLHeadingElement>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((t: string) => {
    setToast(t)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2800)
  }, [])

  const toggleVoice = () => {
    setVoiceEnabled(!voiceOn)
    setVoiceOn(!voiceOn)
  }

  const apply: Apply = useCallback(
    (f) => {
      setState((prev) => {
        if (!prev) return prev
        let next = f(prev)
        if (next.sceneId !== prev.sceneId) {
          const enter = SCENES[next.sceneId]?.onEnter
          if (enter) next = enter(next)
        }
        const msgs: string[] = []
        const g = gaugeToast(prev.gauges, next.gauges)
        if (g) msgs.push(g)
        const newBadges = next.badges.filter((b) => !prev.badges.includes(b))
        if (newBadges.length) {
          const b = BADGES[newBadges[0] as BadgeId]
          msgs.push(`バッジ獲得 ${b.icon} ${b.title}`)
        }
        if (msgs.length) window.setTimeout(() => showToast(msgs.join(' ・ ')), 0)
        save(next)
        return next
      })
    },
    [showToast],
  )

  // シーンが変わったら先頭へスクロールし、見出しにフォーカス(スクリーンリーダー向け)
  useEffect(() => {
    window.scrollTo({ top: 0 })
    headingRef.current?.focus()
  }, [state?.sceneId])

  const start = (name: string, mode: RulesMode) => {
    let s = newGame(name, mode)
    const enter = SCENES[s.sceneId].onEnter
    if (enter) s = enter(s)
    save(s)
    setState(s)
  }

  if (!state)
    return <TitleScreen onStart={start} onContinue={(s) => setState(s)} voiceOn={voiceOn} onToggleVoice={toggleVoice} />

  const scene = SCENES[state.sceneId] ?? SCENES.birth
  const idx = stageIndex(scene.id)
  const missionCleared = !scene.mission || !!state.missions[scene.mission]
  const why = missionCleared ? (scene.why?.(state) ?? []) : []
  const openCard = (id: string) => setPanel({ kind: 'card', id })

  return (
    <>
      <a className="skip-link" href="#main">本文へ移動</a>
      <header className="app-header">
        <div className="container header-top">
          <div className="brand">
            <Zeikichi size={32} />
            <span>人生まるごと<span className="brand-long">マネーシミュレーター</span></span>
          </div>
          <nav className="header-actions" aria-label="メニュー">
            {voiceSupported && (
              <button className="header-btn" aria-pressed={voiceOn} onClick={toggleVoice}>
                <SpeakerIcon off={!voiceOn} />
                <span>音声</span>
              </button>
            )}
            <button className="header-btn" onClick={() => setPanel({ kind: 'records' })}>
              <span aria-hidden="true">📒</span>
              <span>記録</span>
            </button>
            <button
              className="header-btn"
              onClick={() => {
                save(state)
                showToast('セーブしました')
              }}
            >
              <span aria-hidden="true">💾</span>
              <span>セーブ</span>
            </button>
            <button
              className="header-btn"
              onClick={() => {
                stopSpeaking()
                setState(null)
              }}
            >
              <span aria-hidden="true">🏠</span>
              <span>タイトル</span>
            </button>
          </nav>
        </div>
        <div className="container header-status">
          <dl className="status">
            <div>
              <dt>{state.name}</dt>
              <dd>{state.age}歳</dd>
            </div>
            <div>
              <dt>貯金</dt>
              <dd>{man(state.savings)}</dd>
            </div>
            <div>
              <dt>星</dt>
              <dd>★ {totalStars(state)}</dd>
            </div>
          </dl>
          <GaugeBars g={state.gauges} compact />
        </div>
        <div className="container">
          <ol className="progress" aria-label="人生の進み具合">
            {STAGES.map((st, i) => (
              <li key={st} className={i < idx ? 'done' : i === idx ? 'current' : ''} aria-current={i === idx ? 'step' : undefined}>
                <span className="dot" aria-hidden="true" />
                <span className="progress-label">{st}</span>
              </li>
            ))}
          </ol>
        </div>
      </header>

      <main id="main">
        <div className="container">
          <p className="eyebrow">{scene.when(state)}</p>
          <h1 tabIndex={-1} ref={headingRef}>
            {scene.title(state)}
          </h1>
          <Guide lines={scene.lines(state)} voiceOn={voiceOn} />
          {scene.facts && (
            <div className="facts">
              {scene.facts(state).map((f) => (
                <div className="fact" key={f.label}>
                  <div className="label">{f.label}</div>
                  <div className="value">{f.value}</div>
                  {f.who && <div className="who">{f.who}</div>}
                </div>
              ))}
            </div>
          )}

          {scene.mission && MISSIONS[scene.mission]?.options && (
            <MissionCard key={`${state.sceneId}-${scene.mission}`} s={state} apply={apply} id={scene.mission} onOpenCard={openCard} />
          )}

          {missionCleared && (
            <>
              {why.length > 0 && (
                <div className="tool-row">
                  <button className="tertiary" onClick={() => setPanel({ kind: 'why' })}>
                    🔍 計算の内訳を見る
                  </button>
                </div>
              )}
              <SceneBody s={state} apply={apply} onOpenCard={openCard} onRestart={() => { clearSave(); setState(null) }} />
              {scene.choices && (
                <div className="choices" role="group" aria-label="次の行動">
                  {scene.choices(state).map((c) => (
                    <button key={c.label} className="choice" onClick={() => apply(c.act)}>
                      <span className="choice-main">
                        <span className="choice-label">{c.label}</span>
                        {c.detail && <span className="choice-detail">{c.detail}</span>}
                      </span>
                      <EffectChips d={c.effect} />
                      <span className="choice-arrow" aria-hidden="true">›</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer mode={state.rulesMode} />

      {panel?.kind === 'card' && EXPLAINS[panel.id] && (
        <Modal title={`${EXPLAINS[panel.id].icon} ${EXPLAINS[panel.id].title}`} onClose={() => setPanel(null)}>
          <ExplainBody id={panel.id} />
        </Modal>
      )}
      {panel?.kind === 'why' && (
        <Modal title="計算の内訳" onClose={() => setPanel(null)}>
          {why.map((b) => (
            <div key={b.title}>
              <h3>{b.title}</h3>
              <StepList steps={b.steps} />
            </div>
          ))}
        </Modal>
      )}
      {panel?.kind === 'records' && (
        <Modal title="これまでの記録" onClose={() => setPanel(null)}>
          <h3>ゲージ</h3>
          <GaugeBars g={state.gauges} />
          <h3>知識カード({state.cards.length}/{CARD_ORDER.length})</h3>
          <CardShelf s={state} onOpen={openCard} />
          <YearCharts s={state} />
          <h3>バッジ</h3>
          <BadgeGrid s={state} />
          <h3>お金のできごと</h3>
          <ul>
            {state.logs.map((l, i) => (
              <li key={i}>
                {l.age}歳:{l.text} {man(l.amount)}({l.who === 'family' ? '家族' : '自分'})
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )
}

function SceneBody({ s, apply, onOpenCard, onRestart }: { s: GameState; apply: Apply; onOpenCard: (id: string) => void; onRestart: () => void }) {
  switch (SCENES[s.sceneId]?.kind) {
    case 'company':
      return <CompanyView s={s} apply={apply} />
    case 'payslip':
      return <PayslipView s={s} apply={apply} />
    case 'firstYearChoices':
      return <FirstYearChoicesView s={s} apply={apply} />
    case 'yearEnd':
      return <YearEndGame s={s} apply={apply} onOpenCard={onOpenCard} />
    case 'finalReturn':
      return <FinalReturnView s={s} apply={apply} onOpenCard={onOpenCard} />
    case 'summary':
      return <SummaryView s={s} apply={apply} />
    case 'end':
      return <EndView s={s} onRestart={onRestart} onOpenCard={onOpenCard} />
    default:
      return null
  }
}

function TitleScreen({
  onStart,
  onContinue,
  voiceOn,
  onToggleVoice,
}: {
  onStart: (name: string, mode: RulesMode) => void
  onContinue: (s: GameState) => void
  voiceOn: boolean
  onToggleVoice: () => void
}) {
  const saved = load()
  const [name, setName] = useState('')
  const [mode, setMode] = useState<RulesMode>('fixed2026')
  return (
    <>
      <main id="main" className="title-main">
        <div className="container title-screen">
          <div className="hero">
            <Zeikichi size={112} />
            <p className="eyebrow">お金の人生ゲーム</p>
            <h1>人生まるごと<br />マネーシミュレーター</h1>
            <p className="hero-lead">知らないと損する。知ってると得する。<br />お金の知識で、人生のミッションをクリアしよう。</p>
          </div>

          <ul className="howto">
            <li>
              <span className="howto-icon" aria-hidden="true">🎯</span>
              <strong>ミッション</strong>
              <span>各場面の課題は、お金の知識がないと解けない。</span>
            </li>
            <li>
              <span className="howto-icon" aria-hidden="true">📊</span>
              <strong>3つのゲージ</strong>
              <span>💰お金・🙏徳・😊しあわせ。ズルをすると徳が下がる。</span>
            </li>
            <li>
              <span className="howto-icon" aria-hidden="true">🃏</span>
              <strong>知識カード</strong>
              <span>困ったらヒント。クリアするとカードが集まる。</span>
            </li>
          </ul>

          <form
            className="start-form"
            onSubmit={(e) => {
              e.preventDefault()
              onStart(name, mode)
            }}
          >
            <div className="field">
              <label htmlFor="name">あなたの名前(ニックネーム)</label>
              <input id="name" value={name} maxLength={12} placeholder="例:たろう" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="mode">制度の前提</label>
              <select id="mode" value={mode} onChange={(e) => setMode(e.target.value as RulesMode)}>
                <option value="fixed2026">令和8年分(2026年)の制度がずっと続く(おすすめ)</option>
                <option value="statutory">法律どおり(2028年以降は特例終了)</option>
              </select>
            </div>
            {voiceSupported && (
              <label className="switch">
                <input type="checkbox" checked={voiceOn} onChange={onToggleVoice} />
                <span>ゼイ吉の声を出す</span>
              </label>
            )}
            <div className="form-actions">
              <button type="submit" className="primary large">
                はじめから
              </button>
              {saved && (
                <button type="button" className="secondary large" onClick={() => onContinue(saved)}>
                  つづきから({saved.name}・{saved.age}歳)
                </button>
              )}
            </div>
          </form>
        </div>
      </main>
      <Footer mode={mode} />
    </>
  )
}

function Footer({ mode }: { mode: RulesMode }) {
  return (
    <footer className="app-footer">
      <div className="container">
        <p>
          <strong>前提:</strong>
          {mode === 'fixed2026'
            ? 'ゲーム内の将来の年も「令和8年分(2026年)の税制・社会保険制度がずっと続く」と仮定しています。'
            : '成立済みの法律どおりに計算し、2028年以降は令和8・9年分限りの特例が終わったものとしています。それより先は現行制度が続くと仮定しています。'}
          税額・保険料は2026年11月時点の公式情報をもとにしています。健康保険は協会けんぽ東京支部の料率です。
        </p>
        <p>
          このアプリは学習用のシミュレーションです。計算を一部簡略化しており、実際の税額とは異なる場合があります。実際の申告や手続きは、国税庁・お住まいの市区町村・日本年金機構などの公式情報を確認するか、税理士などの専門家に相談してください。
        </p>
      </div>
    </footer>
  )
}
