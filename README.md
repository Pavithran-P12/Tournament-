# ThirdSpace Play Badminton Tournament

**See [FEATURES.md](FEATURES.md)** for the full list of features, how to reuse this site for another tournament, and future ideas.

Website for the ThirdSpace Play Badminton Tournament (Sunday 25 October 2026, Rapid Sports Academy, Perungudi, Chennai).

**Current phase: static site.** Scores are entered by scorers with a passkey and published through a JSON file. The real entry list and the random draw (done 22 October 2026) are in `assets/js/tournament-data.js`.

## Pages

| Page | File | What it shows |
|---|---|---|
| Results (home) | `index.html` | Champions with runners-up and semi-finalists, the day in numbers, every team's journey with search (`assets/js/results.js`) |
| Schedule and rules | `schedule.html` | Event details, day plan, categories, format, what's included, rules, venue (`assets/js/schedule.js`) |
| Match center | `matches.html` | Group tables, schedule, knockout bracket. `matches.html?journey=BMD-24` opens that team's journey |
| Match | `match.html#BMD-A-01` | Court scoreboard, serving side, rally-by-rally score sheet, scorer controls (passkey) |

Match codes: `<category>-<group>-<number>` for league matches (for example `BWD-C-03`), `<category>-SF1`, `<category>-SF2` and `<category>-F` for the knockout.

## Scoring and live results

**The tournament is over (25 Oct 2026): `data/results.json` is the source of truth.** It is the final export of every result. Live scores and scoring are switched off (`LIVE_SCORES = false` in `assets/js/ui.js`); the Supabase table `tsp_scores` is kept untouched as a backup, and public execute on the scoring functions has been revoked (migration `tsp_close_scoring`; re-grant to `anon` to reopen). The rest of this section describes how live scoring worked on the day.

During the event scores were live, stored in a Supabase table (`tsp_scores`, one row per match holding its rally sequence such as `AABAB`).

1. On a match page, tap **Score this match** and enter the scorer passkey (ask the organizer). Scoring stays unlocked until the browser tab is closed or **Lock** is tapped.
2. Tap the team that won each rally. Every tap is sent straight away, and every open page picks it up within about 5 seconds. **Undo last point**, **Confirm result**, the court picker and **Delete this match's scores** sync the same way.
3. The scorer panel shows **✓ Live for everyone** when everything has been sent. If the phone loses internet, points are kept on the phone and sent automatically when it reconnects. Keep the page open until it shows the tick.

Several scorers can score different matches on different phones at the same time.

**Security:** anyone can read the scores. Writing needs the passkey, which is checked inside the database through `tsp_save_score` / `tsp_delete_score` (security definer functions). Only a bcrypt hash of the passkey is stored, in a private schema the public key cannot read, and it is not in this repo. The page uses only the Supabase publishable key, which is meant to be public. To change the passkey, run this in the Supabase SQL editor:
`update tsp_private.scorer_key set pass_hash = extensions.crypt('NEWPASSKEY', extensions.gen_salt('bf', 10));`

**Backup:** **Download backup file** saves every score on that phone as a results file. If Supabase were ever unavailable, replace `data/results.json` with it and push; the pages also read that file.

## The draw and formats

| Category | Teams | Groups | Knockouts |
|---|---|---|---|
| Beginner Men's | 24 | 4 groups of 6, each team plays 3 randomly drawn opponents | Group winners: semi-finals (A v C, B v D), final |
| Intermediate Men's | 18 | 6, 4, 4, 4 (group A: 3 randomly drawn opponents each) | Group winners: semi-finals (A v C, B v D), final |
| Intermediate Mixed | 16 | 4 groups of 4 | Group winners: semi-finals (A v C, B v D), final |
| Beginner Women's | 6 | 1 group of 6 | Semi-finals 1st v 3rd and 2nd v 4th, then the final |

Mixed entry 9 was a duplicate of entry 6 and was removed. Names are spelled as given by the organizer.

The schedule is built automatically on 5 courts (14-minute league slots, 35-minute knockout slots for best-of-3, 9:00 AM to about 3:55 PM). Nobody is ever on two courts at once, including players entered in two categories (`SAME_PERSON` in `tournament-data.js` links different spellings of the same person), and players get a slot of rest between league matches. Knockouts run in the order set in `KNOCKOUT_SLOTS`, which keeps categories that share players apart.

## Cache versions

Every CSS/JS link carries `?v=<version>` so phones never mix old and new files. After changing any CSS or JS, bump it everywhere:
`sed -i 's/?v=20261025o/?v=NEWVERSION/g' *.html assets/js/*.js`

## Format rules in the code

- League: single game to 15. Quarter-finals: single game to 15. Semi-finals and finals: single game to 21. (Best of 3 is still supported: set `bestOf: 3`.) Rally scoring with a golden point, no deuce: at 14–14 (league and quarter-finals) or 20–20 (semi-finals and finals) the next rally wins the game. (`assets/js/scoring.js`)
- Time windows: each category has a `startAt` time (beginners from 9:00, intermediate from 10:45, which keeps at least `minCourts` courts once started); knockouts start at `knockoutStart` (2 PM) or `knockoutBreak` minutes after the league if it runs later. Times are tentative (`timesTentative` shows a notice). League slots are `leagueSlot` minutes, quarter-finals `quarterSlot`, semi-finals and finals `knockoutSlot`.
- Group ranking: matches won, head-to-head (two-way ties), point difference, points scored, then the organizer decides. The top two of every group go through.
- All four categories follow the organizer's fixture sheets (24 Oct): full round robin, entered as `pairings` in sheet order, with the sheet's match numbers (`numbered: true`, shown as "Match 23"). Other groups play a full round robin. No third-place matches.
- Quarter-finals: A1 v B2, C1 v D2, B1 v A2, D1 v C2; semi-finals QF1 v QF2 winners and QF3 v QF4 winners. Beginner Women's: semi-finals 1st v 3rd and 2nd v 4th (format `sf4`), then the final.
- The schedule is built by `tournament()` in `engine.js` (seeded search, same data gives the same schedule). Ten players are entered in two categories; if two of their knockout matches overlap, the later one is flagged on its match card and starts once they are free.

## Anonymous feedback

`assets/js/feedback.js` adds a Feedback button to every page: three quick emoji ratings (excitement, experience so far, the website) and an optional comment. Nothing personal is asked for. Answers are emailed through [Web3Forms](https://web3forms.com): create a free access key with the inbox that should receive them and paste it into `ACCESS_KEY`. The key is meant to be public and only sends to that inbox, so no email address is in this repo.

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

## License and privacy

Code: MIT, see `LICENSE`. Tournament content (names, results, logo, photos) belongs to its owners. What the site collects is explained on `privacy.html`, linked from every footer.
