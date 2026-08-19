'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PublicGameState, Verdict } from '@/lib/types'
import { CodenameScreen } from '@/components/CodenameScreen'
import { t } from '@/lib/i18n'

const RUN_KEY = 'aidet.run'   // identity ONLY: { playerId, codename }
const PENDING_KEY = 'aidet.pending'
const POLL_MS = 1200
const REQ_TIMEOUT_MS = 5000

type Identity = { playerId: string; codename: string }
type QueuedAnswer = { playerId: string; questionId: string; verdict: Verdict }

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
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [gameState, setGameState] = useState<PublicGameState | null>(null)
  const [joinError, setJoinError] = useState(false)
  const [sessionWasReset, setSessionWasReset] = useState(false)
  // Ephemeral memory of my verdict per questionId (for the reveal screen). NOT persisted.
  const [picks, setPicks] = useState<Record<string, Verdict>>({})
  const lastSeqRef = useRef(-1)

  useEffect(() => {
    setIdentity(loadIdentity())
  }, [])

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

  // Posts the verdict, not an option id — the projector owns the question, the phone owns only
  // the tap. Same first-answer-wins/offline-retry shape as the old commit(): optimistic local
  // lock, then a real POST, queued for retry on a network failure and dropped (never requeued)
  // once the round has closed under us.
  const submit = async (verdict: Verdict) => {
    if (!identity || !gameState?.questionId) return
    const questionId = gameState.questionId
    setPicks((p) => ({ ...p, [questionId]: verdict }))   // optimistic lock
    const answer: QueuedAnswer = { playerId: identity.playerId, questionId, verdict }
    try {
      const res = await fetchWithTimeout('/api/answer', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(answer),
      })
      if (res.status === 400) { returnToCodename(true); return }
      if (res.status === 409) return                  // too late — locked, drop
      if (!res.ok) throw new Error('bad status')
    } catch {
      writePending([...readPending().filter((a) => a.questionId !== questionId), answer])
    }
    void flushPending()
  }

  const message = joinError ? t('joinFailed', 'th') : sessionWasReset ? t('sessionReset', 'th') : undefined

  return (
    /*
     * The page's main element carries `det` and NOTHING inline: an inline `background`/`color`
     * there outranks the whole premium palette on specificity alone, and app/globals.det.test.ts
     * guards it. (Spelled out rather than written as the tag — that test finds this element by the
     * FIRST such tag in the file, and a mention in a comment above it would be the one it found.)
     *
     * NO <Patrol> ANY MORE, and it is a deletion rather than an oversight. The approved artifact
     * draws the phone as one case folder filling the screen — the paper runs from 7% to 97% of the
     * height and 4% to 96% of the width, so a full-bleed canvas painting a wall, a floor and a
     * detective walking it would be entirely BEHIND the sheet. The room the phone is standing in
     * is now the desk the folder lies on (`.det-ph`'s gradient in app/globals.css). `Patrol` still
     * runs the projector's `reading`/`question` phases, where there IS a room to see.
     */
    <main className="det det-phone relative min-h-dvh">
      {!identity ? (
        <CodenameScreen onJoin={join} message={message} />
      ) : (
        <PhoneBody state={gameState} codename={identity.codename} picks={picks} onSubmit={submit} />
      )}
    </main>
  )
}

/**
 * How many cases a session runs, for the folder header's `CASE 04 / 09`.
 *
 * DUPLICATED FROM `lib/game.ts#QUESTION_COUNT` ON PURPOSE, and guarded rather than trusted.
 * Importing it would pull `lib/game.ts` into this page's CLIENT bundle, and that module imports
 * `content/questions` at module scope — which would ship the ANSWER KEY (every question's
 * `verdict`, `truth` and `tell`) to every player's phone, readable in devtools. The projector may
 * import it; the phone must not, which is why this file imports nothing but types and `lib/i18n`.
 *
 * `app/page.test.tsx` asserts this equals `QUESTION_COUNT` — a test file runs in node and can
 * import whatever it likes, so the copy cannot drift without turning something red.
 */
