import { EVENT } from './tournament-data.js?v=20261022g';
import { tournament, standings, category } from './engine.js?v=20261022g';
import { mountDrawNotice, startLoop, markActiveNav, paintLiveCount, fmtTime, esc, matchHref } from './ui.js?v=20261022g';
import { matchCard, emptyState } from './components.js?v=20261022g';

const $ = (s) => document.querySelector(s);
const T = tournament();

const params = new URLSearchParams(location.search);
const ui = {
  cat: T.cats.some((c) => c.code === params.get('cat')) ? params.get('cat') : 'all',
  view: ['schedule', 'groups', 'knockout'].includes(params.get('view')) ? params.get('view') : 'schedule',
  status: ['live', 'upcoming', 'completed'].includes(params.get('status')) ? params.get('status') : 'all',
  court: params.get('court') || 'all',
  round: params.get('round') || 'all',
};

function syncUrl() {
  const p = new URLSearchParams();
  if (ui.cat !== 'all') p.set('cat', ui.cat);
  if (ui.view !== 'schedule') p.set('view', ui.view);
  if (ui.status !== 'all') p.set('status', ui.status);
  if (ui.court !== 'all') p.set('court', ui.court);
  if (ui.round !== 'all') p.set('round', ui.round);
  history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}`);
}

/* ---------- controls ---------- */
$('[data-cat-tabs]').innerHTML = [['all', 'All categories'], ...T.cats.map((c) => [c.code, c.short])]
  .map(([code, label]) => `<button type="button" role="tab" data-cat="${code}">${esc(label)}</button>`).join('');
$('[data-court]').insertAdjacentHTML('beforeend', Array.from({ length: EVENT.courts }, (_, i) => `<option value="${i + 1}">Court ${i + 1}</option>`).join(''));
$('[data-court]').value = ui.court;
$('[data-round]').value = ui.round;

function paintControls() {
  document.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === ui.cat)));
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === ui.view)));
  document.querySelectorAll('[data-status]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === ui.status)));
  $('[data-filters]').hidden = ui.view !== 'schedule';
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat],[data-view],[data-status]');
  if (!b) return;
  if (b.dataset.cat) ui.cat = b.dataset.cat;
  if (b.dataset.view) ui.view = b.dataset.view;
  if (b.dataset.status) ui.status = b.dataset.status;
  update();
});
$('[data-court]').addEventListener('change', (e) => { ui.court = e.target.value; update(); });
$('[data-round]').addEventListener('change', (e) => { ui.round = e.target.value; update(); });

/* ---------- views ---------- */
function scheduleView(states) {
  const list = Object.values(states).filter((s) => {
    const m = s.match;
    if (ui.cat !== 'all' && m.cat !== ui.cat) return false;
    if (ui.status === 'upcoming' && !(s.status === 'upcoming' || s.status === 'waiting')) return false;
    if (ui.status !== 'all' && ui.status !== 'upcoming' && s.status !== ui.status) return false;
    if (ui.court !== 'all' && String(m.court) !== ui.court) return false;
    if (ui.round !== 'all') {
      if (ui.round === 'semi' || ui.round === 'final') { if (m.stage !== ui.round) return false; }
      else if (m.stage !== 'league' || String(m.round) !== ui.round) return false;
    }
    return true;
  });
  if (!list.length) return emptyState('No matches match these filters. Try All courts or All rounds.');
  const slots = new Map();
  for (const s of list) {
    if (!slots.has(s.match.start)) slots.set(s.match.start, []);
    slots.get(s.match.start).push(s);
  }
  return [...slots.entries()].sort((a, b) => a[0] - b[0]).map(([start, items]) => {
    const live = items.some((s) => s.status === 'live');
    return `<section class="slot${live ? ' slot-live' : ''}">
      <h2 class="slot-time">${fmtTime(start)}</h2>
      <div class="slot-grid">${items.sort((a, b) => a.match.court - b.match.court).map((s) => matchCard(s, { showCategory: ui.cat === 'all' })).join('')}</div>
    </section>`;
  }).join('');
}

function groupsView(states) {
  const cats = ui.cat === 'all' ? T.cats : [category(ui.cat)];
  return cats.map((c) => `<section class="cat-block">
    ${ui.cat === 'all' ? `<h2 class="cat-block-title">${esc(c.name)}</h2>` : ''}
    <div class="group-grid">${Object.keys(c.teamsByGroup).map((g) => groupCard(c, g, states)).join('')}</div>
  </section>`).join('');
}

function groupCard(c, letter, states) {
  const t = standings(c.code, letter, states);
  const semi = letter === 'A' || letter === 'C' ? 'semi-final 1' : 'semi-final 2';
  const matches = T.matches.filter((m) => m.cat === c.code && m.stage === 'league' && m.group === letter);
  const note = t.complete
    ? t.needsDecision ? '<p class="group-note warn">Level at the top. The organizer decides who goes through.</p>'
      : `<p class="group-note">${esc(t.rows[0].team.name)} go through to ${semi}.</p>`
    : '';
  return `<article class="group-card">
    <header><h3>Group ${letter}</h3><span>${t.played} of ${t.total} played</span></header>
    <table class="table">
      <thead><tr><th scope="col"><span class="sr-only">Position</span></th><th scope="col">Team</th><th scope="col" title="Played">P</th><th scope="col" title="Won">W</th><th scope="col" title="Lost">L</th><th scope="col" title="Point difference">+/−</th></tr></thead>
      <tbody>${t.rows.map((r, i) => `<tr class="${i === 0 && t.complete && !t.needsDecision ? 'is-through' : ''}">
        <td>${r.rank}</td><td class="t-team">${esc(r.team.name)}</td><td>${r.played}</td><td><strong>${r.won}</strong></td><td>${r.lost}</td><td>${r.pd > 0 ? '+' : ''}${r.pd}</td>
      </tr>`).join('')}</tbody>
    </table>
    ${note}
    <ul class="group-results">${matches.map((m) => {
      const s = states[m.id];
      const score = s.status === 'live' || s.status === 'completed' ? `${s.score.a}–${s.score.b}` : fmtTime(m.start);
      return `<li class="gr-${s.status}"><a href="${matchHref(m.id)}"><span class="${s.score.winner === 'A' ? 'w' : ''}">${esc(s.a.name)}</span><span class="gr-score">${score}</span><span class="${s.score.winner === 'B' ? 'w' : ''}">${esc(s.b.name)}</span></a></li>`;
    }).join('')}</ul>
  </article>`;
}

function knockoutView(states) {
  const cats = ui.cat === 'all' ? T.cats : [category(ui.cat)];
  return cats.map((c) => {
    const sf1 = states[`${c.code}-SF1`];
    const sf2 = states[`${c.code}-SF2`];
    const f = states[`${c.code}-F`];
    const champ = f.status === 'completed' ? f.winnerTeam.name : null;
    return `<section class="cat-block">
      <h2 class="cat-block-title">${esc(c.name)}</h2>
      <div class="bracket">
        <div class="br-col"><h3>Semi-finals</h3>${matchCard(sf1, { showCategory: false })}${matchCard(sf2, { showCategory: false })}</div>
        <div class="br-col br-final"><h3>Final</h3>${matchCard(f, { showCategory: false })}</div>
        <div class="br-col br-champ"><h3>Champions</h3><div class="champ${champ ? ' is-set' : ''}">${champ ? esc(champ) : 'Decided in the final'}</div></div>
      </div>
    </section>`;
  }).join('');
}

/* ---------- loop ---------- */
mountDrawNotice();
markActiveNav();
let lastStates = null;
function render(states) {
  lastStates = states;
  paintLiveCount(states);
  const all = Object.values(states);
  const done = all.filter((s) => s.status === 'completed').length;
  const live = all.filter((s) => s.status === 'live').length;
  $('[data-progress]').innerHTML = `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${all.length}" aria-valuenow="${done}" aria-label="Matches played"><span style="width:${(done / all.length) * 100}%"></span></div>
    <p>${done} of ${all.length} played${live ? `, <span class="live-text">${live} live</span>` : ''}</p>`;
  const body = ui.view === 'groups' ? groupsView(states) : ui.view === 'knockout' ? knockoutView(states) : scheduleView(states);
  $('[data-view-body]').innerHTML = body;
}
function update() {
  syncUrl();
  paintControls();
  if (lastStates) render(lastStates);
}
paintControls();
startLoop(render);
