// One-time conversion of the registration platform's CSV export into content/audience.ts.
//
// Runs once, by a human, shortly before the event (23 Aug 2026), under time pressure. The
// parser below is pure and exported so it can be unit-tested without touching the filesystem;
// all file I/O lives in main() at the bottom, which is not exercised by tests.
//
// The five questions and their exact Thai/English option labels are documented in
// docs/registration-questions.md (Group B, questions B1-B5). This file must accept either
// language, case-insensitively, with tolerant whitespace — the registration platform may export
// either, and there is no second chance to ask on the day.
//
// Failure policy: never guess, never silently drop a row. An unrecognised option label, a
// missing required column, a malformed row, or an empty CSV all throw immediately, naming the
// row number and/or column so a human can fix the export and re-run. A silently-miscounted
// bucket would produce a plausible-looking dataset that drives a confidently wrong answer live
// in front of the room — a crash weeks earlier is vastly cheaper.

import type { AudienceAggregate } from '../content/audience'

// --- label normalisation -----------------------------------------------------------------

// En dash, em dash, and minus sign all show up in exports where a hyphen is meant (e.g. "6–8"
// vs "6-8"). Normalise them all to a plain hyphen before comparing. NFC-normalise first so Thai
// strings that differ only in combining-mark order (tone marks, etc.) still compare equal, and
// collapse whitespace so "รอได้เรื่อย ๆ" and "รอได้เรื่อยๆ" (with/without the space before ๆ,
// both common in real-world typing) match the same key.
function normalizeLabel(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[‒–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// --- CSV line splitting (handles simple double-quoted fields) ----------------------------

function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
  }
  fields.push(cur)
  return fields
}

// --- column header candidates (B1-B5, English or Thai, or the short code) -----------------

// Question text may show up as English-only, Thai-only, or the combined "English / Thai" form
// the registration doc itself uses verbatim (e.g. "How will you travel to the expo? /
// คุณจะเดินทางมางานอย่างไร?") — accept all three, plus the short B1-B5 code as a fallback.
const HEADER_CANDIDATES: Record<keyof BucketColumns, string[]> = {
  arrivalMode: [
    'b1',
    'arrivalmode',
    'how will you travel to the expo?',
    'คุณจะเดินทางมางานอย่างไร?',
    'how will you travel to the expo? / คุณจะเดินทางมางานอย่างไร?',
  ],
  wakeTime: [
    'b2',
    'waketime',
    'what time do you usually wake up on a weekday?',
    'ปกติวันธรรมดาคุณตื่นกี่โมง?',
    'what time do you usually wake up on a weekday? / ปกติวันธรรมดาคุณตื่นกี่โมง?',
  ],
  firstDrink: [
    'b3',
    'firstdrink',
    'what is the first thing you drink in the morning?',
    'เช้ามาคุณดื่มอะไรเป็นอย่างแรก?',
    'what is the first thing you drink in the morning? / เช้ามาคุณดื่มอะไรเป็นอย่างแรก?',
  ],
  buyTime: [
    'b4',
    'buytime',
    'when do you usually buy your first drink of the day?',
    'ปกติคุณซื้อเครื่องดื่มแก้วแรกของวันตอนกี่โมง?',
    'when do you usually buy your first drink of the day? / ปกติคุณซื้อเครื่องดื่มแก้วแรกของวันตอนกี่โมง?',
  ],
  queuePatience: [
    'b5',
    'queuepatience',
    'how long would you wait in line for coffee before giving up?',
    'คุณจะยอมต่อคิวกาแฟนานแค่ไหนก่อนจะเลิกซื้อ?',
    'how long would you wait in line for coffee before giving up? / คุณจะยอมต่อคิวกาแฟนานแค่ไหนก่อนจะเลิกซื้อ?',
  ],
}

type BucketColumns = {
  arrivalMode: number
  wakeTime: number
  firstDrink: number
  buyTime: number
  queuePatience: number
}

// --- option label -> bucket key maps (Thai and English, verbatim from the registration doc) --

// Each map accepts the English-only label, the Thai-only label, and the combined "English /
// Thai" form printed verbatim in docs/registration-questions.md — the form itself is bilingual,
// so a real export is likely to contain the combined form rather than either half alone.
const ARRIVAL_MAP: Record<string, keyof AudienceAggregate['arrivalMode']> = {
  'walk': 'walk',
  'เดินมา': 'walk',
  'walk / เดินมา': 'walk',
  'bts / mrt': 'train',
  'bts/mrt': 'train',
  'car': 'car',
  'รถยนต์': 'car',
  'car / รถยนต์': 'car',
  'motorbike': 'moto',
  'มอเตอร์ไซค์': 'moto',
  'motorbike / มอเตอร์ไซค์': 'moto',
}