export const PHONE_CASE_COUNT = 9

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * THE PHONE, and it is ONE OBJECT on every screen: a tan folder tab carrying the player's own
 * codename, and a sheet of ruled paper under it. Nothing appears from nowhere and nothing changes
 * shape between phases — only what is written on the paper changes.
 *
 * The shell classes live in app/globals.css and are shared byte-for-byte with the join screen
 * (components/CodenameScreen.tsx), so the first screen a player sees is the same folder as the
 * last one.
 *
 * THE SHEET DISTRIBUTES ITS OWN CONTENTS. `.det-fbody` is a flex column and `.det-stamps` carries
 * `margin-top: auto`, so the header and the line sit at the top, the two stamps sit at the bottom
 * under a thumb, and the slack is absorbed between them. That is the fix for the measured
 * complaint that this column was 58-64% empty with ~180px of nothing above its first element: a
 * short line and a long one now both look deliberate.
 */
function PhoneBody({
  state, codename, picks, onSubmit,
}: {
  state: PublicGameState | null
  codename: string
  picks: Record<string, Verdict>
  onSubmit: (verdict: Verdict) => void
}) {
  const phase = state?.phase ?? 'lobby'
  const myVerdict = state?.questionId ? picks[state.questionId] : undefined
  const answered = state?.youAnswered === true || myVerdict !== undefined
  const caseNo = `CASE ${pad2((state?.qIndex ?? 0) + 1)} / ${pad2(PHONE_CASE_COUNT)}`
  const spectator = state?.you?.spectator === true

  return (
    <div className="det-ph">
      {/* The tab carries the codename on every in-game screen — the folder the player has been
          filed under. Thai face: the pixel and terminal faces have no Thai glyphs and would drop
          every vowel mark in the name they just chose. */}
      <span className="det-ftab">
        <span aria-hidden="true">📁</span>
        <span>{codename}</span>
      </span>

      {phase === 'lobby' && <WaitingSheet />}

      {/*
        * THE TWO HOLDING BEATS — `rules` (spec §3) and `reading` (spec §2). Both stamps are
        * already HERE on both of them, and visibly so: locked, not absent. A player who spends the
        * beat looking at a blank sheet and then has two controls appear under their thumb has to
        * find them before they can use them, and the fifteen-second answer window is where that
        * cost lands.
        *
        * The lock needs no server cooperation to be real — `recordAnswer` already rejects anything
        * arriving outside `phase === 'question'` (lib/store.ts), so both beats hold against a
        * crafted POST, not merely against a disabled button.
        */}
      {phase === 'rules' && (
        spectator ? <SpectatingSheet /> : (
          /* The rules themselves are on the projector, read by the room together — three numbered
             lines and the scoring chips do not survive being cut down to a phone, and a player
             reading their own copy is a player not looking up. Untimed, so there is no countdown
             to show: the host advances it. */
          <HoldingSheet head="BRIEFING" line="อ่านกติกาที่จอใหญ่" foot={<>เดี๋ยวเริ่มข้อแรก</>} onPick={onSubmit} />
        )
      )}

      {phase === 'reading' && (
        spectator ? <SpectatingSheet /> : (
          <HoldingSheet
            head={caseNo}
            line="อ่านที่จอใหญ่ก่อน"
            foot={<>เปิดให้ตอบใน <span className="det-num">{secondsLeft(state?.remainingMs)}</span></>}
            onPick={onSubmit}
          />
        )
      )}

      {phase === 'question' && (
        spectator ? <SpectatingSheet /> : (
          <div className="det-fbody">
            <div className="det-fhd">{caseNo}</div>
            {/* One word, and it changes the moment the answer lands: the sheet says what the phone
                is doing now, which is the only thing on it that can. */}
            <p className="det-fq">{answered ? 'ส่งแล้ว' : 'ตัดสินเลย'}</p>
            <StampPair onPick={onSubmit} picked={myVerdict} locked={answered} />
            <p className="det-fcount">
              {answered
                ? <>รอเฉลย…</>
                : <>⏱ <span className="det-num">{secondsLeft(state?.remainingMs)}</span></>}
            </p>
          </div>
        )
      )}

      {phase === 'reveal' && <RevealSheet you={state?.you} />}
      {phase === 'tally' && (
        <LookUpSheet
          mark="📊"
          line="ดูสรุปผลบนจอใหญ่"
          note={(state?.you?.wrongPass ?? 0) > 0
            ? `คุณเชื่อ AI ผิดไป ${state?.you?.wrongPass} ครั้ง`
            : undefined}
        />
      )}
      {phase === 'podium' && <ResultSheet you={state?.you} playerCount={state?.playerCount ?? 0} />}
    </div>
  )
}

