import { describe, it, expect } from 'vitest'
import { parseAudienceCsv } from './import-audience'

/*
 * These fixtures are the LIVE form, not the spec'd one. The header below is copied verbatim from
 * the real Google Forms export, including the details that broke the previous parser:
 *
 *   - the English and Thai halves of each question are separated by a SPACE, not " / "
 *   - the mainFactor header carries a double space and a trailing space
 *   - option values use en dashes ("6–8"), and the spend band reads "101 - 200 Baht / 100 - 200
 *     บาท" — the English half starts at 101 and the Thai half at 100. That is a typo on the form
 *     itself and cannot be corrected retroactively for answers already given, so both are accepted.
 *
 * A test suite written against the tidy version of a form is a test suite that passes while the
 * import fails on the day.
 */
const HEADER_LIVE = [
  'Timestamp',
  'เพศ',
  'อายุ',
  'How will you travel to the expo? คุณจะเดินทางมางานอย่างไร?',
  'What time do you usually wake up on a weekday? ปกติวันธรรมดาคุณตื่นกี่โมง?',
  'What is the first thing you drink in the morning? เช้ามาคุณดื่มอะไรเป็นอย่างแรก?',
  'When do you usually buy your first drink of the day? ปกติคุณซื้อเครื่องดื่มแก้วแรกของวันตอนกี่โมง?',
  'How long would you wait in line for drinks before giving up? คุณจะยอมต่อคิวซื้อน้ำนานแค่ไหนก่อนจะล้มเลิก?',
  'How much do you usually spend on a drink? ปกติคุณซื้อเครื่องดื่มในราคาเท่าไหร่?',
  'What is the main factor when you buy a drink?  ปัจจัยหลักในการเลือกซื้อเครื่องดื่มของคุณคืออะไร?  ',
].join(',')

/** One row in the live combined-label form. */
const row = (
  travel: string, wake: string, drink: string, buy: string,
  queue: string, spend: string, factors: string,
) => `8/3/2026 17:06:02,หญิง,20-25,${travel},${wake},${drink},${buy},${queue},${spend},"${factors}"`

describe('parseAudienceCsv — the live form', () => {
  it('parses the real export shape into correct counts', () => {
    const csv = [
      HEADER_LIVE,
      row('Car / รถยนต์', '8–10 / 8–10 โมง', 'Water / น้ำเปล่า', 'After 11 / หลัง 11 โมง',
          '10 minutes / 10 นาที', '50 - 100 Baht / 50 - 100 บาท',
          'Taste / รสชาติ, Price / ราคา, Convenience & Location / ความสะดวกและทำเลที่ตั้ง'),
      row('Walk / เดินมา', 'Before 6 / ก่อน 6 โมง', 'Coffee / กาแฟ', '7–9 / 7–9 โมง',
          'Under 5 minutes / ไม่เกิน 5 นาที', '101 - 200 Baht / 100 - 200 บาท',
          'Taste / รสชาติ, Brand / แบรนด์'),
      row('Bus / รถเมล์ รถสาธารณะ', 'After 10 / หลัง 10 โมง', 'Tea / ชา', "I don't buy / ไม่ได้ซื้อ",
          'As long as it takes / รอได้เรื่อย ๆ', 'Below 50 Baht / น้อยกว่า 50 บาท',
          'Promotion & Discount / โปรโมชันและส่วนลด'),
    ].join('\n')

    const r = parseAudienceCsv(csv)

    expect(r.respondents).toBe(3)
    expect(r.arrivalMode).toEqual({ walk: 1, bus: 1, car: 1, moto: 0 })
    expect(r.wakeTime).toEqual({ before6: 1, '6to8': 0, '8to10': 1, after10: 1 })
    expect(r.firstDrink).toEqual({ coffee: 1, tea: 1, water: 1, nothing: 0 })
    expect(r.buyTime).toEqual({ before7: 0, '7to9': 1, '9to11': 0, after11: 1, never: 1 })
    expect(r.queuePatience).toEqual({ under5: 1, under10: 1, under15: 0, any: 1 })
    expect(r.spend).toEqual({ under50: 1, '50to100': 1, '101to200': 1 })
  })

  it('counts a multi-select answer once per option named, not once per respondent', () => {
    const csv = [
      HEADER_LIVE,
      row('Car / รถยนต์', '6–8 / 6–8 โมง', 'Coffee / กาแฟ', '7–9 / 7–9 โมง',
          '10 minutes / 10 นาที', '50 - 100 Baht / 50 - 100 บาท',
          'Taste / รสชาติ, Price / ราคา, Brand / แบรนด์, Promotion & Discount / โปรโมชันและส่วนลด'),
      row('Car / รถยนต์', '6–8 / 6–8 โมง', 'Coffee / กาแฟ', '7–9 / 7–9 โมง',
          '10 minutes / 10 นาที', '50 - 100 Baht / 50 - 100 บาท', 'Taste / รสชาติ'),
    ].join('\n')

    const r = parseAudienceCsv(csv)

    // Two respondents, six factor selections between them. This bucket must NOT sum to 2.
    expect(r.respondents).toBe(2)
    expect(r.mainFactor).toEqual({ taste: 2, price: 1, brand: 1, promotion: 1, convenience: 0 })
  })

  it('accepts a blank multi-select — the question is not required on the form', () => {
    const csv = [
      HEADER_LIVE,
      row('Car / รถยนต์', '6–8 / 6–8 โมง', 'Coffee / กาแฟ', '7–9 / 7–9 โมง',
          '10 minutes / 10 นาที', '50 - 100 Baht / 50 - 100 บาท', ''),
    ].join('\n')

    const r = parseAudienceCsv(csv)
    expect(r.respondents).toBe(1)   // the row still counts as a respondent
    expect(r.mainFactor.taste).toBe(0)
  })

  it('accepts the form typo in the spend band, in both directions', () => {
    // The English half says 101, the Thai half says 100. Both are the same bucket.
    for (const label of ['101 - 200 Baht / 100 - 200 บาท', '101 - 200 Baht', '100 - 200 บาท']) {
      const csv = [
        HEADER_LIVE,
        row('Car / รถยนต์', '6–8 / 6–8 โมง', 'Coffee / กาแฟ', '7–9 / 7–9 โมง',
            '10 minutes / 10 นาที', label, 'Taste / รสชาติ'),
      ].join('\n')
      expect(parseAudienceCsv(csv).spend['101to200'], label).toBe(1)
    }
  })

  it('is tolerant of case, whitespace, and hyphen-vs-en-dash', () => {
    const csv = [
      HEADER_LIVE,
      row('  CAR  ', ' 6-8 ', '  Coffee ', '7–9', 'UNDER 5 MINUTES',
          ' 50 - 100 baht ', ' Taste '),
    ].join('\n')

    const r = parseAudienceCsv(csv)
    expect(r.arrivalMode.car).toBe(1)
    expect(r.wakeTime['6to8']).toBe(1)
    expect(r.queuePatience.under5).toBe(1)
    expect(r.spend['50to100']).toBe(1)
    expect(r.mainFactor.taste).toBe(1)
  })

  it('still accepts the older label set, so an earlier export does not throw', () => {
    // Headers here use the spec's " / " separator and the retired BTS/MRT option.
    const header = [
      'Name', 'Email',
      'How will you travel to the expo? / คุณจะเดินทางมางานอย่างไร?',
      'What time do you usually wake up on a weekday?',
      'What is the first thing you drink in the morning?',
      'When do you usually buy your first drink of the day?',
      'How long would you wait in line for coffee before giving up?',
      'How much do you usually spend on a drink?',
      'What is the main factor when you buy a drink?',
    ].join(',')
    const csv = [
      header,
      'Alice,a@x.com,BTS / MRT,6–8,Nothing,7–9,Under 5 minutes,Below 50 Baht,Taste',
    ].join('\n')

    const r = parseAudienceCsv(csv)
    expect(r.arrivalMode.bus).toBe(1)      // BTS/MRT folds into the bucket that replaced it
    expect(r.firstDrink.nothing).toBe(1)
  })
})

