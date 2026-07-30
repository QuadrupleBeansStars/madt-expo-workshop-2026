import { IS_PLACEHOLDER } from '@/content/audience'
import { Bilingual } from '@/components/deck/Bilingual'
import './room.css'

/**
 * The safety mechanism between placeholder registration figures and a live
 * audience being told this is their own data. Renders when, and ONLY when,
 * `IS_PLACEHOLDER` (content/audience.ts) is true — once the real registration
 * CSV is imported and that flag is flipped to `false`, this badge disappears
 * on its own with no other code change.
 *
 * Deliberately loud: filled red, uppercase, both languages — not a subtle
 * grey caption, because it has to be unmissable from the back of the room.
 */
export function PlaceholderBadge() {
  if (!IS_PLACEHOLDER) return null

  return (
    <div className="room-placeholder-badge" role="status" data-testid="placeholder-badge">
      <Bilingual
        text={{ en: 'PLACEHOLDER DATA', th: 'ข้อมูลตัวอย่าง ยังไม่ใช่ของจริง' }}
        as="label"
        className="room-placeholder-badge__text"
      />
    </div>
  )
}
