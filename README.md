# Campground

A hold-and-spin campsite filler. Campers pull into sites and stay put while the board spins around them. Every column is a campground loop with its own booking counter measured in nights — a new arrival resets it to 3, a quiet night ticks it down, and zero means the whole loop checks out. Fill every site in a loop before that happens and it cashes out into its money bag.

Built with React + Vite. No backend, no state to persist — it's a toy.

**Play:** https://northbound-house.github.io/game-slots-camp/

## Where to look

| File | Answers |
| --- | --- |
| `README.md` (this file) | How do I work on this? |
| [`STATE.md`](STATE.md) | Where does it stand right now? |
| [`PLAN.md`](PLAN.md) | What happens next? |

## The board

Five columns, bottom-aligned, at 4 / 4 / 6 / 6 / 8 rows — 28 sites total. Short loops on the left pay small and often. The 8-row Big Rig Row on the right holds the top values and the Major and Grand jackpots, and it's deliberately hard to fill.

Campers come in three tiers: tents (low), trailers (mid), and big rigs (high). Values scale with column height, topping out at 5,000 on the right column. Jackpot campers replace their value with MINI, MINOR, MAJOR, or a very rare GRAND.

Full rules, value pools, and probabilities are in [SPEC.md](./SPEC.md).

## Develop

```bash
npm install
npm run dev
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

`vite.config.js` uses a relative base, so the same build works from a project-pages subpath or a custom domain without changes.

## Fonts

Bevan and Barlow Condensed are self-hosted in `src/fonts/` rather than loaded
from Google Fonts, so the cabinet never falls back to a system serif on a
network that blocks the CDN. Only the `latin` subset is bundled — all copy in
the game is hardcoded ASCII. Adding copy in another script means adding the
matching subset and `@font-face` in `src/fonts.css`.

## License

Private project. Original artwork and code.

The bundled fonts are third-party: Bevan and Barlow Condensed are licensed
under the SIL Open Font License 1.1. See [`src/fonts/OFL.txt`](./src/fonts/OFL.txt).
