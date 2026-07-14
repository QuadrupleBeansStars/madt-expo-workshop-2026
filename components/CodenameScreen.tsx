'use client'
import { useState } from 'react'
import type { Lang } from '@/lib/types'
import { t } from '@/lib/i18n'
import { randomCodename } from '@/lib/codenames'

export function CodenameScreen({
  lang,
  onJoin,
  message,
}: {
  lang: Lang
  onJoin: (codename: string) => void
  message?: string
}) {
  const [name, setName] = useState('')

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-4xl font-bold text-brand-navy">{t('appTitle', lang)}</h1>
        <p className="mt-2 text-text-dim">{t('tagline', lang)}</p>
      </div>

      {message && (
        <p className="rounded-md border border-alert bg-alert-soft px-4 py-2 text-sm font-semibold text-alert">
          {message}
        </p>
      )}

      <label className="block text-sm text-text-dim">{t('enterCodename', lang)}</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        className="w-full rounded-md border border-line bg-surface px-4 py-3 text-lg text-text outline-none focus:border-brand-navy"
      />

      <button
        onClick={() => setName(randomCodename(lang))}
        className="rounded-md border border-line px-4 py-2 text-sm text-text-dim hover:bg-brand-navy-soft"
      >
        {t('randomName', lang)}
      </button>

      <button
        disabled={!name.trim()}
        onClick={() => onJoin(name.trim())}
        className="rounded-md bg-brand-orange px-4 py-3 font-semibold text-white hover:bg-brand-orange-deep disabled:opacity-40"
      >
        {t('startMission', lang)}
      </button>
    </div>
  )
}
