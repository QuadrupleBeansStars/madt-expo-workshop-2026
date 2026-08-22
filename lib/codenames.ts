import type { Lang } from './types'

/**
 * THE 150 CODENAMES, AND THE FACE THAT COMES WITH EACH ONE.
 *
 * Every entry is `[thai, english, emoji]` and the emoji MATCHES THE NAME: `นักสืบราเมง` is a bowl
 * of ramen, never a random hat. Before this the game had fifteen nouns and picked a face out of a
 * ten-emoji prop bag by hashing the player's id, so the two halves of a player's identity had
 * nothing to do with each other — the name said ramen and the face said 🎩, on the projector, in
 * front of the room. One list, one row per detective, is what makes that impossible.
 *
 * WHY 150. The dice button deals from this pool minus whatever the room already holds
 * (`MemoryRoomStore#dealCodename`), so the pool has to outlast a full room: at 100 players
 * drawing INDEPENDENTLY from 150 you would expect only 150 x (1 - (149/150)^100) ~= 73 distinct
 * names, and about 27 people would carry `นักสืบราเมง 2` on the projector. Dealt from the pool
 * instead, 100 players get 100 different names and the suffix never appears at all. 150 is the
 * headroom over the ~100 an expo booth actually sees.
 *
 * ALL THREE COLUMNS ARE UNIQUE — 150 Thai, 150 English, 150 emoji, no repeats anywhere.
 * `codenames.test.ts` re-checks all three on every run: a duplicate emoji would put two identical
 * faces on one leaderboard, which is the exact confusion this file exists to remove, and it is the
 * kind of thing a later "just add one more name" commit introduces silently.
 *
 * EMOJI RULES, learned the hard way (see the note on the pixel duck in app/tv/page.tsx): the 🦆
 * that used to speak on the projector renders as a visibly different bird on Windows, Android and
 * macOS, so it was redrawn as pixels. These 150 cannot be redrawn — they are the room's name tags
 * — so the rule here is narrower: ONE CODEPOINT, optionally followed by VS16 (U+FE0F). No ZWJ
 * sequences (a joined family or profession falls apart into two unrelated glyphs wherever the font
 * lacks the joined form), no flags, no skin-tone modifiers. That keeps every face one glyph on
 * every phone and every projector in the venue. Also guarded by a test.
 *
 * THE TEN GROUPS ARE KEPT because that is how the list was reviewed and approved, and because a
 * flat wall of 150 strings is a list nobody can add to correctly. A new name goes in the group it
 * belongs to; the flat pool below is derived, never edited by hand.
 *
 * THE FIRST FIFTEEN NAMES THE GAME EVER SHIPPED ARE ALL STILL HERE — ราเมง, กาแฟ, มะม่วง, นีออน,
 * เที่ยงคืน, กล้วยไม้, เหยี่ยว, พิกเซล, ตุ๊กตุ๊ก, มรสุม, มะลิ, งูเห่า, โคมไฟ, ดาวตก (ดาวหาง's
 * entry, under the word for the streak rather than the object) and ทุเรียน — spread across the
 * groups they belong to rather than kept together at the front. Screenshots, the README and the
 * owner's own demo runs are full of them.
 *
 * ENGLISH STAYS ALIVE even though players only ever see Thai (`CodenameScreen` is Thai-only, by
 * decision — see the file header there). It costs one column, it keeps `randomCodename('en')`
 * honest for the rehearsal path that `codenames.test.ts` pins, and a bilingual workshop stays one
 * prop away rather than one rewrite away.
 */
export type CodenameEntry = readonly [th: string, en: string, emoji: string]
export type CodenameGroup = { readonly th: string; readonly en: string; readonly items: readonly CodenameEntry[] }

