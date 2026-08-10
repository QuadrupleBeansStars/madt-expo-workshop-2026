'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang, PublicGameState } from '@/lib/types'
import { ROUNDS } from '@/lib/game'
import { CodenameScreen } from '@/components/CodenameScreen'
import { LangToggle } from '@/components/LangToggle'
import { Countdown } from '@/components/game/Countdown'
import { AnswerCards } from '@/components/game/AnswerCards'
import { EvidenceList } from '@/components/game/EvidenceList'
import { Duck } from '@/components/game/Duck'
import { t } from '@/lib/i18n'

const RUN_KEY = 'aidet.run'   // identity ONLY: { playerId, codename }
const LANG_KEY = 'aidet.lang'
const PENDING_KEY = 'aidet.pending'
const POLL_MS = 1200
const REQ_TIMEOUT_MS = 5000

type Identity = { playerId: string; codename: string }
type QueuedAnswer = { playerId: string; caseId: string; optionId: string }

function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Identity>
    if (typeof p?.playerId === 'string' && p.playerId && typeof p.codename === 'string') {
      return { playerId: p.playerId, codename: p.codename }
    }
  } catch { /* ignore */ }
  return null
}
function saveIdentity(id: Identity | null) {
  try { id ? localStorage.setItem(RUN_KEY, JSON.stringify(id)) : localStorage.removeItem(RUN_KEY) } catch { /* ignore */ }
}
function readPending(): QueuedAnswer[] {
  try { const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]'); return Array.isArray(p) ? p : [] } catch { return [] }
}
function writePending(list: QueuedAnswer[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQ_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export default function PlayerPage() {
  const [lang, setLang] = useState<Lang>('th')
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [gameState, setGameState] = useState<PublicGameState | null>(null)
  const [joinError, setJoinError] = useState(false)
  const [sessionWasReset, setSessionWasReset] = useState(false)
  // Ephemeral memory of my pick per caseId (for the reveal screen). NOT persisted.
  const [picks, setPicks] = useState<Record<string, string>>({})
  const lastSeqRef = useRef(-1)

  useEffect(() => {
    const savedLang = localStorage.getItem(LANG_KEY) as Lang | null
    if (savedLang) setLang(savedLang)
    setIdentity(loadIdentity())
  }, [])

  const changeLang = (l: Lang) => { setLang(l); try { localStorage.setItem(LANG_KEY, l) } catch { /* ignore */ } }

  const returnToCodename = useCallback((wasReset: boolean) => {
    saveIdentity(null)
    writePending([])
    setIdentity(null)
    setGameState(null)
    setPicks({})
    lastSeqRef.current = -1
    setSessionWasReset(wasReset)
  }, [])

  // Poll the server heartbeat while we have an identity.
  useEffect(() => {
    if (!identity) return
    let alive = true
    const poll = async () => {
      try {
        const res = await fetchWithTimeout(`/api/state?playerId=${encodeURIComponent(identity.playerId)}`, { method: 'GET' })
        if (!res.ok) return
        const next = (await res.json()) as PublicGameState
        if (!alive) return

        // RESET RECOVERY. The server answered, for the id we sent, and does not know this
        // player: the host reset the room. Leave HERE, in the poll, on the join screen — not
        // mid-round on a failed tap. Before this check the phone sat on "waiting for the host"
        // looking perfectly healthy and only ejected the player when they answered, costing
        // them the round they were in. The vote-time 400 below is now the backstop, not the
        // primary path. Mirrors app/play/page.tsx, which was built with this from the start.
        if (!next.you) { returnToCodename(true); return }

        if (typeof next.seq === 'number' && next.seq >= lastSeqRef.current) {
          lastSeqRef.current = next.seq
          setGameState(next)
        }
      } catch { /* transient — keep last good frame */ }
    }
    void poll()
    const id = setInterval(poll, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [identity, returnToCodename])

  const join = async (codenameInput: string) => {
    try {
      const res = await fetchWithTimeout('/api/join', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codename: codenameInput }),
      })
      if (!res.ok) throw new Error('bad status')
      const { player } = await res.json()
      const id: Identity = { playerId: player.id, codename: player.codename ?? codenameInput }
      saveIdentity(id)
      setIdentity(id)
      setJoinError(false)
      setSessionWasReset(false)
    } catch {
      setJoinError(true)
    }
  }

  const flushPending = useCallback(async () => {
    const pending = readPending()
    if (pending.length === 0) return
    const still: QueuedAnswer[] = []
    for (const a of pending) {
      try {
        const res = await fetchWithTimeout('/api/answer', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a),
        })
        if (res.status === 400) { returnToCodename(true); return }
        if (res.status === 409) continue            // round closed — drop, never requeue
        if (!res.ok) still.push(a)                   // transient
      } catch { still.push(a) }
    }
    writePending(still)
  }, [returnToCodename])

  const commit = async (caseId: string, optionId: string) => {
    if (!identity) return
    setPicks((p) => ({ ...p, [caseId]: optionId }))   // optimistic lock
    const answer: QueuedAnswer = { playerId: identity.playerId, caseId, optionId }
    try {
      const res = await fetchWithTimeout('/api/answer', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(answer),
      })
      if (res.status === 400) { returnToCodename(true); return }
      if (res.status === 409) return                  // too late — locked, drop
      if (!res.ok) throw new Error('bad status')
    } catch {
      writePending([...readPending().filter((a) => a.caseId !== caseId), answer])
    }
    void flushPending()
  }

  const message = joinError ? t('joinFailed', lang) : sessionWasReset ? t('sessionReset', lang) : undefined

  return (
    <main className="crt relative min-h-screen" style={{ background: 'var(--rt-bg)', color: 'var(--rt-text)' }}>
      <LangToggle lang={lang} onChange={changeLang} />
      {!identity ? (
        <CodenameScreen lang={lang} onJoin={join} message={message} />
      ) : (
        <PhoneBody lang={lang} state={gameState} picks={picks} onCommit={commit} onNewDetective={() => returnToCodename(false)} />
      )}
    </main>
  )
}

