# PLAN — what's next for Campground

Read `STATE.md` first.

Nothing is in flight. This is a small, finished experiment, and the list is
short on purpose.

---

## 1. Keep `SPEC.md` and the code in step

The mechanics are specified in `SPEC.md` and implemented in `src/`. Nothing
enforces that they agree. For a game that is entirely a set of interlocking
rules, a spec that has drifted from the implementation is worse than none —
someone will trust it.

If a rule changes, change both in the same commit.

---

## 2. Decide if it graduates

Right now this is a standalone toy with its own mechanic and its own math. If it
were ever to become part of the real portfolio, that would mean moving the math
into `lib-slot-core` — where statistical RTP verification lives — and the
presentation into `app-reels-arcade`.

That is a real piece of work, not a rename, and it is only worth doing if the
game is meant to be played by anyone beyond the people who built it. Until then,
the current arrangement is correct.

---

## Deliberately not doing

**No backend and no persistence.** The README is explicit that there is no state
to persist. That is what keeps it a toy that always loads and never breaks, and
adding accounts or saved progress would make it something else entirely.
