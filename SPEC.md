# Campground — Gameplay Spec

**Version 1.0 · Northbound House**
Hold-and-spin campsite filler in the Cash Falls family. Visual/mechanical spec only — no RTP model, no par sheet.

---

## 1. Concept

You run a campground. Every spin is a night of bookings.

Campers pull into sites and **stay put** while the rest of the board keeps spinning around them. Each column is one campground loop, and every loop has a booking counter measured in **nights left**. A new arrival anywhere in that loop resets the loop to **3 nights**. A night with no arrivals ticks it down. Run out of nights and the whole loop checks out — every camper in it is gone.

Fill every site in a loop before the nights run out and the loop cashes out into its money bag.

The tension is per-column and independent: five loops, five counters, all decaying at their own rate. The 8-row loop pays the most and is the hardest to keep alive.

**Reference:** Light & Wonder's *Cash Falls* hold-and-spin. Campground replaces coins with campers and the coin counter with a campsite signpost.

---

## 2. Board

Five columns, **bottom-aligned** to a common baseline. Taller columns extend upward.

| Column | Loop name | Rows | Sites |
|---|---|---|---|
| 1 | Tent Row | 4 | 4 |
| 2 | Tent Row | 4 | 4 |
| 3 | Lakeside | 6 | 6 |
| 4 | Lakeside | 6 | 6 |
| 5 | Big Rig Row | 8 | 8 |

**Total sites: 28**

Layout geometry (design units): cell 60×60, column gap 12, row gap 5, board width 348. Cabinet is a fixed 500×900 portrait frame, uniformly scaled to fit the viewport.

Below each column, in order top to bottom:
1. **Signpost** — the nights-left counter
2. **Money bag** — that column's lifetime payout total

---

## 3. Symbols

### Campers (held symbols)

Three tiers. Tier determines art and value band; the column determines the actual value.

| Tier | Art | Color | Hit rate |
|---|---|---|---|
| Tent | Pitched A-frame | Canvas cream `#E8DCC0` | 60% |
| Trailer | Teardrop with wheels | Retro turquoise `#4FB3A5` | 30% |
| Big rig | Class A motorhome | Gold `#FFD166` | 10% |

Each camper displays its credit value on a chip beneath the art.

### Value pools

| Column | Tent | Trailer | Big rig |
|---|---|---|---|
| 1–2 (4 rows) | 25 / 50 / 75 | 100 / 150 / 200 | 250 / 375 / 500 |
| 3–4 (6 rows) | 25 / 50 / 75 | 100 / 150 / 250 | 500 / 750 / 1,000 |
| 5 (8 rows) | 50 / 75 / 100 | 150 / 250 / 375 | 1,000 / 2,000 / 5,000 |

Value is rolled uniformly from the pool for that tier and column.

### Jackpot campers

Replace the value chip with a jackpot name. Always render as a big rig in the jackpot's color.

| Jackpot | Lands on | Base value | Behavior |
|---|---|---|---|
| MINI | Columns 1–2 | 1,000 | Fixed |
| MINOR | Columns 3–4 | 5,000 | Fixed |
| MAJOR | Column 5 | 50,000 | +12 per spin |
| GRAND | Column 5 only | 250,000 | +30 per spin, resets to base when paid |

Roll per landed camper: **0.3%** GRAND (column 5 only), then **~2%** for that column's standard jackpot.

Jackpot value is locked in **at payout**, not at landing — a MAJOR camper sitting on the board rides the meter up.

### Filler symbols (empty sites)

Pine, campfire, canoe, lantern, bear. Blur-cycled at 70ms while a column spins, settling to a static icon at ~75% opacity. No card ranks — fillers are decoration only and never pay or trigger anything.

---

## 4. Spin sequence

**Cost:** 50 credits. **Starting balance:** 5,000.

1. **Deduct** the bet. MAJOR and GRAND meters tick up.
2. **All five columns spin.** Held campers stay locked in place and lit; only empty sites cycle fillers.
3. **Columns settle left to right**, column *n* stopping at `420 + n × 190` ms.
4. **On each column's stop, resolve that column:**
   - Roll landings (below). Landed campers appear in random empty sites.
   - If **any** camper landed → signpost snaps back to **3**.
   - If **none** landed and a counter is active → signpost **−1**.
5. **Settle pass** (~1,440 ms, after all columns stop):
   - Any column at **counter 0** clears — campers and signpost both.
   - Any **completely full** column pays out.
6. **Payouts** resolve one column at a time, ~1,100 ms apart.

### Landing rules

Rolled independently per column, per spin:

- **42%** chance the column receives campers at all
- If it does: **1** camper (70%), **2** (23%), **3** (7%)
- Capped by remaining empty sites
- Sites are chosen at random from the open ones — no gravity, no stacking order

A column that is already full receives nothing (it pays and clears first).

### Counter rules

- Counter appears **only** when the column holds at least one camper
- Any landing → **3**, regardless of previous value
- No landing → **−1**
- At **1**, the signpost turns ember red and pulses
- At **0** → column checks out: all campers cleared, counter removed, no payment
- A single landing therefore buys **3 more spins** to fill the column

### Payout rules

- Trigger: **every site in a column occupied**
- Amount: **sum of all camper values in that column**, with jackpot campers contributing their current meter value
- Destination: the column's **money bag** and the credit balance
- After paying: column **clears completely** and returns to a fresh unbooked state, ready to take new arrivals
- Columns pay independently. Multiple columns can fill on the same spin and each pays separately.
- Money bags accumulate for the session and are display-only — the credit balance is the real bankroll.

---

## 5. Controls

| Control | Behavior |
|---|---|
| **SPIN** | One spin. Disabled while resolving or under 50 credits. |
| **AUTO** | Toggle. Re-spins 500 ms after each resolve. Stops automatically when credits run below the bet. |
| **RESET** | Clears the board, zeroes all bags, restores 5,000 credits, resets jackpot meters. |

**Status line** shows the win amount on a payout, otherwise the last event ("Site 5 checked out", "Site 3 full — 4,250 to the bag").

---

## 6. Presentation

**Palette**

| Token | Hex | Use |
|---|---|---|
| Night | `#0E1F26` | Cabinet sky |
| Pine | `#0C2A22` | Treeline base |
| Bark | `#2E2116` | Cabinet frame |
| Canvas | `#E8DCC0` | Tents, body text |
| Lantern | `#F2A93B` | Held-site glow, spin button, accent |
| Ember | `#D9502B` | Counter at 1, auto-on |
| Teal | `#4FB3A5` | Trailers |
| Gold | `#FFD166` | Big rigs, credit readouts |

**Type** — Bevan (routed park-sign slab) for jackpot labels, title, and buttons. Barlow Condensed for all numerals, counters, and readouts.

**Layout, top to bottom** — GRAND / MAJOR / MINOR + MINI jackpot ladder · vertical CAMPGROUND title on the left rail · board · signposts · money bags · status line · control deck.

**Motion** — filler blur while spinning, staggered column stops, signpost pulse at 1 night, gold flash across a paying column, bag bounce on credit. All animation is disabled under `prefers-reduced-motion`.

---

## 7. Known tuning notes

- **Column 5 rarely fills.** Eight sites in 3-night windows is a long shot by design — it's the tease column. If it never pays in playtest, raise its landing probability rather than shortening it. The height is the prize.
- **Columns 1–2 carry the rhythm.** Four sites means frequent small cash-outs, which is what keeps a session moving between the bigger loops.
- **Jackpot meters are cosmetic progressives** — they tick on a fixed increment, not on a contribution model.
