// Shared page helpers: results data, scorer access, formatting and the page refresh loop.

import { EVENT } from './tournament-data.js?v=20261022g';
import { tournament, snapshot } from './engine.js?v=20261022g';
import { replay } from './scoring.js?v=20261022g';

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
      : pub && !!pub.confirmed === !!rec.confirmed && JSON.stringify(pub.events) === JSON.stringify(rec.events);
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
    if (!T.byId[id] || !rec.events?.length) continue;
    matches[id] = { events: rec.events, confirmed: !!rec.confirmed };
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
    if (!m || !rec.events) continue;
    try {
      out[id] = { sides: replay(rec.events, m.format).rallies, confirmed: !!rec.confirmed };
    } catch {
      /* ignore a corrupt record */
    }
  }
  return out;
}

export function currentStates() {
  return snapshot(venueNow().minutes, overrides());
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

export function stageLabel(m) {
  if (m.stage === 'league') return `Group ${m.group}, round ${m.round}`;
  return m.label;
}
export function teamLabel(st, side) {
  const team = side === 'A' ? st.a : st.b;
  if (team) return team.name;
  const ref = st.match.from?.[side === 'A' ? 0 : 1] ?? '';
  if (ref.startsWith('SF')) return `Winner of semi-final ${ref.slice(2)}`;
  return `Winner of group ${ref[0]}`;
}
export function statusPill(st) {
  const map = {
    live: ['live', 'Live'],
    completed: ['done', 'Final'],
    upcoming: ['next', fmtTime(st.match.start)],
    waiting: ['wait', 'Waiting for teams'],
  };
  const [cls, text] = map[st.status];
  return `<span class="pill pill-${cls}">${text}</span>`;
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
  if (EVENT.drawPublished) return;
  const n = document.createElement('div');
  n.className = 'draw-notice';
  n.innerHTML = '<strong>Sample draw.</strong> The real fixtures are published here 24 hours before play.';
  document.body.prepend(n);
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