const WAKE_MAP: Record<string, keyof AudienceAggregate['wakeTime']> = {
  'before 6': 'before6',
  'ก่อน 6 โมง': 'before6',
  'before 6 / ก่อน 6 โมง': 'before6',
  '6-8': '6to8',
  '6-8 โมง': '6to8',
  '6-8 / 6-8 โมง': '6to8',
  '8-10': '8to10',
  '8-10 โมง': '8to10',
  '8-10 / 8-10 โมง': '8to10',
  'after 10': 'after10',
  'หลัง 10 โมง': 'after10',
  'after 10 / หลัง 10 โมง': 'after10',
}

const DRINK_MAP: Record<string, keyof AudienceAggregate['firstDrink']> = {
  'coffee': 'coffee',
  'กาแฟ': 'coffee',
  'coffee / กาแฟ': 'coffee',
  'tea': 'tea',
  'ชา': 'tea',
  'tea / ชา': 'tea',
  'water': 'water',
  'น้ำเปล่า': 'water',
  'water / น้ำเปล่า': 'water',
  'nothing': 'nothing',
  'ยังไม่ได้ดื่มอะไร': 'nothing',
  'nothing / ยังไม่ได้ดื่มอะไร': 'nothing',
}

const BUY_MAP: Record<string, keyof AudienceAggregate['buyTime']> = {
  'before 7': 'before7',
  'ก่อน 7 โมง': 'before7',
  'before 7 / ก่อน 7 โมง': 'before7',
  '7-9': '7to9',
  '7-9 โมง': '7to9',
  '7-9 / 7-9 โมง': '7to9',
  '9-11': '9to11',
  '9-11 โมง': '9to11',
  '9-11 / 9-11 โมง': '9to11',
  'after 11': 'after11',
  'หลัง 11 โมง': 'after11',
  'after 11 / หลัง 11 โมง': 'after11',
  "i don't buy": 'never',
  'i dont buy': 'never',
  'ไม่ได้ซื้อ': 'never',
  "i don't buy / ไม่ได้ซื้อ": 'never',
}

const QUEUE_MAP: Record<string, keyof AudienceAggregate['queuePatience']> = {
  'under 3 minutes': 'under3',
  'ไม่เกิน 3 นาที': 'under3',
  'under 3 minutes / ไม่เกิน 3 นาที': 'under3',
  '3-5 minutes': '3to5',
  '3-5 นาที': '3to5',
  '3-5 minutes / 3-5 นาที': '3to5',
  '5-10 minutes': '5to10',
  '5-10 นาที': '5to10',
  '5-10 minutes / 5-10 นาที': '5to10',
  'as long as it takes': 'any',
  'รอได้เรื่อย ๆ': 'any',
  'รอได้เรื่อยๆ': 'any', // common typing without the space before ๆ
  'as long as it takes / รอได้เรื่อย ๆ': 'any',
}

function findColumn(
  header: string[],
  bucketName: string,
  candidates: string[],
): number {
  const idx = header.findIndex((h) => candidates.includes(normalizeLabel(h)))
  if (idx === -1) {
    throw new Error(
      `import-audience: missing required column for "${bucketName}" — expected a header matching one of: ${candidates.join(', ')}`,
    )
  }
  return idx
}

function matchLabel<K extends string>(
  raw: string,
  map: Record<string, K>,
  rowNum: number,
  columnName: string,
): K {
  const key = normalizeLabel(raw)
  const value = map[key]
  if (value === undefined) {
    throw new Error(
      `import-audience: row ${rowNum}, column "${columnName}": unrecognized option label "${raw.trim()}"`,
    )
  }
  return value
}

// --- the pure parser ------------------------------------------------------------------------

