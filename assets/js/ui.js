// Shared page helpers: demo clock, demo scoring store, formatting and the demo bar.

import { EVENT } from './tournament-data.js';
import { tournament, snapshot } from './engine.js';
import { replay } from './scoring.js';

/* ---------- storage (best effort; the pages work without it) ---------- */
function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or blocked storage */
  }
}

/* ---------- demo clock ---------- */
const CLOCK_KEY = 'tsp-demo-clock-v1';
const MIN_T = 8 * 60 + 30;
const MAX_T = EVENT.dayEnd;
let clock = load(CLOCK_KEY, null) || { demo: 11 * 60 + 40, real: Date.now(), speed: 10, playing: true };

const urlT = new URLSearchParams(location.search).get('t');
if (urlT && /^\d{1,2}:\d{2}$/.test(urlT)) {
  const [h, m] = urlT.split(':').map(Number);
  clock = { ...clock, demo: h * 60 + m, real: Date.now() };
}

export function now() {
  const t = clock.playing ? clock.demo + ((Date.now() - clock.real) / 60000) * clock.speed : clock.demo;
  return Math.max(MIN_T, Math.min(MAX_T, t));
}
function reanchor(patch) {
  clock = { ...clock, demo: now(), real: Date.now(), ...patch };
  save(CLOCK_KEY, clock);
}
export const clockControls = {
  set: (t) => reanchor({ demo: t }),
  toggle: () => reanchor({ playing: !clock.playing }),
  speed: (s) => reanchor({ speed: s }),
  get state() { return clock; },
};

/* ---------- demo scoring (stands in for the database until the backend exists) ---------- */
const SCORE_KEY = 'tsp-demo-scoring-v1';
export function scoringStore() {
  return load(SCORE_KEY, {});
}
export function saveScoring(store) {
  save(SCORE_KEY, store);
}
function overrides() {
  const T = tournament();
  const out = {};
  for (const [id, rec] of Object.entries(scoringStore())) {
    const m = T.byId[id];
    if (!m) continue;
    try {
      out[id] = replay(rec.events, m.format).rallies;
    } catch {
      /* ignore a corrupt record */
    }
  }
  return out;
}

export function currentStates() {
  return snapshot(now(), overrides());
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
export const matchHref = (id) => `match.html?id=${encodeURIComponent(id)}`;

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

/* ---------- page loop + demo bar ---------- */
export function startLoop(render) {
  let last = '';
  const tick = () => {
    const states = currentStates();
    // Re-render only when something visible changed.
    const sig = Object.values(states).map((s) => `${s.status}${s.score.a}-${s.score.b}`).join('|') + Math.floor(now());
    if (sig !== last) {
      last = sig;
      render(states, now());
    }
    paintDemoBar();
  };
  tick();
  setInterval(tick, 1000);
  window.addEventListener('storage', () => { clock = load(CLOCK_KEY, clock); last = ''; tick(); });
  return () => { last = ''; tick(); };
}

let bar;
export function mountDemoBar() {
  bar = document.createElement('div');
  bar.className = 'demo-bar';
  bar.innerHTML = `
    <span class="demo-tag">Demo</span>
    <span class="demo-note">Sample teams, simulated clock</span>
    <button type="button" class="demo-play" aria-label="Pause demo clock"></button>
    <output class="demo-time" aria-live="off"></output>
    <input class="demo-range" type="range" min="${MIN_T}" max="${MAX_T}" step="1" aria-label="Demo time of day">
    <select class="demo-speed" aria-label="Demo clock speed">
      <option value="1">1×</option><option value="10">10×</option><option value="30">30×</option>
    </select>`;
  document.body.prepend(bar);
  bar.querySelector('.demo-play').addEventListener('click', () => { clockControls.toggle(); refresh(); });
  const range = bar.querySelector('.demo-range');
  range.addEventListener('input', () => { clockControls.set(Number(range.value)); refresh(); });
  bar.querySelector('.demo-speed').addEventListener('change', (e) => { clockControls.speed(Number(e.target.value)); });
  paintDemoBar();
}
let refresh = () => {};
export function onDemoChange(fn) { refresh = fn; }

function paintDemoBar() {
  if (!bar) return;
  const t = now();
  bar.querySelector('.demo-time').textContent = fmtTime(t);
  const range = bar.querySelector('.demo-range');
  if (document.activeElement !== range) range.value = Math.floor(t);
  const play = bar.querySelector('.demo-play');
  play.textContent = clock.playing ? 'Pause' : 'Play';
  play.setAttribute('aria-label', clock.playing ? 'Pause demo clock' : 'Run demo clock');
  bar.querySelector('.demo-speed').value = String(clock.speed);
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