/** Whole seconds left, floored at zero. `undefined` (an untimed phase) has none to show. */
function secondsLeft(remainingMs: number | undefined): number {
  return remainingMs === undefined ? 0 : Math.max(0, Math.ceil(remainingMs / 1000))
}

/** The minute before the host presses Start. One idea, centred — there is nothing to do here. */
function WaitingSheet() {
  return (
    <div className="det-fbody det-fbody-mid">
      <div className="det-fmark" aria-hidden="true">🕵️</div>
      <p className="det-fq">เข้าห้องแล้ว</p>
      <p className="det-fnote">รอเพื่อนนักสืบคนอื่น<br />แล้วดูที่จอใหญ่</p>
    </div>
  )
}

/** `rules` and `reading`: a line saying where to look, the two stamps waiting under it, and what
 *  the phone is waiting for. Identical shape to `question`, one beat earlier — which is the point.
 *
 *  There is no timer BAR on either, deliberately: a sliding bar means "you may answer now" and
 *  nothing else, and showing one while the server will refuse every answer teaches the room the
 *  wrong signal from the back of a hall. */
function HoldingSheet({
  head, line, foot, onPick,
}: {
  head: string
  line: string
  foot: React.ReactNode
  onPick: (verdict: Verdict) => void
}) {
  return (
    <div className="det-fbody">
      <div className="det-fhd">{head}</div>
      <p className="det-fq">{line}</p>
      <StampPair onPick={onPick} picked={undefined} locked />
      <p className="det-fcount">{foot}</p>
    </div>
  )
}

/*
 * THE TWO RUBBER STAMPS. Outlined boxes in the verdict's own ink over a 10% wash of it — never
 * filled buttons: the phone is a sheet of paper and these are stamps on it. The CSS is in
 * app/globals.css under `.det .det-st`.
 *
 * `locked` is NOT `!!picked`. `picked` comes from `picks`, which is ephemeral state — "NOT
 * persisted" by design (see the comment on its useState above). A reload mid-question loses
 * `picked` but must not re-open the stamps: `POST /api/answer` maps a second submit for the same
 * question to `'duplicate'`, which the route answers with 200 `{ok:true}`, not a rejection — so an
 * unlocked second tap would silently overwrite the phone's displayed verdict with one the server
 * never recorded. `state.youAnswered` is the server's memory of that; it survives a reload even
 * though `picked` does not.
 */
function StampPair({
  onPick, picked, locked,
}: {
  onPick: (verdict: Verdict) => void
  picked?: Verdict
  locked: boolean
}) {
  /* `disabled` already stops a real tap; this is the second half of the same statement, so the
     lock survives anything reaching the handler without going through the pointer — and so that
     during `rules` and `reading`, when both stamps are locked for everyone, there is no path from
     this component to a POST at all. */
  const pick = (v: Verdict) => { if (locked) return; onPick(v) }
  const cls = (v: Verdict) =>
    `det-st det-st-${v === 'pass' ? 'pass' : 'reject'}`
    + (picked === v ? ' is-picked' : '')
    + (picked && picked !== v ? ' is-dimmed' : '')
    + (locked && !picked ? ' is-locked' : '')

  return (
    <div className="det-stamps">
      <button type="button" disabled={locked} onClick={() => pick('pass')} className={cls('pass')}>
        ✓ ผ่าน
      </button>
      <button type="button" disabled={locked} onClick={() => pick('reject')} className={cls('reject')}>
        ✗ ตีกลับ
      </button>
    </div>
  )
}

