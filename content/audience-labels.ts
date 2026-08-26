// Café Persona — Thai words for the audience distributions the ask-stage charts plot.
//
// Recovered from the Decision Room's label tables (git 691ab7f): these are the QUESTIONS AS THEY
// APPEARED ON THE REGISTRATION FORM, and the bucket labels the room tapped weeks ago. The chart
// asks the audience to recognise their own answer, so the words must not drift from the form.

import type { AudienceAggregate } from '@/content/audience'
import type { LocalizedText } from '@/lib/types'

export type AudienceField = keyof Omit<AudienceAggregate, 'respondents'>

type Labels = Record<string, LocalizedText>

/** The survey question, verbatim — the chart's title. */
export const FIELD_TITLES: Record<AudienceField, LocalizedText> = {
  arrivalMode: { en: 'How will you travel to the expo?', th: 'คุณจะเดินทางมางานอย่างไร?' },
  wakeTime: { en: 'What time do you usually wake up on a weekday?', th: 'ปกติวันธรรมดาคุณตื่นกี่โมง?' },
  firstDrink: { en: 'What is the first thing you drink in the morning?', th: 'เช้ามาคุณดื่มอะไรเป็นอย่างแรก?' },
  firstBuy: { en: 'What is the first drink you BUY each day?', th: 'เครื่องดื่มแก้วแรกที่คุณซื้อในแต่ละวันคืออะไร?' },
  buyTime: { en: 'When do you usually buy your first drink of the day?', th: 'ปกติคุณซื้อเครื่องดื่มแก้วแรกของวันตอนกี่โมง?' },
  queuePatience: { en: 'How long would you wait in line for drinks before giving up?', th: 'คุณจะยอมต่อคิวซื้อน้ำนานแค่ไหนก่อนจะล้มเลิก?' },
  spend: { en: 'How much do you usually spend on a drink?', th: 'ปกติคุณซื้อเครื่องดื่มในราคาเท่าไหร่?' },
  mainFactor: { en: 'What is the main factor when you buy a drink?', th: 'ปัจจัยหลักในการเลือกซื้อเครื่องดื่มของคุณคืออะไร?' },
}

export const BUCKET_LABELS: Record<AudienceField, Labels> = {
  arrivalMode: {
    walk: { en: 'Walk', th: 'เดินมา' },
    bus: { en: 'Bus', th: 'รถเมล์ รถสาธารณะ' },
    car: { en: 'Car', th: 'รถยนต์' },
    moto: { en: 'Motorbike', th: 'มอเตอร์ไซค์' },
  },
  wakeTime: {
    before6: { en: 'Before 6', th: 'ก่อน 6 โมง' },
    '6to8': { en: '6–8', th: '6–8 โมง' },
    '8to10': { en: '8–10', th: '8–10 โมง' },
    after10: { en: 'After 10', th: 'หลัง 10 โมง' },
  },
  firstBuy: {
    coffee: { en: 'Coffee', th: 'กาแฟ' },
    tea: { en: 'Tea', th: 'ชา' },
    juice: { en: 'Juice', th: 'น้ำผลไม้' },
    milk: { en: 'Milk / milk drinks', th: 'นม หรือเครื่องดื่มนม' },
    none: { en: 'I do not buy one', th: 'ไม่ได้ซื้อ' },
  },
  firstDrink: {
    coffee: { en: 'Coffee', th: 'กาแฟ' },
    tea: { en: 'Tea', th: 'ชา' },
    water: { en: 'Water', th: 'น้ำเปล่า' },
    nothing: { en: 'Nothing', th: 'ยังไม่ได้ดื่มอะไร' },
  },
  buyTime: {
    before7: { en: 'Before 07:00', th: 'ก่อน 7 โมง' },
    '7to9': { en: '07:00–09:00', th: '7–9 โมง' },
    '9to11': { en: '09:00–11:00', th: '9–11 โมง' },
    after11: { en: 'After 11:00', th: 'หลัง 11 โมง' },
    never: { en: 'I don’t buy', th: 'ไม่ได้ซื้อ' },
  },
  queuePatience: {
    under5: { en: 'Under 5 minutes', th: 'ไม่เกิน 5 นาที' },
    under10: { en: '10 minutes', th: '10 นาที' },
    under15: { en: '15 minutes', th: '15 นาที' },
    any: { en: 'As long as it takes', th: 'รอได้เรื่อย ๆ' },
  },
  spend: {
    under50: { en: 'Below ฿50', th: 'น้อยกว่า 50 บาท' },
    '50to100': { en: '฿50–100', th: '50–100 บาท' },
    '101to200': { en: '฿101–200', th: '101–200 บาท' },
  },
  mainFactor: {
    taste: { en: 'Taste', th: 'รสชาติ' },
    price: { en: 'Price', th: 'ราคา' },
    brand: { en: 'Brand', th: 'แบรนด์' },
    promotion: { en: 'Promotion & discount', th: 'โปรโมชันและส่วนลด' },
    convenience: { en: 'Convenience & location', th: 'ความสะดวกและทำเลที่ตั้ง' },
  },
}

/**
 * Ordinal fields keep the form's bucket order (a time axis sorted by popularity is nonsense);
 * categorical fields sort by count, biggest bar first.
 */
export const ORDINAL_FIELDS: ReadonlySet<AudienceField> = new Set([
  'wakeTime', 'buyTime', 'queuePatience', 'spend',
])

/**
 * MULTI-SELECT: the bars sum to more than the number of people, and any screen plotting this
 * field MUST say so — "18 of 18 chose taste" does not mean taste was the only thing anyone
 * cared about. This is the old workshop's honesty rule, kept.
 */
export const MULTI_SELECT_FIELDS: ReadonlySet<AudienceField> = new Set(['mainFactor'])
