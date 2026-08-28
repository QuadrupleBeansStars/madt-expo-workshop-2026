// Café Persona — every fixed UI string on the projector (`UI`) and the phone (`PHONE`).
//
// Rendering uses `.th` only (the workshop is Thai-first); `.en` is documentation for the team.
// The EXCEPTIONS are the persona labels and axis names, which are English by design and live in
// lib/room-types.ts (AXIS_LABELS) and content/persona.ts (Persona.label) — framework language,
// like MBTI's letters, not conversational copy.

import type { LocalizedText } from '@/lib/types'

export const UI: Record<string, LocalizedText> = {
  title:        { th: 'Café Persona', en: 'Café Persona' },
  joinTitle:    { th: 'เข้าร่วมด้วยมือถือของคุณ', en: 'Join on your phone' },
  namesPage:    { th: 'หน้า', en: 'page' },
  startBtn:     { th: 'เปิดร้าน', en: 'Open the café' },
  inTheRoom:    { th: 'คนในห้องแล้ว', en: 'in the room' },
  questionOf:   { th: 'คำถามที่', en: 'Question' },           // "คำถามที่ 3/8"
  votesIn:      { th: 'ตอบแล้ว', en: 'answered' },
  roomPicked:   { th: 'ห้องนี้เลือก', en: 'the room picked' },
  mostPicked:   { th: 'ส่วนใหญ่', en: 'most picked' },
  resultTitle:  { th: 'ห้องนี้ประกอบด้วย', en: 'This room is made of' },
  resultHint:   { th: 'ดูการ์ดของคุณบนมือถือ', en: 'See your card on your phone' },
  hostToken:    { th: 'รหัสผู้ดำเนินรายการ', en: 'Facilitator token' },
  gateTitle:    { th: 'ห้องหลังร้าน', en: 'Back of house' },
  gateBlurb:    { th: 'ใส่รหัสผู้ดำเนินรายการเพื่อเปิดร้าน', en: 'Enter the facilitator token to open the café' },
  gateButton:   { th: 'เข้าห้องหลังร้าน', en: 'Enter back of house' },
  advance:      { th: 'ถัดไป', en: 'Next' },
  backBtn:      { th: 'ย้อน', en: 'Back' },
  reset:        { th: 'เริ่มใหม่', en: 'Reset' },
  resetArmed:   { th: 'กดอีกครั้งเพื่อยืนยันเริ่มใหม่', en: 'Press again to confirm reset' },
  tokenWrong:   { th: 'รหัสไม่ถูกต้อง', en: 'Wrong token' },
  tokenMissing: { th: 'ใส่รหัสผู้ดำเนินรายการก่อน', en: 'Enter the facilitator token' },
  offline:      { th: 'ขาดการเชื่อมต่อ — ค้างภาพล่าสุดไว้', en: 'Offline — holding last frame' },
}

export const PHONE: Record<string, LocalizedText> = {
  joinTitle:    { th: 'Café Persona', en: 'Café Persona' },
  // No blurb under the title on the join screen. It used to read "ตอบ 8 ข้อ แล้วดูว่าคุณเป็นกาแฟแก้วไหน"
  // and the team took it out: the host says that line out loud, and a phone that spells out the
  // whole game before it starts spends the reveal it was supposed to save.
  namePrompt:   { th: 'ชื่อร้านของคุณ', en: 'Your café name' },
  nameRequired: { th: 'ใส่ชื่อก่อนนะ', en: 'Name required' },
  joinButton:   { th: 'เข้าร่วม', en: 'Join' },
  joining:      { th: 'กำลังเข้าร่วม…', en: 'Joining…' },
  joinFailed:   { th: 'เข้าร่วมไม่สำเร็จ ลองอีกครั้ง', en: 'Join failed, try again' },
  waitHost:     { th: 'รอผู้ดำเนินรายการเริ่ม', en: 'Waiting for the host' },
  pickOne:      { th: 'คุณจะทำยังไง?', en: 'What do you do?' },
  picked:       { th: 'บันทึกแล้ว — เปลี่ยนใจได้จนกว่าจะเฉลย', en: 'Saved — change your mind until reveal' },
  watchScreen:  { th: 'ดูจอใหญ่', en: 'Eyes on the big screen' },
  youPicked:    { th: 'คุณเลือก', en: 'You picked' },
  tooLate:      { th: 'ข้อนี้ปิดแล้ว รอข้อถัดไปนะ', en: 'This one is closed — next question soon' },
  roomReset:    { th: 'ห้องถูกรีเซ็ต — เข้าร่วมใหม่อีกครั้ง', en: 'The room was reset — join again' },
  yourType:     { th: 'คุณคือ', en: 'You are' },
  strength:     { th: 'จุดแข็ง', en: 'Strength' },
  caution:      { th: 'ระวัง', en: 'Watch out' },
  partner:      { th: 'คู่หูที่เติมเต็ม', en: 'Your complement' },
  lateJoiner:   { th: 'มาสายไปนิด — ไว้เจอกันรอบหน้า ลองคุยกับเพื่อนข้าง ๆ ว่าได้การ์ดอะไร',
                  en: 'A bit late — ask a neighbor what card they got' },
  offline:      { th: 'ขาดการเชื่อมต่อ…', en: 'Offline…' },
}