/* A spectator (joined mid-session) has nothing to tap. `you.spectator` is the server's "not
   playing" sentinel — see lib/types.ts's PublicGameState.you. */
function SpectatingSheet() {
  return (
    <div className="det-fbody det-fbody-mid">
      <div className="det-fmark" aria-hidden="true">👀</div>
      <p className="det-fq">{t('spectating', 'th')}</p>
      <p className="det-fnote">รอบนี้ดูอย่างเดียว<br />เข้าเล่นได้ตอนเริ่มเซสชันใหม่</p>
    </div>
  )
}

/* The beats where the phone must go dark so the room looks UP: the act card and the tally. The
   story, the lesson and the room's own number are on the projector, read together. */
function LookUpSheet({ mark, line, note }: { mark: string; line: string; note?: string }) {
  return (
    <div className="det-fbody det-fbody-mid">
      <div className="det-fmark" aria-hidden="true">{mark}</div>
      <p className="det-fq">{line}</p>
      {note && <p className="det-fnote">{note}</p>}
    </div>
  )
}

/*
 * THE REVEAL. Three beats, in this order of prominence (spec §7):
 *
 *  1. THE MARK AND THE POINTS. One character, the height of a fifth of the screen, in the pass or
 *     reject ink. It is readable from the corner of an eye while the room is looking at the
 *     projector, which a sentence is not. `data-result` carries the same fact for anything that
 *     has to assert on it without depending on a glyph.
 *  2. THE RANK AND THE GAP. `อันดับ 4` on its own is a fact; `ห่างอันดับ 3 อยู่ 85 แต้ม` is a
 *     reason to still be holding the phone at question seven — it says the next question can
 *     change it, which a bare total never can. Kahoot's move, and the whole reason `gapToNext`
 *     exists on the wire.
 *  3. WHAT THE ROOM DID. Knowing you were not the only one fooled is what lets a person accept it
 *     instead of quietly deciding they are bad at this and disengaging for the rest of the
 *     session. Rendered only when the server sent it — absent means nobody answered, which is not
 *     the same as 0% and must not read as it.
 *
 * ถูก/ผิด and the points come from the SERVER's `you.lastCorrect`/`you.lastPoints`, computed in
 * lib/store.ts#getPublicState from the player's actual recorded answer, never from this
 * component's `picks`. `picks` is ephemeral (explicitly "NOT persisted") — a reload mid-reveal
 * used to lose it and fall through to "หมดเวลา!" even for a player who answered and was simply
 * wrong. `?? null`, never `||`: `lastCorrect: false` (a real wrong answer) must not collapse into
 * the same branch as "never answered" (`lastCorrect` absent).
 *
 * RANK 1 GETS A DIFFERENT LINE, and this is the one place absence is load-bearing. `gapToNext` is
 * ABSENT for the leader, never `0` (lib/types.ts spells out why: ranks are positional, so two
 * players on the same score sit at n and n+1 and the lower one's real gap IS `0` — if the leader
 * were sent `0` too the phone could not tell "you lead" from "you are level with the person above
 * you", which are opposite messages). So the leader is detected by `rank === 1`, never by the gap
 * being falsy, and never renders a "0 แต้ม" line.
 */
