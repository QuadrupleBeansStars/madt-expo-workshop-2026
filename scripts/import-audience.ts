// Conversion of the registration platform's CSV export into content/audience.ts.
//
//     node scripts/import-audience.ts "MADT Expo 2026 - ... - Form Responses 1.csv"
//
// USE `node`, NOT `npx tsx`. This file ends in a top-level await; tsx transforms it to CommonJS
// and dies with ERR_REQUIRE_ASYNC_MODULE. Node 22+ strips the types natively and runs it as an ES
// module. The output path is optional and defaults to content/audience.ts, which is the intended
// target — that file is generated and meant to be overwritten.
//
// Run by a human, more than once: the survey stays open until the event, so re-import whenever
// responses have grown. Every derived figure on screen recomputes, and `content/room.test.ts`
// fails if the script's prose has gone stale against the new numbers — so after re-importing,
// run `npx vitest run` and fix whatever it names before the day.
//
// Runs shortly before the event (23 Aug 2026), often under time pressure. The
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

// --- column matching --------------------------------------------------------------------

// The form has ALREADY been edited once between being specified and being sent: option labels
// changed, two questions were added, and the bilingual header lost the " / " separator the old
// exact-match candidates required. So headers are matched by a distinctive SUBSTRING rather than
// by equality — "how much do you usually spend" identifies its column whether the Thai half is
// appended with a slash, a space, two spaces, or not at all. The survey is still open; it may be
// edited again before 23 Aug.
//
// Substrings must stay distinctive enough not to collide. `findColumn` throws if one matches more
// than one column, so an ambiguous key fails loudly at import time rather than silently binding
// to whichever column came first.
const HEADER_KEYS: Record<keyof BucketColumns, string[]> = {
  arrivalMode: ['b1', 'arrivalmode', 'how will you travel', 'เดินทางมางาน'],
  wakeTime: ['b2', 'waketime', 'what time do you usually wake', 'ตื่นกี่โมง'],
  firstDrink: ['b3', 'firstdrink', 'first thing you drink', 'ดื่มอะไรเป็นอย่างแรก'],
  buyTime: ['b4', 'buytime', 'when do you usually buy', 'แก้วแรกของวันตอนกี่โมง'],
  queuePatience: ['b5', 'queuepatience', 'wait in line', 'ต่อคิว'],
  spend: ['b6', 'spend', 'how much do you usually spend', 'ในราคาเท่าไหร่'],
  mainFactor: ['b7', 'mainfactor', 'main factor', 'ปัจจัยหลัก'],
}

type BucketColumns = {
  arrivalMode: number
  wakeTime: number
  firstDrink: number
  buyTime: number
  queuePatience: number
  spend: number
  mainFactor: number
}

// --- option label -> bucket key maps ---------------------------------------------------------

// Every map accepts the English-only label, the Thai-only label, and the combined "English /
// Thai" form the live export actually contains. `normalizeLabel` has already folded en/em dashes
// to hyphens, collapsed whitespace, and lowercased, so entries here are written post-normalisation.
const ARRIVAL_MAP: Record<string, keyof AudienceAggregate['arrivalMode']> = {
  'walk': 'walk',
  'เดินมา': 'walk',
  'walk / เดินมา': 'walk',
  // The sent form offers Bus, not BTS/MRT. The old keys are kept so a re-export of an older
  // sheet still imports rather than throwing on row 2.
  'bus': 'bus',
  'รถเมล์ รถสาธารณะ': 'bus',
  'bus / รถเมล์ รถสาธารณะ': 'bus',
  'bts / mrt': 'bus',
  'bts/mrt': 'bus',
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
  // Not offered on the sent form. Kept so an older export still imports.
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
  'i dont buy / ไม่ได้ซื้อ': 'never',
}

// The sent form's thresholds are 5 / 10 / 15 / forever. There is NO three-minute option and there
// never was one on the live form — the round-1 script that quoted "three minutes" was written
// against the spec, not against what people were asked.
const QUEUE_MAP: Record<string, keyof AudienceAggregate['queuePatience']> = {
  'under 5 minutes': 'under5',
  'ไม่เกิน 5 นาที': 'under5',
  'under 5 minutes / ไม่เกิน 5 นาที': 'under5',
  '10 minutes': 'under10',
  '10 นาที': 'under10',
  '10 minutes / 10 นาที': 'under10',
  '15 minutes': 'under15',
  '15 นาที': 'under15',
  '15 minutes / 15 นาที': 'under15',
  'as long as it takes': 'any',
  'รอได้เรื่อย ๆ': 'any',
  'รอได้เรื่อยๆ': 'any',
  'as long as it takes / รอได้เรื่อย ๆ': 'any',
  'as long as it takes / รอได้เรื่อยๆ': 'any',
}

