# ThirdSpace Play Badminton Tournament

Website for the ThirdSpace Play Badminton Tournament (Sunday 25 October 2026, Rapid Sports Academy, Perungudi, Chennai).

**Current phase: static demo.** All teams and results are sample data, driven by a demo clock. There is no backend yet. Live scoring across devices comes in the next phase.

## Pages

| Page | File | What it shows |
|---|---|---|
| Tournament home | `index.html` | Event details, matches on court now, coming up, categories, format, entry, rules, venue |
| Match center | `matches.html` | Schedule (filter by category, status, court, round), group tables, knockout bracket |
| Match | `match.html?id=BMD-A-01` | Live court scoreboard, serving side, rally-by-rally score sheet, demo scorer controls |

Match codes: `<category>-<group>-<number>` for league matches (for example `BWD-C-03`), `<category>-SF1`, `<category>-SF2` and `<category>-F` for the knockout.

## Demo controls

- The bar at the top runs a simulated clock for the tournament day. Drag it to any time, pause it, or change the speed. Add `?t=13:45` to any URL to open at that time.
- On a match page, **Score this match (demo)** opens the scorer controls. Points you enter are saved in this browser and show up in other tabs straight away, which is a preview of how live updates will feel. **Clear demo scoring** removes them.

## Format rules in the code

- League: single game to 15, win by 2, capped at 21. Knockout: single game to 21, win by 2, capped at 30. (`assets/js/scoring.js`)
- Groups of 4, with some groups of 3. Group ranking: matches won, head-to-head (two-way ties), point difference, points scored, then the organizer decides.
- Semi-finals: A1 v C1 and B1 v D1. No third-place match. (`assets/js/tournament-data.js`)

## Run locally

Any static file server works. The pages use JavaScript modules, so opening the files directly from disk will not work.

```bash
npx serve .          # or: python -m http.server 8080
npm test             # scoring and schedule tests (Node 20+)
```

## Deploy (GitHub Pages)

1. Push to `main`.
2. In the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Because the portfolio at `pavithranm.in` is the account's user site, this project will appear at `https://pavithranm.in/Tournament-/`. All links are relative, so this works without changes.
4. Optional, later: to use `tournament.pavithranm.in`, add a DNS `CNAME` record `tournament → pavithran-p12.github.io` and set it as the custom domain in the same Pages settings. This does not touch the records for `pavithranm.in`.

## Project layout

```
index.html, matches.html, match.html
assets/css/styles.css
assets/js/scoring.js          scoring rules (pure functions, tested)
assets/js/tournament-data.js  event details, categories, sample teams
assets/js/engine.js           fixtures, court schedule, standings, bracket
assets/js/ui.js               demo clock, demo scoring store, shared helpers
assets/js/components.js       match card
assets/js/home.js, matches.js, match.js   page scripts
tests/                        node:test suites
```