describe('parseAudienceCsv — failure policy', () => {
  const okRow = row('Car / รถยนต์', '6–8 / 6–8 โมง', 'Coffee / กาแฟ', '7–9 / 7–9 โมง',
                    '10 minutes / 10 นาที', '50 - 100 Baht / 50 - 100 บาท', 'Taste / รสชาติ')

  it('throws naming the row and column when an option label is unrecognized', () => {
    const csv = [
      HEADER_LIVE,
      okRow,
      row('Unicycle', '6–8 / 6–8 โมง', 'Coffee / กาแฟ', '7–9 / 7–9 โมง',
          '10 minutes / 10 นาที', '50 - 100 Baht / 50 - 100 บาท', 'Taste / รสชาติ'),
    ].join('\n')

    expect(() => parseAudienceCsv(csv)).toThrowError(/row 3/i)
    expect(() => parseAudienceCsv(csv)).toThrowError(/travel to the expo/i)
  })

  it('throws on a NEW multi-select option rather than dropping it', () => {
    // If a factor is added to the form, the import must stop — a silently ignored option would
    // understate a bucket the round 2 ordering is justified by.
    const csv = [
      HEADER_LIVE,
      row('Car / รถยนต์', '6–8 / 6–8 โมง', 'Coffee / กาแฟ', '7–9 / 7–9 โมง',
          '10 minutes / 10 นาที', '50 - 100 Baht / 50 - 100 บาท',
          'Taste / รสชาติ, Sustainability / ความยั่งยืน'),
    ].join('\n')

    expect(() => parseAudienceCsv(csv)).toThrowError(/sustainability/i)
  })

  it('throws on an empty CSV', () => {
    expect(() => parseAudienceCsv('')).toThrow()
  })

  it('throws on a CSV with only a header row and no data', () => {
    expect(() => parseAudienceCsv(HEADER_LIVE)).toThrow()
  })

  it('throws when the header is missing a required column', () => {
    const csv = [
      'Name,What is the first thing you drink in the morning?',
      'Alice,Coffee',
    ].join('\n')
    expect(() => parseAudienceCsv(csv)).toThrow(/travel to the expo|arrival/i)
  })

  it('throws, rather than guessing, when one key matches two columns', () => {
    // Two spend-like columns is a form someone edited badly. Binding to the first would miscount
    // an entire question silently.
    const csv = [
      HEADER_LIVE + ',How much do you usually spend on a drink? (weekends)',
      okRow + ',50 - 100 Baht',
    ].join('\n')
    expect(() => parseAudienceCsv(csv)).toThrowError(/ambiguous/i)
  })

  it('throws naming the row when a data row has the wrong field count', () => {
    const csv = [HEADER_LIVE, okRow, 'a,b,c'].join('\n')
    expect(() => parseAudienceCsv(csv)).toThrowError(/row 3/i)
  })
})
