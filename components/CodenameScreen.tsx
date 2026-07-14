'use client'
import { useState } from 'react'
import type { Lang } from '@/lib/types'
import { t } from '@/lib/i18n'
import { randomCodename } from '@/lib/codenames'

export function CodenameScreen({ lang, onJoin }: { lang: Lang; onJoin: (codename: string) => void }) {
  const [name, setName] = useState('')

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-4xl font-bold text-amber-300">{t('appTitle', lang)}</h1>
        <p className="mt-2 text-neutral-400">{t('tagline', lang)}</p>
      </div>

      <label className="block text-sm text-neutral-300">{t('enterCodename', lang)}</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        className="w-full rounded-md border border-amber-800/50 bg-black/50 px-4 py-3 text-lg text-amber-100 outline-none focus:border-amber-500"
      />

      <button
        onClick={() => setName(randomCodename(lang))}
        className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
      >
        {t('randomName', lang)}
      </button>

      <button
        disabled={!name.trim()}
        onClick={() => onJoin(name.trim())}
        className="rounded-md bg-amber-600 px-4 py-3 font-semibold text-black disabled:opacity-40"
      >
        {t('startMission', lang)}
      </button>
    </div>
  )
}
