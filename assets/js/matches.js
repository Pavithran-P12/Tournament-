import { EVENT } from './tournament-data.js?v=20261025f';
import { tournament, standings, category } from './engine.js?v=20261025f';
import { mountDrawNotice, startLoop, markActiveNav, paintLiveCount, fmtTime, esc, matchHref, dayPlanHtml, sessionFor, sessionSpan, teamJourney, currentStates } from './ui.js?v=20261025f';
import { openTeamShare } from './share.js?v=20261025f';
import { matchCard, matchRow, emptyState } from './components.js?v=20261025f';

const $ = (s) => document.querySelector(s);
const T = tournament();

const params = new URLSearchParams(location.search);
const ui = {
  cat: T.cats.some((c) => c.code === params.get('cat')) ? params.get('cat') : 'all',
  view: ['schedule', 'groups', 'knockout'].includes(params.get('view')) ? params.get('view') : 'groups',
  status: ['live', 'upcoming', 'completed'].includes(params.get('status')) ? params.get('status') : 'all',
  group: /^[A-D]$/.test(params.get('group') || '') ? params.get('group') : 'all',
  round: ['league', 'quarter', 'semi', 'final'].includes(params.get('round')) ? params.get('round') : 'all',
};

function syncUrl() {
  const p = new URLSearchParams();
  if (ui.cat !== 'all') p.set('cat', ui.cat);
  if (ui.view !== 'groups') p.set('view', ui.view);
  if (ui.status !== 'all') p.set('status', ui.status);
  if (ui.group !== 'all') p.set('group', ui.group);
  if (ui.round !== 'all') p.set('round', ui.round);
  history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}`);
}

$('[data-day-plan]').innerHTML = dayPlanHtml();

/* ---------- controls ---------- */
$('[data-cat-tabs]').innerHTML = [['all', 'All categories'], ...T.cats.map((c) => [c.code, c.short])]
  .map(([code, label]) => `<button type="button" role="tab" data-cat="${code}">${esc(label)}</button>`).join('');
// Group options follow the selected category (Beginner Women's has a single group).
function fillGroups() {
  const cats = ui.cat === 'all' ? T.cats : [category(ui.cat)];
  const letters = [...new Set(cats.flatMap((c) => Object.keys(c.groups)))].sort();
  if (!letters.includes(ui.group)) ui.group = 'all';
  const sel = $('[data-group]');
  sel.innerHTML = `<option value="all">All groups</option>${letters.map((g) => `<option value="${g}">Group ${g}</option>`).join('')}`;
  sel.value = ui.group;
}
$('[data-round]').insertAdjacentHTML('beforeend', [
  ['league', 'League'], ['quarter', 'Quarter-finals'], ['semi', 'Semi-finals'], ['final', 'Finals'],
].map(([v, l]) => `<option value="${v}">${l}</option>`).join(''));
$('[data-round]').value = ui.round;

function paintControls() {
  document.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === ui.cat)));
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === ui.view)));
  document.querySelectorAll('[data-status]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === ui.status)));
  $('[data-filters]').hidden = ui.view !== 'schedule';
  fillGroups();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat],[data-view],[data-status]');
  if (!b) return;
  if (b.dataset.cat) ui.cat = b.dataset.cat;
  if (b.dataset.view) ui.view = b.dataset.view;
  if (b.dataset.status) ui.status = b.dataset.status;
  update();
});
$('[data-group]').addEventListener('change', (e) => { ui.group = e.target.value; update(); });
$('[data-round]').addEventListener('change', (e) => { ui.round = e.target.value; update(); });

/* ---------- views ---------- */
function scheduleView(states) {
  const list = Object.values(states).filter((s) => {
    const m = s.match;
    if (ui.cat !== 'all' && m.cat !== ui.cat) return false;
    if (ui.status === 'upcoming' && !(s.status === 'upcoming' || s.status === 'waiting')) return false;
    if (ui.status !== 'all' && ui.status !== 'upcoming' && s.status !== ui.status) return false;
    if (ui.group !== 'all' && (m.stage !== 'league' || m.group !== ui.group)) return false;
    if (ui.round !== 'all' && m.stage !== ui.round) return false;
    return true;
  });
  if (!list.length) return emptyState('No matches match these filters. Try All groups or All stages.');
  // Sheet order: category by category, league matches by match number, then the knockouts.
  const stageRank = { league: 0, quarter: 1, semi: 2, final: 3 };
  const order = (x, y) => stageRank[x.match.stage] - stageRank[y.match.stage] || (x.match.no ?? 0) - (y.match.no ?? 0) || x.match.id.localeCompare(y.match.id);
  return T.cats.filter((c) => list.some((s) => s.match.cat === c.code)).map((c) => {
    const mine = list.filter((s) => s.match.cat === c.code).sort(order);
    const league = mine.filter((s) => s.match.stage === 'league');
    const ko = mine.filter((s) => s.match.stage !== 'league');
    const sess = sessionFor(league[0]?.match ?? ko[0].match);
    const live = mine.some((s) => s.status === 'live');
    const block = (title, items, note) => items.length ? `<section class="sched-block${live ? ' is-live' : ''}">
      <h2 class="sched-title">${title} <small>${note}</small></h2>
      <ol class="mlist">${items.map((s) => `<li>${matchRow(s)}</li>`).join('')}</ol>
    </section>` : '';
    const koSess = EVENT.sessions.find((x) => x.key === 'knockout');
    return block(esc(c.short), league, `${esc(sess.label)} · ${sessionSpan(sess)}`) + block(`${esc(c.short)} knockouts`, ko, sessionSpan(koSess));
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

/* ---------- team journey: every match a team plays, with results, downloadable as an image ---------- */
const journeyDialog = document.createElement('dialog');
journeyDialog.className = 'share-dialog journey-dialog';
document.body.append(journeyDialog);
journeyDialog.addEventListener('click', (e) => {
  if (e.target === journeyDialog || e.target.closest('[data-journey-close]')) journeyDialog.close();
});
let journeyId = null;
function paintJourney() {
  if (!journeyId) return;
  const j = teamJourney(journeyId, currentStates());
  const row = (x) => {
    const pill = { W: 'Won', L: 'Lost', LIVE: 'Live', NEXT: 'Upcoming' }[x.outcome];
    return `<li class="jr-row${x.knockout ? ' is-ko' : ''}"><a href="${matchHref(x.st.match.id)}">
      <span class="jr-code">${esc(x.code)}</span>
      <span class="jr-main"><span class="jr-stage">${esc(x.stage)}</span><span class="jr-opp"><span class="vs">v</span> ${esc(x.opp)}</span></span>
      <span class="jr-res jr-${x.outcome.toLowerCase()}">${x.score ? `<b>${esc(x.score)}</b>` : ''}<em>${pill}</em>${x.detail ? `<small>${esc(x.detail)}</small>` : ''}</span>
    </a></li>`;
  };
  journeyDialog.classList.toggle('is-champion', j.standing === 'Champions');
  journeyDialog.innerHTML = `
    <div class="share-head"><h2>Team journey</h2><button type="button" class="btn btn-text" data-journey-close>Close</button></div>
    <p class="jr-cat">${esc(j.cat.name)}</p>
    ${j.standing === 'Champions' ? '<div class="jr-champ"><span class="winner-tag">★ Winner ★</span><span class="cb-crown" aria-hidden="true">👑</span></div>' : ''}
    <h3 class="jr-team">${esc(j.team.players[0])} <span>&amp;</span> ${esc(j.team.players[1])}</h3>
    <p class="jr-standing jr-tone-${j.tone}">${esc(j.standing)}</p>
    <p class="jr-summary">${esc(j.summary)}</p>
    <ol class="jr-list">${j.matches.map(row).join('')}</ol>
    <div class="share-actions"><button type="button" class="btn btn-share" data-journey-image>Download or share as image</button></div>`;
  journeyDialog.querySelector('[data-journey-image]').addEventListener('click', () => {
    journeyDialog.close();
    openTeamShare({
      category: j.cat.name.replace(`${j.cat.level} `, ''), level: j.cat.level,
      players: j.team.players, standing: j.standing, standingTone: j.tone, summary: j.summary,
      matches: j.matches.map((x) => ({ code: x.code, stage: x.stage, opp: x.opp, outcome: x.outcome, score: x.score, detail: x.detail, knockout: x.knockout })),
    }, `${j.team.players.map((p) => p.split(' ')[0]).join('-')}-journey.png`.replace(/[^\w.-]/g, ''));
  });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-journey]');
  if (!b) return;
  journeyId = b.dataset.journey;
  paintJourney();
  journeyDialog.showModal();
});

const FORMAT_NOTE = {
  qf: 'The top two of each group go through to the quarter-finals: A1 v B2, C1 v D2, B1 v A2, D1 v C2.',
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
      <li class="q-legend-tip">Tap a team to see its fixtures, or the route icon for its full journey</li>
    </ul>
    <div class="group-grid">${Object.keys(c.teamsByGroup).map((g) => groupCard(c, g, states)).join('')}</div>
  </section>`).join('');
}

