import type { Lang } from './types'

const STRINGS = {
  appTitle:      { th: '🕵️ นักสืบ AI', en: '🕵️ AI Detective' },
  tagline:       { th: 'คิดกับ AI ไม่ใช่แค่เชื่อ AI', en: 'Think with AI, not just trust AI.' },
  enterCodename: { th: 'ตั้งชื่อรหัสนักสืบของคุณ', en: 'Choose your detective codename' },
  randomName:    { th: '🎲 สุ่มชื่อให้ฉัน', en: '🎲 Give me a codename' },
  startMission:  { th: 'เริ่มภารกิจ', en: 'Begin the mission' },
  caseFile:      { th: '📂 แฟ้มคดี', en: '📂 Case File' },
  retrieving:    { th: 'กำลังค้นหาจากแฟ้มคดี…', en: 'Retrieving from Case File…' },
  retrieved:     { th: 'พบเอกสาร', en: 'retrieved' },
  notFound:      { th: 'ไม่พบเอกสาร', en: 'NOT FOUND' },
  aiAnswer:      { th: '🤖 คำตอบของ AI', en: '🤖 AI Answer' },
  yourVerdict:   { th: '✅ คำตัดสินของคุณ', en: '✅ Your Verdict' },
  submit:        { th: 'ยืนยันคำตัดสิน', en: 'Commit to your verdict' },
  nextCase:      { th: 'คดีถัดไป →', en: 'Next case →' },
  finished:      { th: 'ปิดคดีครบทั้ง 5 คดีแล้ว', en: 'All 5 cases closed' },
  yourScore:     { th: 'คะแนนของคุณ', en: 'Your score' },
  waitReveal:    { th: 'รอการเฉลยพร้อมกันบนจอใหญ่', en: 'Wait for the group reveal on the big screen' },
  fictional:     { th: 'เอกสารสมมติ', en: 'FICTIONAL' },
  detectives:    { th: 'นักสืบ', en: 'Detectives' },
  finishedCount: { th: 'ไขคดีครบแล้ว', en: 'Finished' },
  fooledBy:      { th: 'ถูก AI หลอก', en: 'fooled by the AI' },
  leaderboard:   { th: 'อันดับนักสืบ', en: 'Leaderboard' },
  statsWall:     { th: 'สถิติห้อง', en: 'Stats Wall' },
  toggleHint:    { th: 'กด [L] เพื่อสลับมุมมอง', en: 'Press [L] to switch panels' },
  caseLabel:     { th: 'คดี', en: 'Case' },
  sessionReset:  { th: 'เซสชันถูกรีเซ็ต กรุณาเริ่มใหม่', en: 'The session was reset — please start again' },
  waitingForDetectives: { th: 'รอนักสืบเข้าร่วม…', en: 'Waiting for detectives…' },
  reveal:        { th: '🎯 เฉลย', en: '🎯 Reveal' },
  changeCaseHint: { th: 'เปลี่ยนคดี', en: 'change case' },
} as const

export type UIKey = keyof typeof STRINGS

export function t(key: UIKey, lang: Lang): string {
  return STRINGS[key][lang]
}
