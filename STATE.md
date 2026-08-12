# STATE — where Campground actually is

Last updated: 2026-08-12.

---

## In one paragraph

A hold-and-spin campsite filler: campers pull into sites and stay put while the
board spins around them. Every column is a campground loop with its own booking
counter measured in nights — a new arrival resets it to 3, a quiet night ticks
it down, and zero checks the whole loop out. Fill every site in a loop before
that happens and it cashes out. React and Vite, no backend, no persisted state.
**The README calls it a toy, and that is the accurate framing.**

---

## What is here

16 files: `src/` with two `.jsx` components, `index.html`, `vite.config.js`,
four `woff2` fonts, and `SPEC.md`. `.github/workflows/deploy.yml` deploys it.

`SPEC.md` is the rules document — the mechanics above are specified there rather
than only living in the code, which for a game whose appeal is a specific set of
interlocking rules is the right call.

---

## How it relates to the other slot work

It does not, and that is worth saying explicitly because the names invite the
assumption.

`lib-slot-core` is the compliance-grade slot backend with statistical RTP
verification, and `app-reels-arcade` is the PWA arcade that consumes it. **This
repository is neither.** It is a self-contained React toy with its own
implementation of its own mechanic, no shared math, and no relationship to that
portfolio beyond the word "slots" in the repository name.

Treat it as a standalone experiment. Nothing here is verified against the
statistical tooling in `lib-slot-core`, and nothing needs to be — but neither
should anyone assume it is.

---

## Not covered

No tests. For a toy of this size that is a reasonable trade rather than an
oversight; `SPEC.md` carries the rules, and the game is small enough to verify
by playing it.