// NOTE the deliberate asymmetry in the middle band: the live form reads "101 - 200 Baht /
// 100 - 200 บาท" — the English half starts at 101, the Thai half at 100. That is a typo in the
// form, it cannot be fixed retroactively for answers already given, and both halves are therefore
// accepted verbatim. Do not "tidy" this.
const SPEND_MAP: Record<string, keyof AudienceAggregate['spend']> = {
  'below 50 baht': 'under50',
  'น้อยกว่า 50 บาท': 'under50',
  'below 50 baht / น้อยกว่า 50 บาท': 'under50',
  '50 - 100 baht': '50to100',
  '50 - 100 บาท': '50to100',
  '50 - 100 baht / 50 - 100 บาท': '50to100',
  '101 - 200 baht': '101to200',
  '100 - 200 บาท': '101to200',
  '101 - 200 บาท': '101to200',
  '101 - 200 baht / 100 - 200 บาท': '101to200',
  '101 - 200 baht / 101 - 200 บาท': '101to200',
}

const FACTOR_MAP: Record<string, keyof AudienceAggregate['mainFactor']> = {
  'taste': 'taste',
  'รสชาติ': 'taste',
  'taste / รสชาติ': 'taste',
  'price': 'price',
  'ราคา': 'price',
  'price / ราคา': 'price',
  'brand': 'brand',
  'แบรนด์': 'brand',
  'brand / แบรนด์': 'brand',
  'promotion & discount': 'promotion',
  'โปรโมชันและส่วนลด': 'promotion',
  'promotion & discount / โปรโมชันและส่วนลด': 'promotion',
  'convenience & location': 'convenience',
  'ความสะดวกและทำเลที่ตั้ง': 'convenience',
  'convenience & location / ความสะดวกและทำเลที่ตั้ง': 'convenience',
}

/**
 * Locate a column by distinctive substring.
 *
 * Two failure modes, both loud. Missing means the form dropped or renamed a question — the import
 * stops rather than silently producing a bucket of zeros that would look like "nobody chose that".
 * Ambiguous means a key is not distinctive enough and matched two columns; binding to whichever
 * came first would miscount an entire question, so that also stops.
 */
function findColumn(
  header: string[],
  bucketName: string,
  keys: string[],
): number {
  const matches: number[] = []
  header.forEach((h, i) => {
    const norm = normalizeLabel(h)
    if (keys.some((k) => norm.includes(k))) matches.push(i)
  })

  if (matches.length === 0) {
    throw new Error(
      `import-audience: missing required column for "${bucketName}" — no header contained any of: ${keys.join(' | ')}`,
    )
  }
  if (matches.length > 1) {
    throw new Error(
      `import-audience: ambiguous column for "${bucketName}" — ${matches.length} headers matched: ` +
      matches.map((i) => `"${header[i].trim()}"`).join(', ') +
      '. Narrow the key so it identifies exactly one column.',
    )
  }
  return matches[0]
}

/**
 * Parse one answer to the multi-select "what decides your purchase" question.
 *
 * Google Forms joins the chosen options with ", ". None of the option labels contain a comma
 * themselves, so splitting on it is safe — but the labels DO contain " / " and "&", which is why
 * splitting happens before `matchLabel`, not inside it.
 *
 * An empty answer is allowed and contributes nothing: the question is not required on the form,
 * and a blank is a real "did not say", not a malformed row. Every non-blank fragment must still
 * resolve, so a new option added to the form throws rather than being dropped.
 */
function parseMultiSelect<K extends string>(
  raw: string,
  map: Record<string, K>,
  rowNum: number,
  columnName: string,
): K[] {
  const trimmed = raw.trim()
  if (trimmed === '') return []
  const seen = new Set<K>()
  for (const part of trimmed.split(',')) {
    if (part.trim() === '') continue
    // Deduped: a respondent cannot count twice toward one factor even if the export repeats it.
    seen.add(matchLabel(part, map, rowNum, columnName))
  }
  return [...seen]
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

  const colArrival = findColumn(header, 'arrivalMode (how will you travel to the expo?)', HEADER_KEYS.arrivalMode)
  const colWake = findColumn(header, 'wakeTime (what time do you usually wake up?)', HEADER_KEYS.wakeTime)
  const colDrink = findColumn(header, 'firstDrink (first thing you drink)', HEADER_KEYS.firstDrink)
  const colBuy = findColumn(header, 'buyTime (when do you buy your first drink?)', HEADER_KEYS.buyTime)
  const colQueue = findColumn(header, 'queuePatience (how long would you wait in line?)', HEADER_KEYS.queuePatience)
  const colSpend = findColumn(header, 'spend (how much do you usually spend?)', HEADER_KEYS.spend)
  const colFactor = findColumn(header, 'mainFactor (what is the main factor?)', HEADER_KEYS.mainFactor)

  if (lines.length === 1) {
    throw new Error('import-audience: CSV has a header row but no data rows')
  }

  const result: AudienceAggregate = {
    respondents: 0,
    arrivalMode: { walk: 0, bus: 0, car: 0, moto: 0 },
    wakeTime: { before6: 0, '6to8': 0, '8to10': 0, after10: 0 },
    firstDrink: { coffee: 0, tea: 0, water: 0, nothing: 0 },
    buyTime: { before7: 0, '7to9': 0, '9to11': 0, after11: 0, never: 0 },
    queuePatience: { under5: 0, under10: 0, under15: 0, any: 0 },
    spend: { under50: 0, '50to100': 0, '101to200': 0 },
    mainFactor: { taste: 0, price: 0, brand: 0, promotion: 0, convenience: 0 },
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
    const spend = matchLabel(fields[colSpend], SPEND_MAP, rowNum, header[colSpend])
    const factors = parseMultiSelect(fields[colFactor], FACTOR_MAP, rowNum, header[colFactor])

    result.arrivalMode[arrival]++
    result.wakeTime[wake]++
    result.firstDrink[drink]++
    result.buyTime[buy]++
    result.queuePatience[queue]++
    result.spend[spend]++
    // Multi-select: one respondent increments as many factors as they named, so this bucket
    // sums to more than `respondents`. That is correct, and asserted nowhere against a total.
    for (const f of factors) result.mainFactor[f]++
    result.respondents++
  }

  return result
}

