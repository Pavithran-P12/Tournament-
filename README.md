# ThirdSpace Play Badminton Tournament

Website for the ThirdSpace Play Badminton Tournament (Sunday 25 October 2026, Rapid Sports Academy, Perungudi, Chennai).

**Current phase: static site.** Scores are entered by scorers with a passkey and published through a JSON file. The real entry list and the random draw (done 22 October 2026) are in `assets/js/tournament-data.js`.

## Pages

| Page | File | What it shows |
|---|---|---|
| Tournament home | `index.html` | Event details, matches on court now, coming up, categories, format, what's included, rules, venue |
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

## The draw and formats

| Category | Teams | Groups | Knockouts |
|---|---|---|---|
| Beginner Men's | 24 | 4 groups of 6, each team plays 3 randomly drawn opponents | Group winners: semi-finals (A v C, B v D), final |
| Intermediate Men's | 18 | 6, 4, 4, 4 (group A: 3 randomly drawn opponents each) | Group winners: semi-finals (A v C, B v D), final |
| Intermediate Mixed | 16 | 4 groups of 4 | Group winners: semi-finals (A v C, B v D), final |
| Beginner Women's | 4 | 1 group of 4 | 1st v 2nd in the final |

Mixed entry 9 was a duplicate of entry 6 and was removed. Names are spelled as given by the organizer.

The schedule is built automatically on 5 courts (14-minute league slots, 35-minute knockout slots for best-of-3, 9:00 AM to about 3:55 PM). Nobody is ever on two courts at once, including players entered in two categories (`SAME_PERSON` in `tournament-data.js` links different spellings of the same person), and players get a slot of rest between league matches. Knockouts run in the order set in `KNOCKOUT_SLOTS`, which keeps categories that share players apart.

## Cache versions

Every CSS/JS link carries `?v=<version>` so phones never mix old and new files. After changing any CSS or JS, bump it everywhere:
`sed -i 's/?v=20261022w/?v=NEWVERSION/g' *.html assets/js/*.js`

## Format rules in the code

- League: single game to 15. Knockouts (semi-finals and finals): best of 3 games to 21. Rally scoring with a golden point, no deuce: at 14–14 (league) or 20–20 (knockout) the next rally wins the game. (`assets/js/scoring.js`)
- Group ranking: matches won, head-to-head (two-way ties), point difference, points scored, then the organizer decides.
- Groups of 6 (all of Beginner Men's, Intermediate Men's group A) use fixed random pairings (`pairings` in `tournament-data.js`): 3 rounds, no repeated opponents. No third-place matches.

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
assets/js/tournament-data.js  event details, teams, draw, knockout order
assets/js/engine.js           fixtures, court schedule, standings, bracket
assets/js/ui.js               results file, scorer passkey, shared helpers
assets/js/components.js       match card
assets/js/home.js, matches.js, match.js   page scripts
tests/                        node:test suites
```
