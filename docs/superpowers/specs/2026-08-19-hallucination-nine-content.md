# The Nine Cases — final content, supplied by the team

Replaces every question in `content/questions.ts`. The teaching frame changes with it: the game is
now explicitly about **the ways an inference can be wrong**, not about outdated facts.

## The set, in the team's own numbering

| # | Case | The question | The duck says | Verdict | Fallacy | At work |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | 🦆 หม่ำ × เท่ง × โหน่ง | ถ้าเท่งเจอหม่ำ แล้วหม่ำเจอโหน่ง เท่งจะเจอโหน่งไหมครับ? | เจอครับ เพราะเท่งเจอหม่ำ และหม่ำเจอโหน่งครับ | **จริง** | Inference | AI เชื่อมข้อมูลหลายจุดได้ แต่ต้องเช็กว่าข้อสรุปตามจากข้อมูลจริงหรือไม่ |
| 02 | 🍦 Ultra Smooth | เจลาโต้เขียนว่า "Ultra Smooth" กินยังไงถึงจะถูกครับ? | ต้องกลืนเลยครับ เพราะเนื้อเนียนจนไม่ต้องเคี้ยว | **มั่ว** | Over-inference | อย่าให้ AI เติมรายละเอียดจากคำสั้น ๆ — "ลูกค้าพอใจ" ไม่ได้แปลว่า "ลูกค้าจะซื้อซ้ำ" |
| 03 | 🫠 เพื่อนบอก 5 นาที | เพื่อนบอกว่า "อีก 5 นาทีถึงบ้าน" ตอนนี้เพื่อนอยู่ไหนครับ? | อยู่หน้าบ้านครับ | **มั่ว** | Unsupported Inference | ถ้าข้อมูลไม่พอ อย่าเติมสิ่งที่ไม่รู้ — ควรบอกว่า "ยังระบุไม่ได้จากข้อมูลนี้" |
| 04 | 🏃 HYROX คันหลัง | แบกกระสอบ HYROX แล้วคันหลัง แปลว่าอะไรครับ? | กล้ามหลังกำลังโตแบบก้าวกระโดดครับ | **มั่ว** | False Causation | ยอดขายตกไม่ได้แปลว่าสาเหตุคือ Marketing ต้องหาว่าอะไรเป็น Driver จริง |
| 05 | ⛩️ ป้าดา | ป้าดาพูดว่า "ความจริงมีหนึ่งเดียว" เราควรเชื่อป้าดาเลยไหมครับ? | ควรครับ เพราะป้าดาพูดด้วยความมั่นใจมาก | **มั่ว** | False Authority | ผู้บริหารพูด ≠ Data จริง ต้องกลับไปดู KPI ก่อนตัดสินใจ |
| 06 | 📱 หนึ่งล้านวิว | คลิปนี้มี 1 ล้านวิว แปลว่าคนดูชอบไหมครับ? | ชอบครับ เพราะถ้าไม่ชอบคงไม่ดู | **มั่ว** | Unsupported Inference | ยอดวิว ≠ Engagement ≠ Conversion อย่าใช้ KPI ตัวเดียวสรุปพฤติกรรมลูกค้า |
| 07 | 🌶️ หมาล่า | กินหมาล่าแล้วเหงื่อออก แปลว่าอะไรครับ? | แปลว่าไขมันกำลังละลายครับ | **มั่ว** | False Causation | "ยอดขายเพิ่มหลังยิงโฆษณา" ยังไม่พิสูจน์ว่าโฆษณาเป็นสาเหตุ |
| 08 | 🐙 ปลาหมึก | ปลาหมึกมีหัวใจ 3 ดวงจริงไหมครับ? | จริงครับ | **จริง** | Plausibility Trap | อย่าปฏิเสธ Insight เพราะ "ฟังดูไม่น่าเป็นไปได้" — ต้องตรวจ Data ก่อน |
| 09 | 👤 Einstein | คำพูด "ถ้าตัดสินปลาจากการปีนต้นไม้ ปลาก็จะคิดว่าตัวเองโง่" เป็นของ Einstein ไหมครับ? | ใช่ครับ Einstein เป็นคนพูด | **มั่ว** | False Attribution | Source จริง ≠ Claim จริง ต้องตรวจว่าแหล่งนั้นสนับสนุนข้อความที่ AI อ้างจริงไหม |

## The closing remark

After case 9, on the projector:

> ในเกม คุณจับ Hallucination ได้ เพราะคุณหยุดคิดก่อนเชื่อ
> ในงานจริงก็เหมือนกัน — อย่าให้ AI เป็นคนตัดสินใจแทนเรา
> **AI ช่วยคิดได้ แต่คนต้อง Verify ก่อนใช้**

## The running order is NOT the team's numbering — and here is why

**The anti-guess mechanic breaks under the supplied order.** Seven of the nine answers are `มั่ว`,
and in the team's numbering six of them run consecutively (02–07). A player who taps ตีกลับ on
everything, thinking about nothing, scores **1600 of a possible 2400 with seven correct**, reaching
the ×3 multiplier at case 04 and holding it to 07.

The multiplier exists precisely so that points can tell thinking from coin-flipping. v3 arranged its
key so an always-reject player never reached ×3 at all, and `lib/scoring.test.ts` asserts it.

**Running order: 01, 08 move to positions 4 and 7.** Concretely the verdicts run
`มั่ว มั่ว มั่ว จริง มั่ว มั่ว จริง มั่ว มั่ว`, which drops an always-reject player to **1200**.

**This does not fully restore the guarantee, and cannot.** With `p` true answers among nine, the
rejects fall into `p+1` runs, so keeping every run to two requires `9 − p ≤ 2(p + 1)`, i.e.
**`p ≥ 3`**. At two true answers a run of three is unavoidable and ×3 is reachable however they are
placed.

**The fix, if the team wants the original guarantee back, is a third `จริง` case.** With three,
placed at 3, 6 and 8, an always-reject player scores **800 with six correct and never reaches ×3** —
exactly v3's number. That is a content decision and is left to the team; the reordering above is the
best available without it.

Case numbering shown on screen follows the running order, not the table above.

## Acts

Three acts of three, grouped by what kind of wrongness they teach:

1. **สรุปเกินข้อมูล** — over-inference and unsupported inference (Ultra Smooth, 5 นาที, and the
   valid inference that opens the game as its contrast)
2. **เห็นพร้อมกันไม่ใช่เป็นเหตุกัน** — false causation and false authority (HYROX, ป้าดา, หมาล่า)
3. **แหล่งกับความจริงคนละเรื่อง** — plausibility and attribution (ล้านวิว, ปลาหมึก, Einstein)

Act titles and chips are the implementer's to finalise from these groupings; keep them Thai, keep
them short enough to read at 3.2vh.

## Constraints that bite this content

- `ask` is capped at **80 characters** by `QuestionSchema` and case 09 exceeds it. Either shorten the
  quote (the version in the table above is already trimmed) or raise the cap and re-run
  `npm run check:projector` to prove the longer line still fits the dossier at both projector shapes.
  Do not silently truncate at render time.
- `duckSays` is capped at 140, `truth` at 220.
- **Never fabricate evidence that imitates a real outlet, journal, or case number.** Case 09 is about
  a real misattribution and must be written as "this quote is not Einstein's", never as a fabricated
  citation proving it.
- Thai only.