function groupCard(c, letter, states) {
  const t = standings(c.code, letter, states);
  const through = 2;
  const matches = T.matches.filter((m) => m.cat === c.code && m.stage === 'league' && m.group === letter);
  let note = '';
  if (t.complete && t.needsDecision) note = '<p class="group-note warn">Level on the qualifying places. The organizer decides who goes through.</p>';
  else if (t.complete) {
    const w = esc(t.rows[0].team.name);
    if (c.format === 'final2') note = `<p class="group-note">${w} and ${esc(t.rows[1].team.name)} play the final.</p>`;
    else note = `<p class="group-note">${w} and ${esc(t.rows[1].team.name)} go through to the quarter-finals.</p>`;
  }
  const single = Object.keys(c.teamsByGroup).length === 1;
  // Q appears as soon as the group has a result; it is outlined until the group is complete.
  const showQ = t.played > 0 && !t.needsDecision;
  return `<article class="group-card group-${letter.toLowerCase()}">
    <header><h3 aria-label="${single ? 'Group' : `Group ${letter}`}"><span class="g-word" aria-hidden="true">Group</span><span class="g-badge" aria-hidden="true">${letter}</span></h3><span class="g-count">${t.played} of ${t.total} played</span></header>
    <table class="table group-table">
      <thead><tr><th scope="col"><span class="sr-only">Position</span></th><th scope="col">Team</th><th scope="col"><span class="sr-only">Journey</span></th><th scope="col" title="Played">P</th><th scope="col" title="Won">W</th><th scope="col" title="Lost">L</th><th scope="col" title="Point difference">+/−</th></tr></thead>
      <tbody>${t.rows.map((r, i) => {
        const open = expanded.has(r.team.id);
        const q = showQ && i < through;
        const cls = ['team-row', i % 2 ? 'row-alt' : '', q ? 'is-through' : '', q && t.complete ? 'is-confirmed' : ''].filter(Boolean).join(' ');
        return `<tr class="${cls}">
        <td>${r.rank}</td>
        <td class="t-team"><button type="button" class="team-toggle" data-expand="${r.team.id}" aria-expanded="${open}" aria-controls="fx-${r.team.id}">
          <span class="tt-name">${esc(r.team.name)}</span>${q ? `<span class="q-badge${t.complete ? ' is-confirmed' : ''}" title="${t.complete ? 'Qualified' : 'In a qualifying place'}">Q</span>` : ''}<svg class="chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button></td>
        <td class="t-journey"><button type="button" class="journey-btn" data-journey="${r.team.id}" aria-label="${esc(r.team.name)}: all matches and results" title="All matches and results"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="6" cy="19" r="2.6" fill="currentColor"/><path d="M8.6 19h8.4a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.1 3.4"/><path d="M15 2.5v6M15 2.5h5l-1.4 1.6L20 5.7h-5" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg></button></td>
        <td>${r.played}</td><td><strong>${r.won}</strong></td><td>${r.lost}</td><td>${r.pd > 0 ? '+' : ''}${r.pd}</td>
      </tr><tr class="team-fixtures${open ? ' is-open' : ''}${i % 2 ? ' row-alt' : ''}" id="fx-${r.team.id}"><td colspan="7">${teamFixtures(r.team.id, matches, states)}</td></tr>`;
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
    return `<li><a href="${matchHref(m.id)}"><span class="fx-when">Match ${m.no ?? m.round}${s.court ? `, court ${s.court}` : ''}</span><span class="fx-opp"><span class="vs">v</span> ${esc(opp.name)}</span>${result}</a></li>`;
  }).join('')}</ul>`;
}

