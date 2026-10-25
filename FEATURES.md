# Tournament website: features and reuse guide

Everything built for the **ThirdSpace Play Badminton Tournament** (Sunday 25 October 2026, Rapid Sports Academy, Perungudi, Chennai), written down so the same pieces can be reused for any number of future tournament sites.

The site is plain HTML, CSS and JavaScript ES modules. There is no build step and no framework, and it is hosted free on GitHub Pages. Optional services: Supabase (live scores, visit counter) and Web3Forms (feedback email).

Status after the event: scoring is closed on the site and in the database (public execute on the scoring functions revoked, migration `tsp_close_scoring`), live scores are switched off (`LIVE_SCORES = false` in `assets/js/ui.js`), and `data/results.json` is the source of truth for all 163 results.

---

## 1. Pages

| Page | File | Purpose |
|---|---|---|
| Results (home) | `index.html` + `results.js` | Champions, runners-up, semi-finalists, the day in numbers, every team's journey with search |
| Matches | `matches.html` + `matches.js` | Groups, schedule and knockout views with filters |
| Match | `match.html#<id>` + `match.js` | Scoreboard, serving side, score sheet, stats, scorer panel, share card |
| Schedule and rules | `schedule.html` + `schedule.js` | Day plan, categories, format, scoring rules, what's included, rules, venue, organiser |
| Privacy | `privacy.html` | What is and isn't stored (no personal data) |

Shared code: `ui.js` (data, refresh loop, formatting, journeys), `components.js` (match cards and rows), `share.js` (image cards), `feedback.js`, `visits.js`.

---

## 2. Tournament engine (`engine.js`, `scoring.js`)

### Draw and fixtures
- Categories, teams and groups are set in `tournament-data.js`, with any number of categories and group sizes (4, 5 or 6 tested).
- Round robin is built automatically, or follows an organiser's sheet exactly via `pairings`, which keeps their match numbers (`numbered: true`).
- Match codes: `BMD-A-01` (league), `BMD-QF1`, `BMD-SF2`, `BMD-F`.
- Players entered in two categories are recognised as one person (`personKey`, `SAME_PERSON` for spelling variants), so they are never scheduled on two courts at once.

### Knockout formats (`KO` in `engine.js`)
| Format | Flow |
|---|---|
| `qf` | 4 groups, top 2 each → quarter-finals A1 v B2, C1 v D2, B1 v A2, D1 v C2 → semi-finals → final |
| `sf4` | 1 group, top 4 → semi-finals 1st v 3rd, 2nd v 4th → final |
| `final2` | 1 group → 1st v 2nd in the final |

