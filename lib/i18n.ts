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
  newDetective:  { th: 'เริ่มใหม่ (นักสืบคนใหม่)', en: 'New detective' },
  joinFailed:    { th: 'เข้าร่วมไม่สำเร็จ กรุณาลองอีกครั้ง', en: 'Could not join — please try again' },
  restart:       { th: 'เริ่มใหม่', en: 'Restart' },
  restartConfirm: { th: 'ยืนยันเริ่มใหม่? คุณจะเสียความคืบหน้าในคดีนี้', en: 'Are you sure? You will lose progress on this case.' },
  restartConfirmYes: { th: 'ใช่ เริ่มใหม่', en: 'Yes, restart' },
  restartCancel: { th: 'ยกเลิก', en: 'Cancel' },
  lobby:            { th: 'ห้องรอ', en: 'Lobby' },
  waitingToStart:   { th: 'รอผู้ดำเนินรายการเริ่มเกม…', en: 'Waiting for the host to start…' },
  detectivesInRoom: { th: 'นักสืบในห้อง', en: 'Detectives in the room' },
  hostStart:        { th: '▶ เริ่มเกม', en: '▶ Start game' },
  hostNext:         { th: 'ถัดไป →', en: 'Next →' },
  // Deliberately says "close" rather than "skip": this button stops on the reveal, it does not
  // jump the case. A host reading "skip" mid-session would expect the latter.
  hostRevealNow:    { th: '⏭ ปิดข้อนี้ เฉลยเลย', en: '⏭ Close it — reveal now' },
  // The teaching beat on the reveal screen. `teachingTrick` is worded to survive case 5, where
  // there is no trick — "what this one tested" works whether the AI lied or told the truth.
  teachingTitle:    { th: 'บทเรียนจากข้อนี้', en: 'What this case teaches' },
  teachingTrick:    { th: 'ข้อนี้ทดสอบอะไร', en: 'What it tested' },
  teachingCheck:    { th: 'ครั้งหน้าให้เช็กอะไร', en: 'What to check next time' },
  hostReset:        { th: '↺ รีเซ็ตห้อง', en: '↺ Reset room' },
  // Armed state. Must NOT read as a repeat of the label — it is the last thing between the host
  // and ejecting every phone in the room, so it says what is about to happen.
  hostResetArmed:   { th: '⚠ กดอีกครั้งเพื่อล้างห้อง', en: '⚠ Press again to clear the room' },
  standings:        { th: 'อันดับตอนนี้', en: 'STANDINGS' },
  roundInProgress:  { th: 'เกมกำลังดำเนินอยู่ — คุณจะได้ชมรอบนี้ และเข้าร่วมได้เมื่อเริ่มเซสชันใหม่', en: 'A game is in progress — you can watch this session and join when a new one starts' },
  spectating:       { th: '👀 กำลังรับชม', en: '👀 Spectating' },
  answerLocked:     { th: '🔒 ล็อกคำตอบแล้ว', en: '🔒 Answer locked' },
  waitingForOthers: { th: 'รอเพื่อนนักสืบคนอื่น…', en: 'Waiting for the other detectives…' },
  timesUp:          { th: 'หมดเวลา!', en: "Time's up!" },
  answered:         { th: 'ตอบแล้ว', en: 'answered' },
  believedAiLabel:  { th: 'เชื่อคำตอบของ AI', en: 'believed the AI' },
  youWereRight:     { th: '✅ ถูกต้อง!', en: '✅ Correct!' },
  youWereFooled:    { th: '❌ ยังไม่ใช่', en: '❌ Not quite' },
  pointsEarned:     { th: 'คะแนนที่ได้', en: 'Points earned' },
  hostTokenLabel:   { th: 'รหัสผู้ดำเนินรายการ', en: 'Host token' },
  hostTokenSave:    { th: 'บันทึก', en: 'Save' },
  playAgain:        { th: '🔄 เล่นอีกครั้ง', en: '🔄 Play again' },
  finalTitle:       { th: '🏆 สรุปผลการไขคดี', en: '🏆 Final Results' },
  joinOnPhone:      { th: 'เข้าร่วมด้วยมือถือของคุณที่', en: 'Join on your phone at' },
  correctAnswer:    { th: 'คำตอบที่ถูกต้อง', en: 'Correct answer' },
} as const

export type UIKey = keyof typeof STRINGS

export function t(key: UIKey, lang: Lang): string {
  return STRINGS[key][lang]
}
