import type { LocalizedText } from '@/lib/types'

/**
 * Chrome strings. Every one renders in BOTH languages at once (spec §2a) — there is
 * no toggle, so these are LocalizedText values rather than i18n lookup keys.
 */
export const UI = {
  deckTitle:      { en: 'Data in Business', th: 'ข้อมูลกับธุรกิจ' },
  joinPrompt:     { en: 'Join on your phone at', th: 'เข้าร่วมด้วยมือถือที่' },
  waitingToStart: { en: 'Waiting for the host to start', th: 'รอผู้ดำเนินรายการเริ่ม' },
  voteReceived:   { en: 'Vote received', th: 'บันทึกคำตอบแล้ว' },
  changeVote:     { en: 'Changed your mind? Tap again', th: 'เปลี่ยนใจได้ กดใหม่ได้เลย' },
  votingClosed:   { en: 'Voting closed', th: 'ปิดโหวตแล้ว' },
  lookAtScreen:   { en: 'Look at the big screen', th: 'ดูที่จอใหญ่' },
  thanks:         { en: 'Thanks for playing', th: 'ขอบคุณที่ร่วมสนุก' },
  start:          { en: 'Start', th: 'เริ่ม' },
  next:           { en: 'Next', th: 'ถัดไป' },
  back:           { en: 'Back', th: 'ย้อนกลับ' },
  closeVoting:    { en: 'Close voting', th: 'ปิดโหวต' },
  lesson:         { en: 'Lesson', th: 'บทเรียน' },
  peopleInRoom:   { en: 'people in the room', th: 'คนในห้อง' },
  votes:          { en: 'votes', th: 'โหวตแล้ว' },
  hostToken:      { en: 'Host token', th: 'รหัสผู้ดำเนินรายการ' },
  tokenRequired:  { en: 'Enter the host token before pressing Start', th: 'ใส่รหัสผู้ดำเนินรายการก่อนกดเริ่ม' },
} as const satisfies Record<string, LocalizedText>
