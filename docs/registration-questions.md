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

## Persona — not needed here

The general expo registration already captures who people are (student / professional / organization).
Do not duplicate it. If that export includes an attendee-type column, pass it through: it lets the
deck segment any chart by student vs professional, which is a free extra dimension. If it doesn't,
the workshop works fine without it.

---

## Group B — The signal

**This is the whole form.** Together these give the shape of a morning rush — when people move, how
they move, whether they buy while moving, and how long they will tolerate a queue. This is the data
that drives Beat 2's staffing answer.

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

**B5. How long would you wait in line for coffee before giving up?** / **คุณจะยอมต่อคิวกาแฟนานแค่ไหนก่อนจะเลิกซื้อ?**
- Under 3 minutes / ไม่เกิน 3 นาที
- 3–5 minutes / 3–5 นาที
- 5–10 minutes / 5–10 นาที
- As long as it takes / รอได้เรื่อย ๆ

> B4 is the single most valuable question on this form. B2 tells you when people are awake; B4 tells
> you when they are **at the counter**. A cafe staffs to the counter, not to the alarm clock.
>
> B5 is what makes Beat 2 a calculation instead of an opinion. Arrival timing alone cannot size a
> shift — two baristas versus three is entirely a question of how fast the queue must move before
> people leave. With B5 you can work the staffing number live on the TV: *this many arrive in the
> 7–9 window (B4), this share of them buy at all (B3), this share abandons after five minutes (B5)*
> — then ask the room how long one drink takes to make, and the required headcount falls out of
> their own data in front of them. Do not pre-compute this. Deriving it live is the moment the
> workshop is built around.

**If you need to cut one, cut B1.** Travel mode makes a fun chart and warms the room up, but it only
proxies for arrival time, which B4 measures directly. B2–B5 are the load-bearing four.

---

## Appendix — Group C, the decoys (NOT IN USE)

**Dropped by decision of the project owner: the form is Group B only.** Kept here because the
reasoning below is what a facilitator needs when someone in the room pushes back, and because it is
the obvious thing to reach for if a future run wants a longer form.

The idea was three extra questions in deliberately the wrong shape. Beat 2 asks *"You run that cafe.
Which decision does this data actually change?"* with four options — menu, staffing, branch location,
price — and the room would assume all four were answerable, because they had answered questions
about all four at registration. Only staffing is.

Without these, Beat 2 still lands: the room reads the four Group B charts and works out which of the
four decisions they can support. The decoys made the trap personal rather than abstract; that is a
sharpening, not a requirement.

Each decoy mapped to one wrong option:

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

**This argument is still worth having on the day, even without the decoy questions**, because
someone will ask why the cafe can't just set its menu from this. Group B dodges all three problems:
a rush hour is a physical fact about bodies moving through space, and the sample **is** the
population — these people really are arriving that morning.

---

## The gap to point at

Notice what is **not** on this form: nobody is asked what they will actually buy at the expo, or
whether the queue was too long. **The cafe's own till data does not exist here.** That absence is
worth naming out loud, because it is the honest limit of the exercise — and it previews the real
lesson, which is that the most valuable dataset is usually the one you already own and ignore.

---

## Notes for whoever builds the form

1. **Keep them in order, B1 through B5.** B5 asks about queue patience; if it runs before B4, people
   start reasoning about their coffee habits and answer B4 aspirationally rather than factually.
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