function RevealSheet({ you }: { you?: PublicGameState['you'] }) {
  if (you?.spectator) return <SpectatingSheet />
  const correct = you?.lastCorrect ?? null
  const rank = you?.rank ?? 0
  const gap = you?.gapToNext
  const roomWrongPct = you?.roomWrongPct
  const total = you?.score ?? 0

  const mark = correct === null ? '–' : correct ? '✓' : '✗'
  const ink = correct === null ? '#7a6a52' : correct ? '#1c7a2e' : '#b3253f'

  return (
    <div className="det-fbody det-fbody-mid">
      <div
        className="det-fmark"
        data-result={correct === null ? 'timeout' : correct ? 'correct' : 'wrong'}
        style={{ color: ink }}
      >
        {mark}
      </div>
      {correct === null
        ? <p className="det-fq">{t('timesUp', 'th')}</p>
        : <p className="det-fpts">+{you?.lastPoints ?? 0}</p>}

      {rank > 0 && (
        <div className="det-frank">
          <p className="det-frank-big">อันดับ <em>{rank}</em></p>
          {rank === 1
            ? <p className="det-frank-gap">คุณนำห้องอยู่ตอนนี้</p>
            : gap !== undefined && (
              <p className="det-frank-gap">ห่างอันดับ {rank - 1} อยู่ <b>{gap}</b> แต้ม</p>
            )}
          {/*
            * THE RUNNING TOTAL, on the quiet line rather than the loud one. `+300` answers "what
            * did I just get" and is the beat; this answers "how am I doing", which is a different
            * question and a smaller one — a player has about ten seconds with this screen before
            * the projector moves on, and two numbers competing for the same glance means neither
            * is read. It shares the room line's weight deliberately.
            */}
          <p className="det-frank-room">
            รวม {total.toLocaleString('en-US')} แต้ม
            {roomWrongPct !== undefined && <> · ห้องนี้ {roomWrongPct}% ตอบพลาดข้อนี้</>}
          </p>
        </div>
      )}
    </div>
  )
}

/*
 * THE LAST SCREEN A PLAYER SEES, and it has NO REPLAY CONTROL — that is the point of it, not a
 * tidy-up (spec §7).
 *
 * "🔄 เล่นอีกครั้ง" cleared the identity and dropped the phone back on the join screen. Pressed
 * DURING the event — and it sat under the player's thumb at exactly the moment the host was
 * talking, which is when it would be pressed — that phone rejoins as a BRAND NEW PLAYER on zero,
 * while `playerCount` and the closing tally go on counting them. The tally is the number the
 * entire workshop walks toward ("this room passed N pieces of wrong information"), and one bored
 * player could move it. The host's reset is the only way back to a join screen, and it clears
 * everyone at once.
 *
 * IT LEADS WITH THE SCORE, not the rank, which is the artifact's own ordering: the number is the
 * result, the rank is the context for it. Then the lesson, ruled off — `wrongPass` is not a score,
 * it is the count of times this person waved something through that was wrong, which is the one
 * number from this game that means anything on a Tuesday at work. NOT gated on `> 0`: a clean game
 * is a real result and deserves saying out loud.
 */
function ResultSheet({ you, playerCount }: { you?: PublicGameState['you']; playerCount: number }) {
  // rank is 0 for anyone off the leaderboard (spectator, or unranked) — the server's sentinel.
  // Never render "อันดับ 0"; a spectator gets the spectating sheet instead.
  const onBoard = !!you && !you.spectator && you.rank > 0
  if (!onBoard) return <SpectatingSheet />
  const wrong = you.wrongPass

  return (
    <div className="det-fbody det-fbody-mid">
      {/* English — this is the pixel face and Press Start 2P has no Thai glyphs. */}
      <div className="det-fhd">CASE CLOSED</div>
      <div className="det-fscore">{you.score.toLocaleString('en-US')}</div>
      <p className="det-fq" style={{ fontSize: '3.2cqh' }}>อันดับ {you.rank} จาก {playerCount}</p>

      <div className="det-frank">
        <p className="det-frank-gap">
          {wrong > 0
            ? <>คุณกด &quot;ผ่าน&quot; ให้ข้อมูลผิด <b>{wrong}</b> ครั้ง</>
            : <>คุณไม่เคยกด &quot;ผ่าน&quot; ให้ข้อมูลผิดเลย</>}
        </p>
        <p className="det-frank-room">
          {wrong > 0
            ? <>ถ้าเป็นงานจริง คือ {wrong} ชิ้นที่ออกไปในชื่อคุณ</>
            : <>ถ้าเป็นงานจริง คือไม่มีข้อมูลผิดหลุดผ่านคุณออกไปเลย</>}
        </p>
      </div>

      <p className="det-fnote" style={{ marginTop: '2.4cqh' }}>👀 ดูอันดับรวมที่จอใหญ่</p>
    </div>
  )
}