const STAGES = [['quarter', 'Quarter-finals'], ['semi', 'Semi-finals'], ['final', 'Final']];

function knockoutView(states) {
  const cats = ui.cat === 'all' ? T.cats : [category(ui.cat)];
  return cats.map((c) => {
    const ko = T.matches.filter((m) => m.cat === c.code && m.stage !== 'league');
    const f = states[`${c.code}-F`];
    const champ = f.status === 'completed' ? f.winnerTeam : null;
    const cols = STAGES.filter(([stage]) => ko.some((m) => m.stage === stage)).map(([stage, title]) => `<div class="br-col br-${stage}"><h3>${title}</h3>${ko
      .filter((m) => m.stage === stage).sort((x, y) => x.id.localeCompare(y.id)).map((m) => matchCard(states[m.id], { showCategory: false })).join('')}</div>`);
    return `<section class="cat-block">
      <h2 class="cat-block-title">${esc(c.name)}</h2>
      <div class="bracket bracket-${cols.length + 1}">
        ${cols.join('')}
        <div class="br-col br-champ"><h3>Champions</h3>${champ ? `<div class="champ is-set champ-banner"><span class="winner-tag">★ Winner ★</span><span class="cb-crown" aria-hidden="true">👑</span><span class="cb-label">Champions</span><span class="cb-names">${esc(champ.players[0])}<i>&amp;</i>${esc(champ.players[1])}</span><button type="button" class="btn cb-journey" data-journey="${champ.id}">See their journey</button></div>` : '<div class="champ">Decided in the final</div>'}</div>
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
  if (journeyDialog.open) paintJourney();
}
function update() {
  paintControls();
  syncUrl();
  if (lastStates) render(lastStates);
}
paintControls();
startLoop(render);
