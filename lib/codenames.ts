import type { Lang } from './types'

const NOUNS: Record<Lang, string[]> = {
  en: ['Ramen', 'Espresso', 'Mango', 'Neon', 'Midnight', 'Orchid', 'Falcon', 'Pixel',
       'Tuk-Tuk', 'Monsoon', 'Jasmine', 'Cobra', 'Lantern', 'Comet', 'Durian'],
  th: ['ราเมง', 'กาแฟ', 'มะม่วง', 'นีออน', 'เที่ยงคืน', 'กล้วยไม้', 'เหยี่ยว', 'พิกเซล',
       'ตุ๊กตุ๊ก', 'มรสุม', 'มะลิ', 'งูเห่า', 'โคมไฟ', 'ดาวหาง', 'ทุเรียน'],
}

export function randomCodename(lang: Lang): string {
  const pool = NOUNS[lang]
  const noun = pool[Math.floor(Math.random() * pool.length)]
  return lang === 'th' ? `นักสืบ${noun}` : `Detective ${noun}`
}