function PhoneBody({
  lang, state, picks, onCommit, onNewDetective,
}: {
  lang: Lang
  state: PublicGameState | null
  picks: Record<string, string>
  onCommit: (caseId: string, optionId: string) => void
  onNewDetective: () => void
}) {
  if (!state || state.phase === 'lobby') {
    return <Centered>{t('waitingToStart', lang)}</Centered>
  }
  if (state.phase === 'final') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="pixel-title text-2xl">{t('finalTitle', lang)}</div>
        <p style={{ fontFamily: 'var(--font-thai), sans-serif' }}>{t('waitReveal', lang)}</p>
        <button type="button" className="pixel-btn gold" onClick={onNewDetective}>{t('newDetective', lang)}</button>
      </div>
    )
  }

  const round = ROUNDS[state.roundIndex]
  if (!round || state.caseId !== round.id) return <Centered>{t('waitingForOthers', lang)}</Centered>

  const myPick = picks[round.id]
  const locked = state.youAnswered === true || myPick !== undefined
  const correctId = round.options.find((o) => o.correct)!.id

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <span className="pixel-title text-sm">{t('caseLabel', lang)} {round.order}/5</span>
        {state.phase === 'investigate' ? <Countdown remainingMs={state.remainingMs} /> : <span className="pixel-title text-sm">{t('reveal', lang)}</span>}
      </header>

      {/* NO STORYBOARD HERE, deliberately — it renders on the projector (app/tv/page.tsx) only.
          The strip cost ~150px above the answer cards on a 390px-wide phone, and
          `npm run check:projector`'s phone pass measures exactly one thing: how far a player has
          to scroll to reach the last option inside a 45-second window. The story is something the
          room reads together off the big screen; the phone is for tapping. The Decision Room's
          phone makes the same trade for the same reason. */}
      <div className="retro-panel p-3" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
        <div className="mb-1 font-bold" style={{ color: 'var(--rt-cyan)' }}>{round.question[lang]}</div>
        <Duck bubble={round.aiAnswer[lang]} size={48} />
      </div>

      <EvidenceList detectiveCase={round} lang={lang} />

      <AnswerCards
        options={round.options}
        lang={lang}
        disabled={state.phase === 'reveal' || locked}
        selectedId={myPick}
        correctId={state.phase === 'reveal' ? correctId : undefined}
        onPick={(id) => onCommit(round.id, id)}
      />

      {state.phase === 'investigate' && locked ? (
        <p className="text-center" style={{ color: 'var(--rt-gold)' }}>{t('answerLocked', lang)} — {t('waitingForOthers', lang)}</p>
      ) : null}

      {state.phase === 'reveal' ? (
        <div className="retro-panel p-3" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
          <div className="font-bold">{myPick === correctId ? t('youWereRight', lang) : t('youWereFooled', lang)}</div>
          <p className="mt-1 text-sm">{round.reveal[lang]}</p>
        </div>
      ) : null}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
      <p className="text-lg" style={{ color: 'var(--rt-gold)' }}>{children}</p>
    </div>
  )
}