// --- file I/O wrapper (not exercised by tests) ----------------------------------------------

function renderModule(aggregate: AudienceAggregate): string {
  // Valid JSON is valid TypeScript, so this is a complete, correctly-typed object literal as-is.
  const json = JSON.stringify(aggregate, null, 2)
  const factorTotal = Object.values(aggregate.mainFactor).reduce((a, b) => a + b, 0)

  return `// The audience aggregate — the single seam where real registration data enters The Decision
// Room. Every downstream module (simulator, dashboards, game store) reads AUDIENCE from here
// and nothing else touches the registration CSV.
//
// GENERATED by scripts/import-audience.ts from the real registration export. Do not hand-edit the
// numbers; re-run the import against a fresh CSV instead. The survey stays open until the event,
// so this file is expected to be regenerated more than once.
//
// THE SHAPE BELOW IS THE FORM THAT WAS ACTUALLY SENT, not the one this project was first written
// against. The live form differs from docs/registration-questions.md in ways that each broke
// something:
//
//   - Queue patience thresholds are 5 / 10 / 15 / forever. The old schema floor was 3 minutes and
//     the original round-1 script was built on "you said you walk away after three minutes".
//     Nobody was ever offered three minutes.
//   - \`Bus\` replaced \`BTS / MRT\`.
//   - Two questions were ADDED — what people usually SPEND, and what actually DECIDES their
//     purchase. Those two now carry the data hooks (see content/persona.ts); they have far more signal than
//     the five they were added to.
//   - \`nothing\` is no longer offered as a first drink. Kept in the type, so a zero is honest
//     and the option can return, but nobody can currently land in it.

export type AudienceAggregate = {
  respondents: number
  arrivalMode: Record<'walk' | 'bus' | 'car' | 'moto', number>
  wakeTime: Record<'before6' | '6to8' | '8to10' | 'after10', number>
  firstDrink: Record<'coffee' | 'tea' | 'water' | 'nothing', number>
  buyTime: Record<'before7' | '7to9' | '9to11' | 'after11' | 'never', number>
  /** Minutes they will stand in a queue before giving up. \`any\` never leaves. */
  queuePatience: Record<'under5' | 'under10' | 'under15' | 'any', number>
  /**
   * What they say they usually pay for a drink, ฿. Round 1 reads the TOP of each band as that
   * person's ceiling. Kept for context; the persona game quotes counts, not a price model.
   */
  spend: Record<'under50' | '50to100' | '101to200', number>
  /**
   * What decides the purchase. MULTI-SELECT: these DO NOT sum to \`respondents\` (here they sum
   * to ${factorTotal} across ${aggregate.respondents} people), and \`bucketTotal\` must never be
   * asserted against this field. content/audience.test.ts exempts it by name rather than relaxing
   * the check for the others.
   *
   * This is the column that answers "why would cutting the price not work?" — it is deliberately
   * NOT a term in the round-1 simulation, where a coefficient would bury it. It is evidence on
   * the outcome screen, explaining the volume that did not move.
   */
  mainFactor: Record<'taste' | 'price' | 'brand' | 'promotion' | 'convenience', number>
}

/** Single-choice fields, which must sum to \`respondents\`. \`mainFactor\` is deliberately absent. */
export const SINGLE_CHOICE_FIELDS = [
  'arrivalMode', 'wakeTime', 'firstDrink', 'buyTime', 'queuePatience', 'spend',
] as const

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
    console.error('Usage: node scripts/import-audience.ts <registration-export.csv> [content/audience.ts]')
    console.error('')
    console.error('Use `node`, NOT `npx tsx` — this file ends in a top-level await, which tsx')
    console.error('cannot transform under its CommonJS output ("ERR_REQUIRE_ASYNC_MODULE").')
    console.error('Node 22+ strips the TypeScript itself and runs it as an ES module.')
    console.error('')
    console.error('The output path is optional and defaults to content/audience.ts, which is')
    console.error('what you want — that file is GENERATED and is meant to be overwritten.')
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
