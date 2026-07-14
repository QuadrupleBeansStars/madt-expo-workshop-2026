'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Answer, Lang } from '@/lib/types'
import { CASES } from '@/content/cases'
import { CodenameScreen } from '@/components/CodenameScreen'
import { CaseScreen } from '@/components/CaseScreen'
import { ResultScreen } from '@/components/ResultScreen'
import { LangToggle } from '@/components/LangToggle'
import { t } from '@/lib/i18n'

const PENDING_KEY = 'aidet.pending'
const LANG_KEY = 'aidet.lang'
/** Everything needed to resume a run untouched after a reload, under one namespaced key. */
const RUN_KEY = 'aidet.run'
/** Venue APs commonly accept the TCP connection and then hang with no response. */
const ANSWER_TIMEOUT_MS = 5000

type RunState = { playerId: string; codename: string; answers: Answer[]; index: number }

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

function isValidAnswer(a: unknown, playerId: string): a is Answer {
  if (!a || typeof a !== 'object') return false
  const rec = a as Record<string, unknown>
  return (
    rec.playerId === playerId &&
    typeof rec.caseId === 'string' &&
    CASES.some((c) => c.id === rec.caseId) &&
    typeof rec.optionId === 'string' &&
    isFiniteNumber(rec.elapsedMs)
  )
}

/** Read + validate the stored run. Any malformed/corrupt/out-of-range blob → null (fresh start). */
function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RunState> | null
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.playerId !== 'string' || !parsed.playerId) return null
    if (typeof parsed.codename !== 'string') return null
    if (!Array.isArray(parsed.answers)) return null
    if (typeof parsed.index !== 'number' || !Number.isInteger(parsed.index)) return null
    if (parsed.index < 0 || parsed.index > CASES.length) return null
    if (parsed.answers.length !== parsed.index) return null
    for (const a of parsed.answers) {
      if (!isValidAnswer(a, parsed.playerId)) return null
    }
    return { playerId: parsed.playerId, codename: parsed.codename, answers: parsed.answers as Answer[], index: parsed.index }
  } catch {
    return null
  }
}

function saveRun(run: RunState): void {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(run))
  } catch {
    // Best effort — losing the resume checkpoint is better than crashing mid-run.
  }
}

function readPending(): Answer[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writePending(list: Answer[]): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list))
  } catch {
    // Best effort.
  }
}

function answerKey(a: Answer): string {
  return `${a.playerId}:${a.caseId}`
}

/** Union keyed by `playerId:caseId`; later lists win on conflict. */
function mergeAnswerLists(...lists: Answer[][]): Answer[] {
  const map = new Map<string, Answer>()
  for (const list of lists) {
    for (const a of list) map.set(answerKey(a), a)
  }
  return [...map.values()]
}

