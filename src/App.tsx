import { useCallback, useEffect, useRef, useState } from 'react'
import { man } from './engine'
import type { RulesMode } from './rules'
import { SCENES, STAGES, stageIndex } from './content/scenes'
import { EXPLAINS } from './content/explain'
import type { GameState } from './game/types'
import { clearSave, load, newGame, save } from './game/state'
import { BADGES } from './game/badges'
import type { BadgeId } from './game/badges'
import { ExplainBody, Guide, Modal, StepList, Zeikichi } from './ui/common'
import { CompanyView, FirstYearChoicesView, PayslipView, WallsView } from './ui/views1'
import { FinalReturnView, YearEndGame } from './ui/YearEndGame'
import { BadgeGrid, EndView, SummaryView, YearCharts } from './ui/views2'

type Apply = (f: (s: GameState) => GameState) => void

export default function App() {
  const [state, setState] = useState<GameState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [panel, setPanel] = useState<'explain' | 'why' | 'records' | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const showToast = useCallback((t: string) => {
    setToast(t)
    window.setTimeout(() => setToast(null), 2600)
  }, [])

  const apply: Apply = useCallback(
    (f) => {
      setState((prev) => {
        if (!prev) return prev
        let next = f(prev)
        if (next.sceneId !== prev.sceneId) {
          const enter = SCENES[next.sceneId]?.onEnter
          if (enter) next = enter(next)
        }
        const newBadges = next.badges.filter((b) => !prev.badges.includes(b))
        if (newBadges.length) {
          const b = BADGES[newBadges[0] as BadgeId]
          window.setTimeout(() => showToast(`バッジ獲得!${b.icon} ${b.title}`), 0)
        }
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

  if (!state) return <TitleScreen onStart={start} onContinue={(s) => setState(s)} />

  const scene = SCENES[state.sceneId] ?? SCENES.birth
  const idx = stageIndex(scene.id)
  const why = scene.why?.(state) ?? []

  return (
    <>
      <header className="app-header">
        <div className="container">
          <span className="app-title">人生まるごとマネーシミュレーター</span>
          <span className="status-chip">{state.name}・{state.age}歳</span>
          <span className="status-chip">貯金 {man(state.savings)}</span>
          <button className="ghost" style={{ minHeight: 36, padding: '4px 10px' }} onClick={() => setPanel('records')}>記録</button>
          <button
            className="ghost"
            style={{ minHeight: 36, padding: '4px 10px' }}
            onClick={() => {
              save(state)
              showToast('セーブしました')
            }}
          >
            セーブ
          </button>
          <button className="ghost" style={{ minHeight: 36, padding: '4px 10px' }} onClick={() => setState(null)}>タイトル</button>
        </div>
        <div className="container">
          <ol className="progress" aria-label="人生の進み具合">
            {STAGES.map((st, i) => (
              <li key={st} className={i < idx ? 'done' : i === idx ? 'current' : ''} aria-current={i === idx ? 'step' : undefined}>
                {st}
              </li>
            ))}
          </ol>
        </div>
      </header>

      <main>
        <div className="container">
          <h1 tabIndex={-1} ref={headingRef}>{scene.title(state)}</h1>
          <Guide lines={scene.lines(state)} />
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
          <div className="tool-row">
            {scene.explain && EXPLAINS[scene.explain] && (
              <button onClick={() => setPanel('explain')}>📖 やさしい解説</button>
            )}
            {why.length > 0 && <button onClick={() => setPanel('why')}>🔍 なぜ?(計算の内訳)</button>}
          </div>

          <SceneBody s={state} apply={apply} onRestart={() => { clearSave(); setState(null) }} />

          {scene.choices && (
            <div className="choices">
              {scene.choices(state).map((c) => (
                <button key={c.label} className="choice" onClick={() => apply(c.act)}>
                  {c.label}
                  {c.detail && <small>{c.detail}</small>}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer mode={state.rulesMode} />

      {panel === 'explain' && scene.explain && (
        <Modal title={`やさしい解説:${EXPLAINS[scene.explain].title}`} onClose={() => setPanel(null)}>
          <ExplainBody id={scene.explain} />
        </Modal>
      )}
      {panel === 'why' && (
        <Modal title="なぜ?(計算の内訳)" onClose={() => setPanel(null)}>
          {why.map((b) => (
            <div key={b.title}>
              <h3>{b.title}</h3>
              <StepList steps={b.steps} />
            </div>
          ))}
        </Modal>
      )}
      {panel === 'records' && (
        <Modal title="これまでの記録" onClose={() => setPanel(null)}>
          <YearCharts s={state} />
          <h3>お金のできごと</h3>
          <ul>
            {state.logs.map((l, i) => (
              <li key={i}>{l.age}歳:{l.text} {man(l.amount)}({l.who === 'family' ? '家族' : '自分'})</li>
            ))}
          </ul>
          <h3>バッジ</h3>
          <BadgeGrid s={state} />
        </Modal>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  )
}

function SceneBody({ s, apply, onRestart }: { s: GameState; apply: Apply; onRestart: () => void }) {
  switch (SCENES[s.sceneId]?.kind) {
    case 'walls':
      return <WallsView s={s} apply={apply} />
    case 'company':
      return <CompanyView s={s} apply={apply} />
    case 'payslip':
      return <PayslipView s={s} apply={apply} />
    case 'firstYearChoices':
      return <FirstYearChoicesView s={s} apply={apply} />
    case 'yearEnd':
      return <YearEndGame s={s} apply={apply} />
    case 'finalReturn':
      return <FinalReturnView s={s} apply={apply} />
    case 'summary':
      return <SummaryView s={s} apply={apply} />
    case 'end':
      return <EndView s={s} onRestart={onRestart} />
    default:
      return null
  }
}

function TitleScreen({ onStart, onContinue }: { onStart: (name: string, mode: RulesMode) => void; onContinue: (s: GameState) => void }) {
  const saved = load()
  const [name, setName] = useState('')
  const [mode, setMode] = useState<RulesMode>('fixed2026')
  return (
    <>
      <main>
        <div className="container title-screen">
          <Zeikichi size={120} />
          <h1>人生まるごとマネーシミュレーター</h1>
          <p>生まれてから社会人になるまでを体験しながら、税金・社会保険・年末調整のしくみを学ぼう。</p>
          <div className="guide">
            <div className="bubble">
              <div className="guide-name">ゼイ吉</div>
              <p>まいど!ワイはゼイ吉。貯金箱に住んどるお金の妖精や。あんたの一生ぶんのお金の流れ、案内したるで!</p>
            </div>
          </div>
          <form
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
            <div className="tool-row" style={{ justifyContent: 'center' }}>
              <button type="submit" className="primary">はじめから</button>
              {saved && (
                <button type="button" onClick={() => onContinue(saved)}>
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