export const CODENAME_GROUPS: readonly CodenameGroup[] = [
  { th: 'ครัวไทย', en: 'Thai Kitchen', items: [
    ['ราเมง', 'Ramen', '🍜'],
    ['ต้มยำ', 'TomYum', '🦐'],
    ['ส้มตำ', 'SomTam', '🥗'],
    ['หมูกรอบ', 'CrispyPork', '🥓'],
    ['ไข่เจียว', 'Omelette', '🍳'],
    ['ข้าวมันไก่', 'ChickenRice', '🍗'],
    ['เตี๋ยวเรือ', 'BoatNoodle', '🛶'],
    ['ข้าวผัด', 'FriedRice', '🍛'],
    ['ปูนิ่ม', 'SoftCrab', '🦀'],
    ['หมูปิ้ง', 'PorkSkewer', '🍢'],
    ['เขียวหวาน', 'GreenCurry', '🍲'],
    ['ปลาทู', 'Mackerel', '🐟'],
    ['หอยทอด', 'OysterFry', '🦪'],
    ['ข้าวเหนียว', 'StickyRice', '🍚'],
    ['กะเพรา', 'HolyBasil', '🌿'],
  ] },
  { th: 'ของหวาน', en: 'Sweets', items: [
    ['บัวลอย', 'BuaLoi', '🍡'],
    ['ลอดช่อง', 'LodChong', '🍧'],
    ['ไอศกรีม', 'IceCream', '🍦'],
    ['มะพร้าว', 'Coconut', '🥥'],
    ['ขนมชั้น', 'LayerCake', '🍰'],
    ['ทองหยอด', 'ThongYod', '🍯'],
    ['ช็อกโกแลต', 'Chocolate', '🍫'],
    ['โดนัท', 'Donut', '🍩'],
    ['คุกกี้', 'Cookie', '🍪'],
    ['พุดดิ้ง', 'Pudding', '🍮'],
    ['น้ำแข็งไส', 'ShavedIce', '🧊'],
    ['ขนมครก', 'KanomKrok', '🥞'],
    ['คัพเค้ก', 'Cupcake', '🧁'],
    ['ลูกอม', 'Candy', '🍬'],
    ['เค้ก', 'Cake', '🎂'],
  ] },
  { th: 'ดื่มดับร้อน & ผลไม้', en: 'Drinks & Fruit', items: [
    ['กาแฟ', 'Espresso', '☕'],
    ['ชาเย็น', 'ThaiTea', '🥤'],
    ['นมสด', 'FreshMilk', '🥛'],
    ['น้ำส้ม', 'OrangeJuice', '🧃'],
    ['มะม่วง', 'Mango', '🥭'],
    ['ทุเรียน', 'Durian', '🍈'],
    ['สับปะรด', 'Pineapple', '🍍'],
    ['แตงโม', 'Watermelon', '🍉'],
    ['กล้วยหอม', 'Banana', '🍌'],
    ['ส้มจี๊ด', 'Tangerine', '🍊'],
    ['องุ่น', 'Grape', '🍇'],
    ['เบอร์รี', 'Strawberry', '🍓'],
    ['เชอร์รี', 'Cherry', '🍒'],
    ['แอปเปิล', 'Apple', '🍎'],
    ['มะนาว', 'Lime', '🍋'],
  ] },
  { th: 'สวนหลังบ้าน', en: 'The Garden', items: [
    ['กล้วยไม้', 'Orchid', '🌺'],
    ['มะลิ', 'Jasmine', '🌼'],
    ['ทานตะวัน', 'Sunflower', '🌻'],
    ['กุหลาบ', 'Rose', '🌹'],
    ['ซากุระ', 'Sakura', '🌸'],
    ['ทิวลิป', 'Tulip', '🌷'],
    ['ไผ่', 'Bamboo', '🎋'],
    ['ต้นสน', 'Pine', '🌲'],
    ['ใบเมเปิล', 'Maple', '🍁'],
    ['โคลเวอร์', 'Clover', '🍀'],
    ['กระบองเพชร', 'Cactus', '🌵'],
    ['เห็ด', 'Mushroom', '🍄'],
    ['ต้นปาล์ม', 'Palm', '🌴'],
    ['ใบไม้ร่วง', 'FallenLeaf', '🍂'],
    ['ต้นกล้า', 'Seedling', '🌱'],
  ] },
  { th: 'สัตว์บก', en: 'On Land', items: [
    ['เสือ', 'Tiger', '🐯'],
    ['ช้าง', 'Elephant', '🐘'],
    ['แมวดำ', 'BlackCat', '🐱'],
    ['หมาน้อย', 'Puppy', '🐶'],
    ['หมาป่า', 'Wolf', '🐺'],
    ['จิ้งจอก', 'Fox', '🦊'],
    ['หมีขาว', 'PolarBear', '🐻'],
    ['กระต่าย', 'Rabbit', '🐰'],
    ['ลิง', 'Monkey', '🐵'],
    ['ม้าลาย', 'Zebra', '🦓'],
    ['ยีราฟ', 'Giraffe', '🦒'],
    ['แรด', 'Rhino', '🦏'],
    ['กวาง', 'Deer', '🦌'],
    ['เม่น', 'Hedgehog', '🦔'],
    ['จิงโจ้', 'Kangaroo', '🦘'],
  ] },
  { th: 'น้ำลึก & ปีกฟ้า', en: 'Sea & Sky', items: [
    ['เหยี่ยว', 'Falcon', '🦅'],
    ['นกฮูก', 'Owl', '🦉'],
    ['นกยูง', 'Peacock', '🦚'],
    ['เพนกวิน', 'Penguin', '🐧'],
    ['นกแก้ว', 'Parrot', '🦜'],
    ['หงส์', 'Swan', '🦢'],
    ['เต่า', 'Turtle', '🐢'],
    ['ปลาวาฬ', 'Whale', '🐳'],
    ['ฉลาม', 'Shark', '🦈'],
    ['ปลาหมึก', 'Octopus', '🐙'],
    ['หอยสังข์', 'Conch', '🐚'],
    ['กุ้งมังกร', 'Lobster', '🦞'],
    ['ปลาการ์ตูน', 'Clownfish', '🐠'],
    ['ผีเสื้อ', 'Butterfly', '🦋'],
    ['งูเห่า', 'Cobra', '🐍'],
  ] },
  { th: 'ฟ้า ฝน กลางคืน', en: 'Night Sky', items: [
    ['เที่ยงคืน', 'Midnight', '🌙'],
    ['มรสุม', 'Monsoon', '☔'],
    ['ดาวตก', 'Comet', '🌠'],
    ['ฟ้าผ่า', 'Lightning', '⚡'],
    ['พายุหมุน', 'Cyclone', '🌀'],
    ['หมอก', 'Fog', '🌁'],
    ['สายรุ้ง', 'Rainbow', '🌈'],
    ['ดาวเหนือ', 'NorthStar', '⭐'],
    ['ตะวัน', 'Sun', '🌞'],
    ['เกล็ดหิมะ', 'Snowflake', '❄️'],
    ['ก้อนเมฆ', 'Cloud', '☁️'],
    ['จันทร์เสี้ยว', 'Crescent', '🌘'],
    ['สุริยุปราคา', 'Eclipse', '🌑'],
    ['อรุณรุ่ง', 'Dawn', '🌅'],
    ['ดาราจักร', 'Galaxy', '🌌'],
  ] },
  { th: 'เมืองกรุง', en: 'The City', items: [
    ['ตุ๊กตุ๊ก', 'TukTuk', '🛺'],
    ['โคมไฟ', 'Lantern', '🏮'],
    ['เรือหางยาว', 'LongtailBoat', '⛵'],
    ['รถไฟฟ้า', 'SkyTrain', '🚈'],
    ['เจดีย์', 'Pagoda', '🛕'],
    ['ยักษ์', 'Yaksha', '👹'],
    ['โขน', 'KhonMask', '🎭'],
    ['มวยไทย', 'MuayThai', '🥊'],
    ['ตลาดน้ำ', 'FloatingMarket', '⛴️'],
    ['รถสองแถว', 'Songthaew', '🚐'],
    ['สงกรานต์', 'Songkran', '💦'],
    ['ลอยกระทง', 'LoiKrathong', '🕯️'],
    ['ร่มกระดาษ', 'PaperUmbrella', '🎐'],
    ['หาบเร่', 'StreetCart', '🧺'],
    ['ป้ายรถเมล์', 'BusStop', '🚏'],
  ] },
  { th: 'เทค & ไซเบอร์', en: 'Cyber', items: [
    ['พิกเซล', 'Pixel', '👾'],
    ['นีออน', 'Neon', '💡'],
    ['โรบอต', 'Robot', '🤖'],
    ['ไวรัส', 'Virus', '🦠'],
    ['ดาวเทียม', 'Satellite', '📡'],
    ['จรวด', 'Rocket', '🚀'],
    ['ยูเอฟโอ', 'UFO', '🛸'],
    ['แบตเตอรี่', 'Battery', '🔋'],
    ['ปลั๊กไฟ', 'Plug', '🔌'],
    ['แผ่นซีดี', 'DiscDrive', '💿'],
    ['ฟลอปปี้', 'Floppy', '💾'],
    ['โน้ตบุ๊ก', 'Laptop', '💻'],
    ['เพจเจอร์', 'Pager', '📟'],
    ['วิทยุ', 'Radio', '📻'],
    ['สัญญาณ', 'Signal', '📶'],
  ] },
  { th: 'แฟ้มนักสืบ', en: 'The Case Kit', items: [
    ['แว่นขยาย', 'Magnifier', '🔍'],
    ['กุญแจ', 'Key', '🗝️'],
    ['หมวกสืบ', 'Deerstalker', '🎩'],
    ['เข็มทิศ', 'Compass', '🧭'],
    ['แผนที่', 'Map', '🗺️'],
    ['กล้องส่อง', 'Telescope', '🔭'],
    ['นาฬิกาทราย', 'Hourglass', '⌛'],
    ['คลิปหนีบ', 'PaperClip', '📎'],
    ['สมุดโน้ต', 'Notebook', '📝'],
    ['จดหมาย', 'Letter', '📨'],
    ['หมุดปัก', 'Pushpin', '📌'],
    ['เทปคาสเซ็ต', 'Cassette', '📼'],
    ['ไฟฉาย', 'Flashlight', '🔦'],
    ['แม่กุญแจ', 'Padlock', '🔒'],
    ['ลูกเต๋า', 'Dice', '🎲'],
  ] },
]