- `placesFor(format)` sets how many teams go through (Q badges, notes, journeys follow it).
- `KO_OVERRIDES` (in `tournament-data.js`) fixes a knockout line-up by hand when the day goes differently from the bracket (used for the Beginner Men's semi-finals).

### Scheduling
- Courts, slot lengths, session windows and a `startAt` time per category are set in config.
- A seeded search over a few hundred orders picks the best schedule. Nobody plays on two courts at once, back-to-back matches are avoided unless nothing else fits, and sheet order is kept within each group.
- Knockouts are scheduled after the league, once the matches they depend on are finished.
- Per-match times can be hidden, showing session windows and reporting times only. This is what we used, because times were tentative.

### Scoring rules
- Rally scoring with a **golden point** (no deuce): at one point from the target, the next rally wins.
- Formats in `FORMATS` (`scoring.js`): `target` points and `bestOf` games. As played: league 15, quarter-finals 15, semi-finals and finals 21, all one game. Best of 3 is fully supported (per-game scores, games won, share cards with per-game blocks).
- Scores are an **event log** (point / undo), replayed to give the score, server, service court (left/right), game point, match point and golden point.
- Group ranking: matches won, then head-to-head, then point difference, then points scored. Ties that can't be split are flagged "organiser decides".
- Safeguard: points recorded past the end of a match (e.g. an old page on a scorer's phone) are cut at the winning point instead of breaking the page.

---

## 3. Matches page

- **Groups view (default):** colour-coded group cards and live tables with P / W / L / +/−. Q badges are outlined while provisional and solid once confirmed. Tap a team to expand its fixtures. A route icon opens its **team journey**.
- **Schedule view:** a compact list in sheet order with match number, group chip, both teams and the score or status. Two columns on wide screens.
- **Knockout view:** a bracket by stage, with a champion banner and a "See their journey" button.
- Filters: category chips, status (all / live / upcoming / completed), group, and stage (league / quarter / semi / final). Filters are in the URL (`?cat=BMD&view=knockout`).
- `matches.html?journey=<team id>` opens a team's journey directly (used by the results page).
- Progress bar: "163 of 163 played".

## 4. Match page

- Court-style scoreboard: team names, big score, who is serving and from which side, golden point / game point / match point alerts.
- Rally-by-rally score sheet and match stats (longest run, lead changes and more).
- Details: full names, stage, format, court (optional, set by the scorer), session and reporting time.
- **Share card** for a finished match (see section 7).

## 5. Live scoring (used on the day, now switched off)

- **Scorer panel:** unlocked with a passkey. One tap per rally, Undo, Confirm result / Reopen, a court picker, and delete with a double tap.
- **Live sync through Supabase:**
  - Each tap is sent as the match's rally string (`"AABAB…"`) to the table `tsp_scores`.
  - Every open page checks for changes every 5 seconds and fetches only changed rows. Checks pause when the tab is hidden.
- **Offline-safe:** points are saved on the phone first and sent when the connection returns. Status reads "✓ Live for everyone · synced 9:51 pm" or "waiting to go live (no connection)".
- **Several scorers** can score different matches on different phones at once.
- **Security:**
  - The passkey is checked inside the database by security definer functions `tsp_check_passkey`, `tsp_save_score` and `tsp_delete_score`.
  - Only a bcrypt hash is stored, in the private schema `tsp_private`, which the public key cannot read.
  - The page holds only the Supabase *publishable* key, which is safe to be public.
  - The public can read scores but cannot write them directly (row level security, select-only grant).
- **Backup:** "Download backup file" exports every score as `results.json` (the format of `data/results.json`), so the site can run with no database at all.
- **Results file fallback:** pages always read `data/results.json` first. Order of precedence: file → live table → this phone's unsent changes.
- Free-tier sizing: about 100 viewers all day is roughly 0.5–1 GB of the 5 GB monthly Supabase allowance. There is no user limit.

## 6. Results page (home after the event)

- A champion card per category: champions (names joined with &), final score and opponent, runners-up, semi-finalists, plus links to their journey and the final scorecard.
- The day in numbers: matches played, teams, points won, golden-point finishes, games won to love, champions crowned.
- Every team's journey: the final four per category shown, "Show all N teams" to expand, and a search box that looks through every team.

## 7. Share images (`share.js`)

Canvas images at 1080×1920, sized for Instagram stories, downloadable or shared with the phone's share sheet.

- **Match result card:** winners, score, stage, court. Best-of-3 cards show each game's points large.
- **Final / champion card:** gold-and-black background with a winner tag and crown.
- **Team journey card:** every match a team played with W/L, scores and how far they went. A champion variant is included.
- Shared header and footer with the organiser's Instagram pill and a "Created with ♥ by P12" pill.

## 8. Other features

- **Day plan:** session cards (beginner / intermediate / knockouts) with reporting times, plus a reporting banner that hides itself after the event day.
- **Anonymous feedback:**
  - A floating button opens 3 emoji ratings and a comment box.
  - Answers are emailed through Web3Forms with no name, email or phone collected.
  - A honeypot field stops spam bots.
- **Visit counter:**
  - Shows "👀 1,234 visits" in the footer, counted once per device per day using a random ID only.
  - Uses Supabase functions `record_site_visit` / `get_site_visit_count` with a `site` column, so one table serves several sites (`portfolio`, `tournament`).
- **Organiser section:** photo, quote and Instagram link. After the event it becomes a "Thank you for playing" note.
- **Privacy page:** explains that names are used only for the tournament, with no accounts, no cookies and no personal data.
- **Cache-busting:** every CSS/JS link and import carries `?v=YYYYMMDDx`. Bump it on each release so phones load new files.
- **Design:**
  - Dark court-green theme, Big Shoulders Display + Figtree fonts, team A amber / team B sky colours.
  - Mobile-first layout, no horizontal scroll, reduced-motion respected.
- **License:** MIT in the repo only (not linked from the site). Site content is not covered.

## 9. Tests

`node --test tests/*.test.js` runs 34 tests:
- round robin
- draw integrity
- no double-booking of people or courts
- sheet match numbers and order
- session start times
- knockout formats and pairings
- `KO_OVERRIDES`
- group tables
- scoring rules (golden point, best of 3, undo across games)
- name formatting

---

## 10. Reusing this for a new tournament

1. **Copy the repo** and point a new GitHub Pages site (or subdomain) at it.
2. **Edit `assets/js/tournament-data.js`:**
   - `EVENT`: name, date, venue, courts, session windows, slot lengths, reporting rules, rules text, what's included, Instagram handle.
   - `CATEGORIES`: code, name, level, `format` (`qf` / `sf4` / `final2`), groups and optional `pairings` from the organiser's sheet.
   - `TEAMS`: `id → [player 1, player 2]`.
   - `KO_OVERRIDES`: leave empty (`{}`) unless needed on the day.
3. **Scoring formats:** set `target` and `bestOf` per stage in `FORMATS` (`scoring.js`).
4. **Reset results:** `data/results.json` → `{"updated": null, "matches": {}}`.
5. **Live scores (optional):**
   - Create the `tsp_scores` table, the `tsp_private.scorer_key` table and the three functions in Supabase.
   - Set the passkey with `update tsp_private.scorer_key set pass_hash = extensions.crypt('NEWPASSKEY', extensions.gen_salt('bf', 10));`.
   - Put the project URL and publishable key in `ui.js` and set `LIVE_SCORES = true`.
   - Never put a service-role key or database password in the site.
6. **Feedback:** create a Web3Forms access key for the organiser's inbox and paste it in `feedback.js`.
7. **Visit counter:** add the new site name to the `site` check constraint and set `SITE` in `visits.js`.
8. **Branding:** logo and organiser photo in `assets/img/`, colours in the `:root` tokens of `styles.css`.
9. **Before the event:** the home page should be the event page (`schedule.html` content with "On court now" and "Up next"). **After the event:** switch the home page to the results page, set `LIVE_SCORES = false` and publish the final `results.json`.
10. Run the tests, bump the `?v=` version, push.

---

## 11. Future ideas

- **Organiser settings for match points and number of sets.** Change the points limit (for example 11, 15 or 21), the golden point on or off, and the number of games (1 or best of 3) per stage (league, quarter-final, semi-final, final) from a settings screen instead of editing `scoring.js`. A change should apply only to matches that haven't started, so finished results never change.
- A reusable template: split tournament-specific data from the engine so a new site needs only a config file and images (or a small setup page that writes the config).
- An admin page to enter teams, groups and the organiser's fixture sheet (upload the xlsx and read it) without editing code.
- Knockout line-up overrides and walkovers set from the admin page instead of `KO_OVERRIDES`.
- Supabase Realtime instead of polling, for instant updates when audiences are small.
- Per-scorer passkeys with an activity log of who entered which points.
- Singles events and more knockout formats (round of 16, plate / consolation draws, third-place match).
- Player profiles across tournaments (wins, finals, history) for repeat events.
- Automatic Instagram carousel of all champions at the end of the day.
