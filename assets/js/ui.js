// Shared page helpers: results data, scorer access, formatting and the page refresh loop.

import { EVENT } from './tournament-data.js?v=20261025c';
import { tournament, snapshot, standings } from './engine.js?v=20261025c';
import { replay } from './scoring.js?v=20261025c';

/* ---------- storage (best effort; the pages work without it) ---------- */
function load(store, key, fallback) {
  try {
    const v = store.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function save(store, key, value) {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or blocked storage */
  }
}
const local = () => (typeof localStorage === 'undefined' ? null : localStorage);
const session = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);

/* ---------- time of day at the venue (India) ---------- */
export function venueNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  const phase = date < EVENT.date ? 'before' : date > EVENT.date ? 'after' : minutes < EVENT.dayStart ? 'morning' : minutes >= EVENT.dayEnd ? 'evening' : 'during';
  return { date, minutes, phase };
}

/* ---------- results: published file + this device's scoring ---------- */
// data/results.json is the published copy everyone sees. Scores entered on this device are
// kept locally until the scorer downloads a new results file and the organizer publishes it.
const LOCAL_KEY = 'tsp-scores-v1';
let published = { updated: null, matches: {} };
let publishedLoaded = false;

export async function loadPublished() {
  try {
    const res = await fetch(`data/results.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json && typeof json.matches === 'object') {
        published = json;
        pruneLocal();
      }
    }
  } catch {
    /* offline or file missing: keep what we have */
  }
  publishedLoaded = true;
  return published;
}
/** Once the published file contains this device's changes, they no longer count as pending. */
function pruneLocal() {
  const all = localScores();
  let changed = false;
  for (const [id, rec] of Object.entries(all)) {
    const pub = published.matches[id];
    const same = rec.deleted
      ? !pub
      : pub && !!pub.confirmed === !!rec.confirmed && (pub.court || null) === (rec.court || null) && JSON.stringify(pub.events) === JSON.stringify(rec.events);
    if (same) { delete all[id]; changed = true; }
  }
  if (changed) save(local(), LOCAL_KEY, all);
}
export const publishedInfo = () => ({ updated: published.updated, loaded: publishedLoaded });

export function localScores() {
  return load(local(), LOCAL_KEY, {});
}
export function saveLocalScore(id, rec) {
  const all = localScores();
  all[id] = { ...rec, updatedAt: new Date().toISOString() };
  save(local(), LOCAL_KEY, all);
}
/** Deleting leaves a marker so the published score is hidden on this device and left out of the next download. */
export function deleteScore(id) {
  saveLocalScore(id, { deleted: true, events: [] });
}

/** Merged view: this device's changes on top of the published file. */
export function mergedRecords() {
  const out = { ...published.matches };
  for (const [id, rec] of Object.entries(localScores())) {
    if (rec.deleted) delete out[id];
    else out[id] = rec;
  }
  return out;
}
export function recordFor(id) {
  return mergedRecords()[id];
}
export function pendingChanges() {
  return Object.keys(localScores()).length;
}

/** The file the organizer publishes as data/results.json. */
export function resultsFile() {
  const T = tournament();
  const matches = {};
  for (const [id, rec] of Object.entries(mergedRecords())) {
    if (!T.byId[id] || (!rec.events?.length && !rec.court)) continue;
    matches[id] = { events: rec.events || [], confirmed: !!rec.confirmed, ...(rec.court ? { court: rec.court } : {}) };
  }
  return { updated: new Date().toISOString(), matches };
}
export function downloadResults() {
  const blob = new Blob([JSON.stringify(resultsFile(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'results.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function clearLocalScores() {
  save(local(), LOCAL_KEY, {});
}

function overrides() {
  const T = tournament();
  const out = {};
  for (const [id, rec] of Object.entries(mergedRecords())) {
    const m = T.byId[id];
    if (!m || !rec.events?.length) continue;
    try {
      out[id] = { sides: replay(rec.events, m.format).rallies, confirmed: !!rec.confirmed };
    } catch {
      /* ignore a corrupt record */
    }
  }
  return out;
}

export function currentStates() {
  const states = snapshot(venueNow().minutes, overrides());
  // Courts are not planned in advance; a scorer can record the court a match was played on.
  for (const [id, rec] of Object.entries(mergedRecords())) if (states[id] && rec.court) states[id].court = rec.court;
  return states;
}

/* ---------- scorer passkey ---------- */
// Only a salted SHA-256 hash is stored here, never the passkey itself.
// This keeps casual visitors out; it is not server-side security (see README).
const PASS_HASH = '89160e92f57e7ebb2ed3191d7a68ac6c499bc9a16f270b16b719752784abf9a8';
const UNLOCK_KEY = 'tsp-scorer-unlocked';

export async function checkPasskey(input) {
  if (!crypto?.subtle) throw new Error('This browser cannot check the passkey. Open the site over https.');
  const data = new TextEncoder().encode(`tsp-scorer:${input}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const ok = hex === PASS_HASH;
  if (ok) save(session(), UNLOCK_KEY, true);
  return ok;
}
export const isScorer = () => load(session(), UNLOCK_KEY, false) === true;
export function lockScorer() {
  try { sessionStorage.removeItem(UNLOCK_KEY); } catch { /* ignore */ }
}

/* ---------- formatting ---------- */
export function fmtTime(min) {
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
// Hash form works on every static server, including ones that rewrite or redirect .html URLs.
export const matchHref = (id) => `match.html#${encodeURIComponent(id)}`;

/** Short code shown in the match badge: the sheet's match number, or QF1 / SF2 / F. */
export function matchCode(m) {
  if (m.stage === 'league') return m.no ? String(m.no) : String(m.round);
  return m.id.split('-').pop();
}
export function stageLabel(m) {
  if (m.stage === 'league') return m.no ? `Group ${m.group}, match ${m.no}` : `Group ${m.group}, round ${m.round}`;
  return m.label;
}
export function teamLabel(st, side, { full = false } = {}) {
  const team = side === 'A' ? st.a : st.b;
  if (team) return full ? team.fullName : team.name;
  return st.match.fromLabels?.[side === 'A' ? 0 : 1] ?? 'To be decided';
}
export function statusPill(st) {
  const map = {
    live: ['live', 'Live'],
    completed: ['done', 'Result'],
    upcoming: ['next', 'Upcoming'],
    waiting: ['wait', 'Waiting for teams'],
  };
  const [cls, text] = map[st.status];
  return `<span class="pill pill-${cls}">${text}</span>`;
}

/* ---------- a team's tournament journey ---------- */
const STAGE_RANK = { league: 0, quarter: 1, semi: 2, final: 3 };
/**
 * Every match a team has played or is due to play, in order: league matches by sheet number, then
 * the knockout matches it has reached. Stops at the stage where it went out.
 */
export function teamJourney(teamId, states) {
  const T = tournament();
  const team = T.teamIndex[teamId];
  const mine = Object.values(states)
    .filter((st) => (st.match.stage === 'league' ? st.match.a === teamId || st.match.b === teamId : st.a?.id === teamId || st.b?.id === teamId))
    .sort((x, y) => STAGE_RANK[x.match.stage] - STAGE_RANK[y.match.stage] || (x.match.no ?? 0) - (y.match.no ?? 0) || x.match.id.localeCompare(y.match.id));
  let won = 0;
  let lost = 0;
  const matches = mine.map((st) => {
    const m = st.match;
    const side = (st.a?.id ?? m.a) === teamId ? 'A' : 'B';
    const oppSide = side === 'A' ? 'B' : 'A';
    const multi = m.format.bestOf > 1;
    const sc = st.score;
    let outcome = 'NEXT';
    let score = '';
    let detail = '';
    if (st.status === 'completed') {
      outcome = sc.winner === side ? 'W' : 'L';
      outcome === 'W' ? won++ : lost++;
      if (multi) {
        score = `${sc.gamesWon[side]}–${sc.gamesWon[oppSide]}`;
        detail = sc.games.map((g) => (side === 'A' ? `${g.a}–${g.b}` : `${g.b}–${g.a}`)).join(', ');
      } else score = side === 'A' ? `${sc.a}–${sc.b}` : `${sc.b}–${sc.a}`;
    } else if (st.status === 'live') {
      outcome = 'LIVE';
      score = side === 'A' ? `${sc.a}–${sc.b}` : `${sc.b}–${sc.a}`;
    }
    const knockout = m.stage !== 'league';
    return {
      st, knockout, outcome, score, detail,
      code: knockout ? m.id.split('-').pop() : `M${m.no ?? m.round}`,
      stage: knockout ? m.label : `${Object.keys(T.cats.find((c) => c.code === m.cat).groups).length > 1 ? `Group ${m.group}` : 'League'}${st.court ? ` · Court ${st.court}` : ''}`,
      opp: teamLabel(st, oppSide),
    };
  });
  // How far they got
  const cat = T.cats.find((c) => c.code === team.cat);
  const ko = matches.filter((x) => x.knockout);
  const last = ko[ko.length - 1];
  const table = standings(team.cat, team.group, states);
  const rank = table.rows.findIndex((r) => r.team.id === teamId) + 1;
  let standing;
  let tone = 'line';
  if (last) {
    const stage = last.st.match.stage;
    const name = { quarter: 'Quarter-finalist', semi: 'Semi-finalist', final: 'Finalist' }[stage];
    if (last.outcome === 'W' && stage === 'final') { standing = 'Champions'; tone = 'gold'; }
    else if (last.outcome === 'L') { standing = stage === 'final' ? 'Runners-up' : name; tone = stage === 'final' ? 'gold' : 'line'; }
    else { standing = stage === 'final' ? 'In the final' : stage === 'semi' ? 'In the semi-finals' : 'In the quarter-finals'; tone = 'win'; }
  } else if (table.complete) {
    const place = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'][rank];
    standing = rank <= 2 ? (cat.format === 'final2' ? 'Through to the final' : 'Through to the knockouts') : Object.keys(cat.groups).length > 1 ? `Group ${team.group}, ${place} place` : `${place} place`;
    tone = rank <= 2 ? 'win' : 'line';
  } else {
    standing = Object.keys(cat.groups).length > 1 ? `Group ${team.group}` : 'League stage';
  }
  const played = won + lost;
  const groupPart = Object.keys(cat.groups).length > 1 ? `Group ${team.group}` : 'League';
  const summary = played ? `${groupPart} · ${played} played · ${won} won · ${lost} lost` : `${groupPart} · ${matches.length} matches to play`;
  return { team, cat, matches, standing, tone, summary, won, lost };
}

/* ---------- page loop ---------- */
export function startLoop(render) {
  let last = '';
  const tick = (force = false) => {
    const states = currentStates();
    // Re-render only when something visible changed.
    const sig = Object.values(states).map((s) => `${s.status}${s.score.a}-${s.score.b}`).join('|') + venueNow().minutes;
    if (force || sig !== last) {
      last = sig;
      render(states, venueNow());
    }
  };
  tick(true);
  loadPublished().then(() => tick(true));
  setInterval(tick, 2000);
  setInterval(() => loadPublished().then(() => tick()), 60000); // pick up newly published results
  window.addEventListener('storage', () => tick(true)); // scoring in another tab on this device
  return () => tick(true);
}

/** Shown until the real draw is entered in tournament-data.js. */
export function mountDrawNotice() {
  const text = !EVENT.drawPublished
    ? '<strong>Sample draw.</strong> The real fixtures are published here 24 hours before play.'
    : EVENT.timesTentative ? `<strong>Report ${EVENT.reportBefore} minutes before your category starts.</strong> Beginners ${reportBy('beginner')}, Intermediate ${reportBy('intermediate')}, knockouts ${reportBy('knockout')}.` : '';
  if (!text) return;
  const n = document.createElement('div');
  n.className = 'draw-notice';
  n.innerHTML = text;
  document.body.prepend(n);
}

/** The organizer's session for a match: its category's league window, or the knockout window. */
export function sessionFor(m) {
  if (m.stage !== 'league') return EVENT.sessions.find((s) => s.key === 'knockout');
  return EVENT.sessions.find((s) => s.cats.includes(m.cat));
}
const span = (s) => `${fmtTime(s.start).replace(':00', '')} – ${fmtTime(s.end).replace(':00', '')}`.replace(/ AM – (\d+(?::\d+)?) AM/, '–$1 AM').replace(/ PM – (\d+(?::\d+)?) PM/, '–$1 PM');
/** Session strip plus the reporting reminder, used on the home and match center pages. */
export function dayPlanHtml() {
  return `<div class="day-plan">
    <ol class="dp-sessions">${EVENT.sessions.map((s) => `<li class="dp-${s.key}"><span class="dp-time">${span(s)}</span><strong>${esc(s.label)}</strong><span class="dp-detail">${esc(s.detail)}</span><span class="dp-by">Report ${reportBy(s)}</span></li>`).join('')}</ol>
    <p class="dp-report"><span class="dp-clock" aria-hidden="true">⏰</span><span><strong>Report ${EVENT.reportBefore} minutes before your category's start time.</strong> Be ready when called: a team not on court within ${EVENT.calledWithin} minutes of being called may lose by walkover.</span></p>
  </div>`;
}
export function sessionSpan(s) { return span(s); }
/** "by 8:30 AM": the latest reporting time for a session. */
export function reportBy(key) {
  const s = typeof key === 'string' ? EVENT.sessions.find((x) => x.key === key) : key;
  return `by ${fmtTime(s.start - EVENT.reportBefore)}`;
}

export function markActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach((a) => {
    if (a.getAttribute('href') === page || (page === 'match.html' && a.getAttribute('href') === 'matches.html')) a.setAttribute('aria-current', 'page');
  });
}

export function paintLiveCount(states) {
  const n = Object.values(states).filter((s) => s.status === 'live').length;
  document.querySelectorAll('[data-live-count]').forEach((el) => {
    el.textContent = n ? `${n} live` : '';
    el.hidden = !n;
  });
}