export function parseAudienceCsv(csv: string): AudienceAggregate {
  const lines = csv.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0)

  if (lines.length === 0) {
    throw new Error('import-audience: empty CSV — no header row found')
  }

  const header = splitCsvLine(lines[0]).map((h) => h.trim())

  const colArrival = findColumn(header, 'arrivalMode (B1: how will you travel to the expo?)', HEADER_CANDIDATES.arrivalMode)
  const colWake = findColumn(header, 'wakeTime (B2: what time do you usually wake up?)', HEADER_CANDIDATES.wakeTime)
  const colDrink = findColumn(header, 'firstDrink (B3: first thing you drink)', HEADER_CANDIDATES.firstDrink)
  const colBuy = findColumn(header, 'buyTime (B4: when do you buy your first drink?)', HEADER_CANDIDATES.buyTime)
  const colQueue = findColumn(header, 'queuePatience (B5: how long would you wait?)', HEADER_CANDIDATES.queuePatience)

  if (lines.length === 1) {
    throw new Error('import-audience: CSV has a header row but no data rows')
  }

  const result: AudienceAggregate = {
    respondents: 0,
    arrivalMode: { walk: 0, train: 0, car: 0, moto: 0 },
    wakeTime: { before6: 0, '6to8': 0, '8to10': 0, after10: 0 },
    firstDrink: { coffee: 0, tea: 0, water: 0, nothing: 0 },
    buyTime: { before7: 0, '7to9': 0, '9to11': 0, after11: 0, never: 0 },
    queuePatience: { under3: 0, '3to5': 0, '5to10': 0, any: 0 },
  }

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1 // 1-based, counting the header as row 1 (matches a spreadsheet view)
    const fields = splitCsvLine(lines[i])

    if (fields.length !== header.length) {
      throw new Error(
        `import-audience: row ${rowNum}: expected ${header.length} columns, got ${fields.length}`,
      )
    }

    const arrival = matchLabel(fields[colArrival], ARRIVAL_MAP, rowNum, header[colArrival])
    const wake = matchLabel(fields[colWake], WAKE_MAP, rowNum, header[colWake])
    const drink = matchLabel(fields[colDrink], DRINK_MAP, rowNum, header[colDrink])
    const buy = matchLabel(fields[colBuy], BUY_MAP, rowNum, header[colBuy])
    const queue = matchLabel(fields[colQueue], QUEUE_MAP, rowNum, header[colQueue])

    result.arrivalMode[arrival]++
    result.wakeTime[wake]++
    result.firstDrink[drink]++
    result.buyTime[buy]++
    result.queuePatience[queue]++
    result.respondents++
  }

  return result
}

// --- file I/O wrapper (not exercised by tests) ----------------------------------------------

function renderModule(aggregate: AudienceAggregate): string {
  // Valid JSON is valid TypeScript, so this is a complete, correctly-typed object literal as-is.
  const json = JSON.stringify(aggregate, null, 2)

  return `// The audience aggregate — the single seam where real registration data enters The Decision
// Room. Every downstream module (simulator, dashboards, game store) reads AUDIENCE from here
// and nothing else touches the registration CSV.
//
// The registration form is documented in docs/registration-questions.md (Group B, questions
// B1-B5). Each bucket below corresponds to one question's answer options.
//
// GENERATED by scripts/import-audience.ts from the real registration export. Do not hand-edit;
// re-run the import script against a corrected CSV instead.

export type AudienceAggregate = {
  respondents: number
  arrivalMode: Record<'walk' | 'train' | 'car' | 'moto', number>
  wakeTime: Record<'before6' | '6to8' | '8to10' | 'after10', number>
  firstDrink: Record<'coffee' | 'tea' | 'water' | 'nothing', number>
  buyTime: Record<'before7' | '7to9' | '9to11' | 'after11' | 'never', number>
  queuePatience: Record<'under3' | '3to5' | '5to10' | 'any', number>
}

// Real registration data has been imported — the placeholder badge is off.
export const IS_PLACEHOLDER = false

export const AUDIENCE: AudienceAggregate = ${json}

export function bucketTotal(rec: Record<string, number>): number {
  return Object.values(rec).reduce((sum, v) => sum + v, 0)
}
`
}

async function main() {
  const [, , inputPath, outputPath] = process.argv
  if (!inputPath) {
    console.error('Usage: npx tsx scripts/import-audience.ts <registration-export.csv> [content/audience.ts]')
    process.exit(1)
  }

  const fs = await import('node:fs')
  const path = await import('node:path')
  const url = await import('node:url')

  const scriptDir = path.dirname(url.fileURLToPath(import.meta.url))
  const csv = fs.readFileSync(inputPath, 'utf-8')
  const aggregate = parseAudienceCsv(csv)
  const outFile = outputPath ?? path.join(scriptDir, '..', 'content', 'audience.ts')

  fs.writeFileSync(outFile, renderModule(aggregate))
  console.log(`import-audience: wrote ${aggregate.respondents} respondents to ${outFile}`)
}

// Only run main() when this file is executed directly (not when imported by tests). Compare
// decoded paths rather than raw URL strings so this still matches when the repo path contains
// spaces or non-ASCII characters (both percent-encoded in import.meta.url but not in argv[1]).
async function isMainModule(): Promise<boolean> {
  if (typeof process === 'undefined' || process.argv[1] === undefined) return false
  const { fileURLToPath } = await import('node:url')
  return fileURLToPath(import.meta.url) === process.argv[1]
}

if (await isMainModule()) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
