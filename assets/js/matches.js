import { EVENT } from './tournament-data.js?v=20261022w';
import { tournament, standings, qualifiers, category } from './engine.js?v=20261022w';
import { mountDrawNotice, startLoop, markActiveNav, paintLiveCount, fmtTime, esc, matchHref } from './ui.js?v=20261022w';
import { matchCard, emptyState } from './components.js?v=20261022w';

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
const maxRound = Math.max(...T.matches.filter((m) => m.stage === 'league').map((m) => m.round));
$('[data-round]').insertAdjacentHTML('beforeend', [
  ...Array.from({ length: maxRound }, (_, i) => [String(i + 1), `League round ${i + 1}`]),
  ['quarter', 'Quarter-finals'], ['semi', 'Semi-finals'], ['final', 'Finals'],
].map(([v, l]) => `<option value="${v}">${l}</option>`).join(''));
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
      if (['quarter', 'semi', 'final'].includes(ui.round)) { if (m.stage !== ui.round) return false; }
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

const expanded = new Set();
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-expand]');
  if (!b) return;
  const id = b.dataset.expand;
  if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
  update();
});

const FORMAT_NOTE = {
  qf8: 'Group winners and the two best runners-up go through to the quarter-finals.',
  sf4: 'Group winners go through to the semi-finals: A v C and B v D.',
  final2: 'The top two teams play the final.',
};

function groupsView(states) {
  const cats = ui.cat === 'all' ? T.cats : [category(ui.cat)];
  return cats.map((c) => `<section class="cat-block">
    <h2 class="cat-block-title">${esc(c.name)}</h2>
    <p class="cat-block-note">${FORMAT_NOTE[c.format]}</p>
    <ul class="q-legend" aria-label="Legend">
      <li><span class="q-badge is-confirmed">Q</span> Qualified</li>
      <li><span class="q-badge">Q</span> In a qualifying place right now</li>
      <li class="q-legend-tip">Tap or hover a team to see its fixtures</li>
    </ul>
    <div class="group-grid">${Object.keys(c.teamsByGroup).map((g) => groupCard(c, g, states)).join('')}
    ${c.format === 'qf8' ? runnersUpCard(c, states) : ''}</div>
  </section>`).join('');
}

function groupCard(c, letter, states) {
  const t = standings(c.code, letter, states);
  const through = c.format === 'final2' ? 2 : 1;
  const matches = T.matches.filter((m) => m.cat === c.code && m.stage === 'league' && m.group === letter);
  let note = '';
  if (t.complete && t.needsDecision) note = '<p class="group-note warn">Level on the qualifying places. The organizer decides who goes through.</p>';
  else if (t.complete) {
    const w = esc(t.rows[0].team.name);
    if (c.format === 'final2') note = `<p class="group-note">${w} and ${esc(t.rows[1].team.name)} play the final.</p>`;
    else if (c.format === 'sf4') note = `<p class="group-note">${w} go through to semi-final ${letter === 'A' || letter === 'C' ? 1 : 2}.</p>`;
    else note = `<p class="group-note">${w} go through to the quarter-finals.</p>`;
  }
  const single = Object.keys(c.teamsByGroup).length === 1;
  // Q appears as soon as the group has a result; it is outlined until the group is complete.
  const showQ = t.played > 0 && !t.needsDecision;
  return `<article class="group-card group-${letter.toLowerCase()}">
    <header><h3 aria-label="${single ? 'Group' : `Group ${letter}`}"><span class="g-word" aria-hidden="true">Group</span><span class="g-badge" aria-hidden="true">${letter}</span></h3><span class="g-count">${t.played} of ${t.total} played</span></header>
    <table class="table group-table">
      <thead><tr><th scope="col"><span class="sr-only">Position</span></th><th scope="col">Team</th><th scope="col" title="Played">P</th><th scope="col" title="Won">W</th><th scope="col" title="Lost">L</th><th scope="col" title="Point difference">+/−</th></tr></thead>
      <tbody>${t.rows.map((r, i) => {
        const open = expanded.has(r.team.id);
        const q = showQ && i < through;
        const cls = ['team-row', i % 2 ? 'row-alt' : '', q ? 'is-through' : '', q && t.complete ? 'is-confirmed' : ''].filter(Boolean).join(' ');
        return `<tr class="${cls}">
        <td>${r.rank}</td>
        <td class="t-team"><button type="button" class="team-toggle" data-expand="${r.team.id}" aria-expanded="${open}" aria-controls="fx-${r.team.id}">
          <span class="tt-name">${esc(r.team.name)}</span>${q ? `<span class="q-badge${t.complete ? ' is-confirmed' : ''}" title="${t.complete ? 'Qualified' : 'In a qualifying place'}">Q</span>` : ''}<svg class="chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button></td>
        <td>${r.played}</td><td><strong>${r.won}</strong></td><td>${r.lost}</td><td>${r.pd > 0 ? '+' : ''}${r.pd}</td>
      </tr><tr class="team-fixtures${open ? ' is-open' : ''}${i % 2 ? ' row-alt' : ''}" id="fx-${r.team.id}"><td colspan="6">${teamFixtures(r.team.id, matches, states)}</td></tr>`;
      }).join('')}</tbody>
    </table>
    ${note}
  </article>`;
}

