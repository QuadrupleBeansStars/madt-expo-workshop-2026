# Registration questions — "You Are the Dataset"

For the Data in Business workshop, MADT Expo, 23 Aug 2026.

These replace the three live warm-up polls. Attendees answer them **at event registration**, weeks
before the workshop. By the time they sit down, the dataset already exists — and they've forgotten
they built it. That forgetting is the opening move of the workshop.

**Assumes you already collect the normal attributes** (name, email, phone, org/university).
Everything below is *in addition* to those.

**Keep every question one-tap.** No free text, no "other, please specify". Free text cannot be
aggregated on a TV screen in real time, and a registration form that takes more than 90 seconds
costs you signups.

---

## Group A — Persona

Two questions. These segment every chart in the deck.

**A1. Which best describes you?** / **คุณคือ?**
- Student / นักศึกษา
- Working professional / คนทำงาน
- Faculty or staff / อาจารย์หรือบุคลากร
- Business owner / เจ้าของกิจการ

**A2. How close is your work or study to data?** / **งานหรือการเรียนของคุณเกี่ยวข้องกับข้อมูลแค่ไหน?**
- I work with data directly / ทำงานกับข้อมูลโดยตรง
- I use reports others make / ใช้รายงานที่คนอื่นทำ
- Not really / ไม่ค่อยเกี่ยว
- Not at all / ไม่เกี่ยวเลย

> Why: A2 gives you the room's composition in one number, useful for pitching the level live. It also
> sets up a nice aside — the people who say "not at all" still generated data by registering.

---

## Group B — The signal

**These four are the ones that actually work.** Together they give the shape of a morning rush:
when people are moving, how they're moving, and whether they're buying a drink while they move.
This is the data that drives Beat 2's staffing answer.

**B1. How will you travel to the expo?** / **คุณจะเดินทางมางานอย่างไร?**
- Walk / เดินมา
- BTS / MRT
- Car / รถยนต์
- Motorbike / มอเตอร์ไซค์

**B2. What time do you usually wake up on a weekday?** / **ปกติวันธรรมดาคุณตื่นกี่โมง?**
- Before 6 / ก่อน 6 โมง
- 6–8 / 6–8 โมง
- 8–10 / 8–10 โมง
- After 10 / หลัง 10 โมง

**B3. What is the first thing you drink in the morning?** / **เช้ามาคุณดื่มอะไรเป็นอย่างแรก?**
- Coffee / กาแฟ
- Tea / ชา
- Water / น้ำเปล่า
- Nothing / ยังไม่ได้ดื่มอะไร

**B4. When do you usually buy your first drink of the day?** / **ปกติคุณซื้อเครื่องดื่มแก้วแรกของวันตอนกี่โมง?**
- Before 7 / ก่อน 7 โมง
- 7–9 / 7–9 โมง
- 9–11 / 9–11 โมง
- After 11 / หลัง 11 โมง
- I don't buy / ไม่ได้ซื้อ

> B4 is the single most valuable question on this form. B2 tells you when people are awake; B4 tells
> you when they are **at the counter**. A cafe staffs to the counter, not to the alarm clock.

---

## Group C — The decoys

**These three are deliberately the wrong shape**, and that is the entire point of Beat 2.

Beat 2 asks the room: *"You run that cafe. Which decision does this data actually change?"* with four
options — menu, staffing, branch location, price. The room will assume all four are answerable,
because they answered questions about all four at registration. Only staffing is.

Each decoy maps to one wrong option:

**C1. What is your usual coffee order?** / **ปกติคุณสั่งกาแฟอะไร?** → *maps to "What's on the menu"*
- Latte / ลาเต้
- Americano / อเมริกาโน่
- Espresso / เอสเพรสโซ
- Something not coffee / ไม่ใช่กาแฟ

**C2. Which area do you travel from?** / **คุณเดินทางมาจากย่านไหน?** → *maps to "Where to open branch #2"*
- Use 5–6 broad Bangkok zones plus "outside Bangkok" — not a long district list.

**C3. What do you usually pay for one coffee?** / **ปกติคุณจ่ายค่ากาแฟแก้วละเท่าไร?** → *maps to "What to charge"*
- Under ฿50 / ต่ำกว่า 50 บาท
- ฿50–80
- ฿80–120
- Over ฿120 / มากกว่า 120 บาท

### Why these do not work, precisely

Facilitators need this, because a sharp attendee will push back and say C1 obviously informs the menu.
They are half right, and the real answer is better than the simple one:

- **They are stated preferences, not observed purchases.** "I usually order latte" is what people
  believe about themselves. A cafe's till knows what they actually bought, at what hour, in what
  weather. One of those predicts tomorrow; the other predicts self-image.
- **The sample is wrong.** These are expo attendees, not the cafe's customers. You would be setting
  a menu for people who walk past once a year.
- **There is no counterfactual.** C3 tells you what people currently pay somewhere else. It says
  nothing about what they would pay *you*, which is the only question pricing cares about.

B1–B4 dodge all three problems because a rush hour is a physical fact about bodies moving through
space, and the sample **is** the population — these people really are arriving that morning.

---

## The gap to point at

Notice what is **not** on this form: nobody is asked what they will actually buy at the expo, or
whether the queue was too long. **The cafe's own till data does not exist here.** That absence is
worth naming out loud, because it is the honest limit of the exercise — and it previews the real
lesson, which is that the most valuable dataset is usually the one you already own and ignore.

---

## Notes for whoever builds the form

1. **Order matters.** Put Group B before Group C. If the decoys come first, people are primed to
   think about coffee preferences and answer B3/B4 aspirationally.
2. **Every question must be required**, or the aggregate charts get ragged and the TV shows uneven
   totals across slides.
3. **Export as CSV** with one row per registrant and one column per question, using the option
   labels above verbatim. That drops straight into the deck.
4. **Registrants ≠ attendees.** Expect 50–70% show-up. This is not a problem to hide — it is the
   best unscripted teaching moment on the day: *"this dataset describes a room that never showed
   up."* Sampling bias, live, using their own data.
5. **Say what the data is for.** One line on the form: *"We'll use your answers, anonymously and in
   aggregate, as the live dataset in the Data in Business workshop."* Given the workshop is partly
   about data ethics, collecting it without telling people would be a bad look.
