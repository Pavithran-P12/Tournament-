// Shared page helpers: results data, scorer access, formatting and the page refresh loop.

import { EVENT } from './tournament-data.js?v=20261025e';
import { tournament, snapshot, standings } from './engine.js?v=20261025e';
import { replay } from './scoring.js?v=20261025e';

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

/* ---------- results: published file + live scores + this device's scoring ---------- */
// Scores go live through Supabase: a scorer's phone sends each match's rally sequence ("AABAB...")
// as points are tapped, and every open page checks for changes every few seconds.
// Anyone can read the scores; only the scorer passkey can write them, and that check runs in the
// database, not here. data/results.json stays as an offline fallback and a manual backup route.
// The key below is Supabase's publishable key, which is designed to be public.
const SB_URL = 'https://wxlpbefrbxxbosjfeudk.supabase.co/rest/v1';
const SB_KEY = 'sb_publishable_N9SO6zdvGjgfggBDqfzjtA_es8fc9eU';
const SB_HEADERS = { apikey: SB_KEY, 'Content-Type': 'application/json' };
const LIVE_EVERY = 5000; // ms between checks for new scores

const LOCAL_KEY = 'tsp-scores-v1';
let published = { updated: null, matches: {} };
let publishedLoaded = false;
let remote = {}; // match id -> record from the live table
let remoteSeen = null; // newest updated_at received
const live = { ok: false, at: null, error: null };

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

const sidesToEvents = (sides) => [...sides].map((side, i) => ({ id: `r${i + 1}`, type: 'point', side }));

/** New or changed live scores since the last check (with a small overlap so nothing is missed). */
export async function loadRemote() {
  try {
    let q = `${SB_URL}/tsp_scores?select=match_id,sides,confirmed,court,deleted,updated_at&order=updated_at.asc`;
    if (remoteSeen) q += `&updated_at=gte.${encodeURIComponent(new Date(Date.parse(remoteSeen) - 15000).toISOString())}`;
    const res = await fetch(q, { headers: { apikey: SB_KEY }, cache: 'no-store' });
    if (!res.ok) throw new Error(`live scores ${res.status}`);
    const rows = await res.json();
    for (const r of rows) {
      const cur = remote[r.match_id];
      if (cur && cur.updatedAt >= r.updated_at) continue; // already have this (or a newer one we just sent)
      remote[r.match_id] = { events: sidesToEvents(r.sides), confirmed: r.confirmed, court: r.court, deleted: r.deleted, updatedAt: r.updated_at };
      if (!remoteSeen || r.updated_at > remoteSeen) remoteSeen = r.updated_at;
    }
    live.ok = true;
    live.at = new Date();
    live.error = null;
  } catch (e) {
    live.ok = false;
    live.error = e.message;
  }
}
export const liveInfo = () => ({ ...live });

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
  pushPending();
}
/** Deleting leaves a marker so the score is removed everywhere once it syncs. */
export function deleteScore(id) {
  saveLocalScore(id, { deleted: true, events: [] });
}

/* Sending this phone's changes to the live table, one at a time, oldest first. */
let pushing = false;
async function rpc(name, body) {
  const res = await fetch(`${SB_URL}/rpc/${name}`, { method: 'POST', headers: SB_HEADERS, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(json?.message || `request failed (${res.status})`);
    err.badKey = json?.code === '28000' || /passkey/.test(json?.message || '');
    throw err;
  }
  return json;
}
export async function pushPending() {
  const key = scorerKey();
  if (pushing || !key) return;
  pushing = true;
  try {
    const T = tournament();
    const entries = Object.entries(localScores()).sort((a, b) => (a[1].updatedAt || '').localeCompare(b[1].updatedAt || ''));
    for (const [id, rec] of entries) {
      const m = T.byId[id];
      if (!m) continue;
      let ts;
      if (rec.deleted) {
        ts = await rpc('tsp_delete_score', { p_passkey: key, p_match_id: id });
      } else {
        const sides = replay(rec.events || [], m.format).rallies.join('');
        ts = await rpc('tsp_save_score', { p_passkey: key, p_match_id: id, p_sides: sides, p_confirmed: !!rec.confirmed, p_court: rec.court || null });
      }
      remote[id] = { events: rec.events || [], confirmed: !!rec.confirmed, court: rec.court || null, deleted: !!rec.deleted, updatedAt: ts };
      const now = localScores();
      if (now[id]?.updatedAt === rec.updatedAt) { delete now[id]; save(local(), LOCAL_KEY, now); }
    }
    live.error = null;
  } catch (e) {
    if (e.badKey) lockScorer(); // passkey changed: ask again
    live.error = e.message;
  } finally {
    pushing = false;
  }
}

/** Merged view: published file, then live scores, then this phone's unsent changes. */
export function mergedRecords() {
  const out = { ...published.matches };
  for (const src of [remote, localScores()]) {
    for (const [id, rec] of Object.entries(src)) {
      if (rec.deleted) delete out[id];
      else out[id] = rec;
    }
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
// The passkey is checked by the database (only a bcrypt hash is stored there), never in this code.
// While unlocked it is kept for this tab only, so score updates can be sent with it.
const UNLOCK_KEY = 'tsp-scorer-key';

export async function checkPasskey(input) {
  let ok;
  try {
    ok = await rpc('tsp_check_passkey', { p_passkey: input });
  } catch {
    throw new Error('Could not check the passkey. Check your internet connection and try again.');
  }
  if (ok === true) {
    save(session(), UNLOCK_KEY, input);
    pushPending();
  }
  return ok === true;
}
const scorerKey = () => {
  const k = load(session(), UNLOCK_KEY, null);
  return typeof k === 'string' && k ? k : null;
};
export const isScorer = () => !!scorerKey();
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
    const sig = Object.values(states).map((s) => `${s.status}${s.score.a}-${s.score.b}${s.court || ''}`).join('|') + venueNow().minutes + `|${pendingChanges()}|${live.ok}|${live.error}`;
    if (force || sig !== last) {
      last = sig;
      render(states, venueNow());
    }
  };
  tick(true);
  loadPublished().then(() => tick(true));
  loadRemote().then(() => tick(true));
  pushPending();
  setInterval(tick, 2000);
  const poll = () => {
    if (document.visibilityState !== 'visible') return; // no checks while the tab is in the background
    loadRemote().then(() => tick());
    pushPending();
  };
  setInterval(poll, LIVE_EVERY);
  document.addEventListener('visibilitychange', poll);
  window.addEventListener('online', poll);
  setInterval(() => loadPublished().then(() => tick()), 300000); // fallback file, rarely changes
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
