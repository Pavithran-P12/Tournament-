# ThirdSpace Play Badminton Tournament

Website for the ThirdSpace Play Badminton Tournament (Sunday 25 October 2026, Rapid Sports Academy, Perungudi, Chennai).

**Current phase: static site.** Scores are entered by scorers with a passkey and published through a JSON file. Teams are sample data until the real draw is entered (see below).

## Pages

| Page | File | What it shows |
|---|---|---|
| Tournament home | `index.html` | Event details, matches on court now, coming up, categories, format, entry, rules, venue |
| Match center | `matches.html` | Schedule (filter by category, status, court, round), group tables, knockout bracket |
| Match | `match.html#BMD-A-01` | Court scoreboard, serving side, rally-by-rally score sheet, scorer controls (passkey) |

Match codes: `<category>-<group>-<number>` for league matches (for example `BWD-C-03`), `<category>-SF1`, `<category>-SF2` and `<category>-F` for the knockout.

## Scoring and publishing results

1. On a match page, tap **Score this match** and enter the scorer passkey (ask the organizer). Scoring stays unlocked until the browser tab is closed or **Lock** is tapped.
2. Points are saved on that phone as they are entered. **Undo last point** and **Delete this match's scores** are recorded the same way.
3. Tap **Download results file**. It contains every match scored on that phone plus the results already published.
4. Replace `data/results.json` in this repo with the downloaded file, then commit and push. GitHub Pages republishes in a minute or two, and open pages re-read the file every 60 seconds.

If several scorers use different phones, collect each file and publish one at a time, waiting for each one to go live before the next scorer downloads (their phone then includes it). A shared live backend (planned) removes this step.

**About the passkey:** only a salted SHA-256 hash is stored in `assets/js/ui.js`, so the passkey itself is not in this public repo. The check runs in the browser, so it keeps casual visitors out but is not real security. To change it, run
`node -e "console.log(require('crypto').createHash('sha256').update('tsp-scorer:NEWPASSKEY').digest('hex'))"`
and paste the result into `PASS_HASH`.

## Entering the real draw

Edit `assets/js/tournament-data.js`: replace the sample teams, set the group sizes in `CATEGORIES`, and set `drawPublished: true` to remove the "Sample draw" notice.

## Cache versions

Every CSS/JS link carries `?v=<version>` so phones never mix old and new files. After changing any CSS or JS, bump it everywhere:
`sed -i 's/?v=20261022g/?v=NEWVERSION/g' *.html assets/js/*.js`

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
assets/js/ui.js               results file, scorer passkey, shared helpers
assets/js/components.js       match card
assets/js/home.js, matches.js, match.js   page scripts
tests/                        node:test suites
```