/** A hanging request must fail fast so it gets queued instead of blocking forever. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = ANSWER_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('request timed out'))
    }, timeoutMs)
  })
  try {
    return await Promise.race([fetch(url, { ...init, signal: controller.signal }), timeoutPromise])
  } finally {
    clearTimeout(timer)
  }
}

export default function PlayerPage() {
  const [lang, setLang] = useState<Lang>('th')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [codename, setCodename] = useState<string>('')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  // Set when the server rejects an answer as belonging to an unknown player —
  // i.e. the facilitator reset the room while this laptop still held an old run.
  const [sessionWasReset, setSessionWasReset] = useState(false)
  // Serialises all queue mutations (queueAnswer + flushPending) so overlapping
  // calls never interleave their read-modify-write of localStorage.
  const pendingLockRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null
    if (saved) setLang(saved)
  }, [])

  // Resume an in-progress run after a reload (F5, sleep, crash). Never re-join.
  useEffect(() => {
    const run = loadRun()
    if (run) {
      setPlayerId(run.playerId)
      setCodename(run.codename)
      setAnswers(run.answers)
      setIndex(run.index)
    }
  }, [])

  const changeLang = (l: Lang) => {
    setLang(l)
    localStorage.setItem(LANG_KEY, l)
  }

  /**
   * The server told us this player doesn't exist (HTTP 400 on /api/answer) — the room
   * was reset. This is permanent, not a network blip: requeuing would just 400 forever
   * while silently dropping every answer. Wipe the stale run and drop back to the
   * codename screen so the player can rejoin fresh.
   */
  const handleSessionReset = useCallback(() => {
    try {
      localStorage.removeItem(RUN_KEY)
    } catch {
      // Best effort.
    }
    try {
      localStorage.removeItem(PENDING_KEY)
    } catch {
      // Best effort.
    }
    setPlayerId(null)
    setCodename('')
    setAnswers([])
    setIndex(0)
    setSessionWasReset(true)
  }, [])

  const withPendingLock = useCallback((fn: () => void | Promise<void>): Promise<void> => {
    const next = pendingLockRef.current.then(fn, fn)
    pendingLockRef.current = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }, [])

  const queueAnswer = useCallback(
    (answer: Answer) =>
      withPendingLock(() => {
        const pending = readPending()
        writePending(mergeAnswerLists(pending, [answer]))
      }),
    [withPendingLock],
  )

  /** Retry any answers that failed to reach the server. A wifi blip must not lose a run. */
  const flushPending = useCallback(
    () =>
      withPendingLock(async () => {
        const pending = readPending()
        if (pending.length === 0) return
        const stillPending: Answer[] = []
        let permanentlyRejected = false
        for (const a of pending) {
          try {
            const res = await fetchWithTimeout('/api/answer', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(a),
            })
            if (res.status === 400) {
              // Permanent: the server doesn't know this player. Drop it, don't retry.
              permanentlyRejected = true
              continue
            }
            if (!res.ok) stillPending.push(a)
          } catch {
            stillPending.push(a)
          }
        }
        // Safe to overwrite (not just merge) — the in-flight lock guarantees nothing
        // else mutated the queue while this flush was running.
        writePending(stillPending)
        if (permanentlyRejected) handleSessionReset()
      }),
    [withPendingLock, handleSessionReset],
  )

  // Retry on mount (e.g. a page reload after the wifi came back).
  useEffect(() => { void flushPending() }, [flushPending])

  const join = async (codenameInput: string) => {
    const res = await fetchWithTimeout('/api/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ codename: codenameInput }),
    })
    const { player } = await res.json()
    const resolvedCodename: string = player.codename ?? codenameInput
    setPlayerId(player.id)
    setCodename(resolvedCodename)
    setSessionWasReset(false)
    saveRun({ playerId: player.id, codename: resolvedCodename, answers: [], index: 0 })
  }

  const commit = async (optionId: string, elapsedMs: number) => {
    const answer: Answer = { playerId: playerId!, caseId: CASES[index].id, optionId, elapsedMs }
    const newAnswers = [...answers, answer]
    const newIndex = index + 1
    setAnswers(newAnswers)
    setIndex(newIndex) // advance immediately — the network must never block the player
    saveRun({ playerId: playerId!, codename, answers: newAnswers, index: newIndex })

    try {
      const res = await fetchWithTimeout('/api/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(answer),
      })
      if (res.status === 400) {
        // Permanent: the server doesn't know this player — the room was reset.
        // Requeuing would just 400 forever while silently dropping every answer.
        handleSessionReset()
        return
      }
      if (!res.ok) throw new Error('bad status')
    } catch {
      await queueAnswer(answer)
    }
    // Retry on the next commit too, in case earlier attempts also failed.
    void flushPending()
  }

  return (
    <main className="min-h-screen bg-neutral-950">
      <LangToggle lang={lang} onChange={changeLang} />
      {!playerId ? (
        <CodenameScreen lang={lang} onJoin={join} message={sessionWasReset ? t('sessionReset', lang) : undefined} />
      ) : index < CASES.length ? (
        <CaseScreen detectiveCase={CASES[index]} lang={lang} onCommit={commit} />
      ) : (
        <ResultScreen answers={answers} lang={lang} />
      )}
    </main>
  )
}
