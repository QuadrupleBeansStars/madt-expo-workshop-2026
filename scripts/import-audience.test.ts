import { describe, it, expect } from 'vitest'
import { parseAudienceCsv } from './import-audience'

const HEADER_EN =
  'Name,Email,How will you travel to the expo?,What time do you usually wake up on a weekday?,What is the first thing you drink in the morning?,When do you usually buy your first drink of the day?,How long would you wait in line for coffee before giving up?'

const HEADER_TH =
  'ชื่อ,อีเมล,คุณจะเดินทางมางานอย่างไร?,ปกติวันธรรมดาคุณตื่นกี่โมง?,เช้ามาคุณดื่มอะไรเป็นอย่างแรก?,ปกติคุณซื้อเครื่องดื่มแก้วแรกของวันตอนกี่โมง?,คุณจะยอมต่อคิวกาแฟนานแค่ไหนก่อนจะเลิกซื้อ?'

describe('parseAudienceCsv', () => {
  it('parses a well-formed English-label CSV with 3 rows into correct counts', () => {
    const csv = [
      HEADER_EN,
      'Alice,alice@x.com,Walk,6–8,Coffee,7–9,Under 3 minutes',
      'Bob,bob@x.com,BTS / MRT,8–10,Tea,9–11,3–5 minutes',
      'Cara,cara@x.com,Car,Before 6,Water,I don\'t buy,As long as it takes',
    ].join('\n')

    const result = parseAudienceCsv(csv)

    expect(result.respondents).toBe(3)
    expect(result.arrivalMode).toEqual({ walk: 1, train: 1, car: 1, moto: 0 })
    expect(result.wakeTime).toEqual({ before6: 1, '6to8': 1, '8to10': 1, after10: 0 })
    expect(result.firstDrink).toEqual({ coffee: 1, tea: 1, water: 1, nothing: 0 })
    expect(result.buyTime).toEqual({ before7: 0, '7to9': 1, '9to11': 1, after11: 0, never: 1 })
    expect(result.queuePatience).toEqual({ under3: 1, '3to5': 1, '5to10': 0, any: 1 })
  })

  it('parses Thai option labels', () => {
    const csv = [
      HEADER_TH,
      'สมชาย,x@x.com,เดินมา,6–8 โมง,กาแฟ,7–9 โมง,ไม่เกิน 3 นาที',
      'สมหญิง,y@x.com,มอเตอร์ไซค์,หลัง 10 โมง,ยังไม่ได้ดื่มอะไร,หลัง 11 โมง,รอได้เรื่อย ๆ',
    ].join('\n')

    const result = parseAudienceCsv(csv)

    expect(result.respondents).toBe(2)
    expect(result.arrivalMode).toEqual({ walk: 1, train: 0, car: 0, moto: 1 })
    expect(result.wakeTime).toEqual({ before6: 0, '6to8': 1, '8to10': 0, after10: 1 })
    expect(result.firstDrink).toEqual({ coffee: 1, tea: 0, water: 0, nothing: 1 })
    expect(result.buyTime).toEqual({ before7: 0, '7to9': 1, '9to11': 0, after11: 1, never: 0 })
    expect(result.queuePatience).toEqual({ under3: 1, '3to5': 0, '5to10': 0, any: 1 })
  })

  it('parses the combined "English / Thai" label form used verbatim in the registration doc', () => {
    const csv = [
      HEADER_EN,
      "Eve,eve@x.com,Walk / เดินมา,Before 6 / ก่อน 6 โมง,Coffee / กาแฟ,7-9 / 7-9 โมง,As long as it takes / รอได้เรื่อย ๆ",
    ].join('\n')

    const result = parseAudienceCsv(csv)

    expect(result.respondents).toBe(1)
    expect(result.arrivalMode.walk).toBe(1)
    expect(result.wakeTime.before6).toBe(1)
    expect(result.firstDrink.coffee).toBe(1)
    expect(result.buyTime['7to9']).toBe(1)
    expect(result.queuePatience.any).toBe(1)
  })

  it('is tolerant of case, surrounding whitespace, and hyphen-vs-en-dash', () => {
    const csv = [
      HEADER_EN,
      '  Frank  ,frank@x.com,  WALK  ,6-8,  Coffee ,7–9,under 3 minutes',
    ].join('\n')

    const result = parseAudienceCsv(csv)

    expect(result.respondents).toBe(1)
    expect(result.arrivalMode.walk).toBe(1)
    expect(result.wakeTime['6to8']).toBe(1)
    expect(result.firstDrink.coffee).toBe(1)
    expect(result.buyTime['7to9']).toBe(1)
    expect(result.queuePatience.under3).toBe(1)
  })

  it('ignores extra columns such as attendee type and timestamp', () => {
    const csv = [
      'Timestamp,' + HEADER_EN + ',Attendee Type',
      '2026-08-01T09:00:00Z,Dee,dee@x.com,Car,8–10,Nothing,After 11,5–10 minutes,Student',
    ].join('\n')

    const result = parseAudienceCsv(csv)

    expect(result.respondents).toBe(1)
    expect(result.arrivalMode.car).toBe(1)
    expect(result.buyTime.after11).toBe(1)
    expect(result.queuePatience['5to10']).toBe(1)
  })

  it('throws naming the row and column when an option label is unrecognized', () => {
    const csv = [
      HEADER_EN,
      'Alice,alice@x.com,Walk,6–8,Coffee,7–9,Under 3 minutes',
      'Bob,bob@x.com,Unicycle,8–10,Tea,9–11,3–5 minutes',
    ].join('\n')

    expect(() => parseAudienceCsv(csv)).toThrowError(/row 3/i)
    expect(() => parseAudienceCsv(csv)).toThrowError(/travel to the expo/i)
  })

  it('throws on an empty CSV', () => {
    expect(() => parseAudienceCsv('')).toThrow()
  })

  it('throws on a CSV with only a header row and no data', () => {
    expect(() => parseAudienceCsv(HEADER_EN)).toThrow()
  })

  it('throws when the header is missing a required column', () => {
    const csv = [
      'Name,Email,What is the first thing you drink in the morning?',
      'Alice,alice@x.com,Coffee',
    ].join('\n')

    expect(() => parseAudienceCsv(csv)).toThrow(/travel to the expo|arrival/i)
  })

  it('throws naming the row when a data row has the wrong field count', () => {
    const csv = [
      HEADER_EN,
      'Alice,alice@x.com,Walk,6–8,Coffee,7–9,Under 3 minutes',
      'Bob,bob@x.com,BTS / MRT,8–10,Tea,9–11',
    ].join('\n')

    expect(() => parseAudienceCsv(csv)).toThrowError(/row 3/i)
  })
})
