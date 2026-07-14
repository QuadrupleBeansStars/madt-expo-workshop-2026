'use client'
import { useCallback, useEffect, useState } from 'react'
import type { Answer, Lang } from '@/lib/types'
import { CASES } from '@/content/cases'
import { CodenameScreen } from '@/components/CodenameScreen'
import { CaseScreen } from '@/components/CaseScreen'
import { ResultScreen } from '@/components/ResultScreen'
import { LangToggle } from '@/components/LangToggle'

const PENDING_KEY = 'aidet.pending'
const LANG_KEY = 'aidet.lang'
const PLAYER_ID_KEY = 'aidet.playerId'

export default function PlayerPage() {
  const [lang, setLang] = useState<Lang>('th')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null
    if (saved) setLang(saved)
  }, [])

  const changeLang = (l: Lang) => {
    setLang(l)
    localStorage.setItem(LANG_KEY, l)
  }

  /** Retry any answers that failed to reach the server. A wifi blip must not lose a run. */
  const flushPending = useCallback(async () => {
    const pending: Answer[] = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')
    if (pending.length === 0) return
    const stillPending: Answer[] = []
    for (const a of pending) {
      try {
        const res = await fetch('/api/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(a),
        })
        if (!res.ok) stillPending.push(a)
      } catch {
        stillPending.push(a)
      }
    }
    localStorage.setItem(PENDING_KEY, JSON.stringify(stillPending))
  }, [])

  // Retry on mount (e.g. a page reload after the wifi came back).
  useEffect(() => { void flushPending() }, [flushPending])

  const join = async (codename: string) => {
    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ codename }),
    })
    const { player } = await res.json()
    setPlayerId(player.id)
    localStorage.setItem(PLAYER_ID_KEY, player.id)
  }

  const commit = async (optionId: string, elapsedMs: number) => {
    const answer: Answer = { playerId: playerId!, caseId: CASES[index].id, optionId, elapsedMs }
    setAnswers((prev) => [...prev, answer])
    setIndex((i) => i + 1) // advance immediately — the network must never block the player

    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(answer),
      })
      if (!res.ok) throw new Error('bad status')
    } catch {
      const pending: Answer[] = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')
      pending.push(answer)
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
    }
    // Retry on the next commit too, in case earlier attempts also failed.
    void flushPending()
  }

  return (
    <main className="min-h-screen bg-neutral-950">
      <LangToggle lang={lang} onChange={changeLang} />
      {!playerId ? (
        <CodenameScreen lang={lang} onJoin={join} />
      ) : index < CASES.length ? (
        <CaseScreen detectiveCase={CASES[index]} lang={lang} onCommit={commit} />
      ) : (
        <ResultScreen answers={answers} lang={lang} />
      )}
    </main>
  )
}