/** The ten groups flattened, in group order. The pool everything below reads. */
export const CODENAMES: readonly CodenameEntry[] = CODENAME_GROUPS.flatMap((g) => g.items)

/**
 * THE ONE PLACE THE PREFIX LIVES. The pool above stores BARE NOUNS (`ราเมง`), a codename carries
 * the prefix (`นักสืบราเมง`), and every deal, join and avatar lookup crosses that boundary. It is
 * added here in `codename()` and stripped here in `emojiFor()`, and nowhere else in the codebase:
 * two implementations of "does this start with นักสืบ" is exactly how the name and the face drift
 * apart again.
 *
 * Thai has no space (`นักสืบราเมง` is one word to a Thai reader); English does.
 */
const PREFIX: Record<Lang, string> = { th: 'นักสืบ', en: 'Detective ' }

/** `ราเมง` -> `นักสืบราเมง`. */
function codename(noun: string, lang: Lang): string {
  return `${PREFIX[lang]}${noun}`
}

/**
 * Bare noun -> emoji, both languages in one map, built once at module load.
 *
 * Keyed on the BARE noun rather than on the finished codename so that a player who types `ราเมง`
 * into the field themselves — no prefix — still gets the bowl. The 150 Thai and 150 English nouns
 * are each distinct and do not collide across the two languages, so one map is safe; the
 * uniqueness test is what keeps that true.
 */