/** One team's league matches, with the result from that team's side. */
function teamFixtures(teamId, matches, states) {
  const mine = matches.filter((m) => m.a === teamId || m.b === teamId).sort((x, y) => x.start - y.start);
  return `<ul class="fixtures">${mine.map((m) => {
    const s = states[m.id];
    const isA = m.a === teamId;
    const opp = isA ? s.b : s.a;
    const us = isA ? s.score.a : s.score.b;
    const them = isA ? s.score.b : s.score.a;
    let result = '<span class="fx-res">Upcoming</span>';
    if (s.status === 'live') result = `<span class="fx-res fx-live">Live ${us}–${them}</span>`;
    if (s.status === 'completed') {
      const won = s.score.winner === (isA ? 'A' : 'B');
      result = `<span class="fx-res ${won ? 'fx-won' : 'fx-lost'}">${won ? 'Won' : 'Lost'} ${us}–${them}</span>`;
    }
    return `<li><a href="${matchHref(m.id)}"><span class="fx-when">Court ${m.court}, ${fmtTime(m.start)}</span><span class="fx-opp"><span class="vs">v</span> ${esc(opp.name)}</span>${result}</a></li>`;
  }).join('')}</ul>`;
}

function runnersUpCard(c, states) {
  const q = qualifiers(c.code, states);
  return `<article class="group-card">
    <header><h3>Best runners-up</h3><span>${q.complete ? 'Final' : 'Updates as groups finish'}</span></header>
    <table class="table">
      <thead><tr><th scope="col"><span class="sr-only">Position</span></th><th scope="col">Team</th><th scope="col">Group</th><th scope="col" title="Won">W</th><th scope="col" title="Point difference">+/−</th><th scope="col" title="Points scored">Pts</th></tr></thead>
      <tbody>${q.runnersUp.map((r, i) => `<tr class="${i < 2 && q.complete ? 'is-through' : ''}">
        <td>${i + 1}</td><td class="t-team">${esc(r.team.name)}</td><td>${r.group}</td><td><strong>${r.won}</strong></td><td>${r.pd > 0 ? '+' : ''}${r.pd}</td><td>${r.pf}</td>
      </tr>`).join('')}</tbody>
    </table>
    <p class="group-note">The top two join the six group winners in the quarter-finals. Ranked by wins, then point difference, then points scored.</p>
  </article>`;
}

const STAGES = [['quarter', 'Quarter-finals'], ['semi', 'Semi-finals'], ['final', 'Final']];

function knockoutView(states) {
  const cats = ui.cat === 'all' ? T.cats : [category(ui.cat)];
  return cats.map((c) => {
    const ko = T.matches.filter((m) => m.cat === c.code && m.stage !== 'league');
    const f = states[`${c.code}-F`];
    const champ = f.status === 'completed' ? f.winnerTeam.name : null;
    const cols = STAGES.filter(([stage]) => ko.some((m) => m.stage === stage)).map(([stage, title]) => `<div class="br-col br-${stage}"><h3>${title}</h3>${ko
      .filter((m) => m.stage === stage).sort((x, y) => x.id.localeCompare(y.id)).map((m) => matchCard(states[m.id], { showCategory: false })).join('')}</div>`);
    return `<section class="cat-block">
      <h2 class="cat-block-title">${esc(c.name)}</h2>
      <div class="bracket bracket-${cols.length + 1}">
        ${cols.join('')}
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