const EMOJI_BY_NOUN: ReadonlyMap<string, string> = new Map(
  CODENAMES.flatMap(([th, en, emoji]) => [[th, emoji], [en, emoji]] as [string, string][]),
)

/**
 * Every codename in the pool, prefixed, for one language. This is what the store deals from.
 *
 * A fresh array each call — the caller filters it against the room's taken names, and must not be
 * able to mutate the pool itself while doing it.
 */
export function codenamePool(lang: Lang): string[] {
  return CODENAMES.map(([th, en]) => codename(lang === 'th' ? th : en, lang))
}

/**
 * One name at random, unaware of who else is in the room.
 *
 * Still here, still exported, and still the LAST RESORT on both paths that matter: the store falls
 * back to it once the pool is exhausted (player 151), and `CodenameScreen` falls back to it when
 * the deal-a-name request fails or times out. A player standing at a booth with a dice button that
 * does nothing is a worse outcome than a duplicate name, and `uniqueCodename` makes the duplicate
 * legible anyway.
 */
export function randomCodename(lang: Lang): string {
  const [th, en] = CODENAMES[Math.floor(Math.random() * CODENAMES.length)]
  return codename(lang === 'th' ? th : en, lang)
}

/**
 * The emoji for a codename, or `undefined` if it is not a name from the pool.
 *
 * Takes a FINISHED codename (`นักสืบราเมง`, `Detective Ramen`) or a bare noun (`ราเมง`) and
 * handles the prefix itself — see PREFIX above. It deliberately does NOT know about the ` 2`
 * suffix the store appends to a duplicate: that is `avatarFor`'s problem, because the suffix is
 * the STORE's format and lib/avatars.ts is where the two are married. Hand this a resolved
 * codename that carries a suffix and it correctly answers `undefined`.
 */
export function emojiFor(codenameOrNoun: string): string | undefined {
  let noun = codenameOrNoun
  for (const prefix of Object.values(PREFIX)) {
    if (noun.startsWith(prefix)) { noun = noun.slice(prefix.length); break }
  }
  return EMOJI_BY_NOUN.get(noun)
}
