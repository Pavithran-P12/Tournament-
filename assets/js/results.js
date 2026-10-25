// Results page (home): champions, podiums, numbers from the day and every team's journey.
import { tournament } from './engine.js?v=20261025o';
import { startLoop, markActiveNav, esc, matchHref, teamJourney } from './ui.js?v=20261025o';

const $ = (s) => document.querySelector(s);
const T = tournament();
const journeyHref = (team) => `matches.html?cat=${team.cat}&journey=${encodeURIComponent(team.id)}`;
const pair = (team) => `${esc(team.players[0])} <i>&amp;</i> ${esc(team.players[1])}`;
const catTitle = (c) => esc(c.name.replace(`${c.level} `, ''));
const winScore = (st) => `${Math.max(st.score.a, st.score.b)}–${Math.min(st.score.a, st.score.b)}`;

markActiveNav();

function champions(states) {
  return T.cats.map((c) => {
    const f = states[`${c.code}-F`];
    if (f.status !== 'completed') {
      return `<article class="rs-champ is-pending"><p class="rs-cat"><span class="cat-level cat-level-${c.level.toLowerCase()}">${c.level}</span> ${catTitle(c)}</p><p class="rs-wait">Final not played yet</p></article>`;
    }
    const champ = f.winnerTeam;
    const runner = f.score.winner === 'A' ? f.b : f.a;
    const semis = ['SF1', 'SF2'].map((id) => states[`${c.code}-${id}`]).filter((s) => s && s.status === 'completed').map((s) => (s.score.winner === 'A' ? s.b : s.a));
    return `<article class="rs-champ">
      <p class="rs-cat"><span class="cat-level cat-level-${c.level.toLowerCase()}">${c.level}</span> ${catTitle(c)}</p>
      <p class="rs-eyebrow"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 4h10v3a5 5 0 0 1-10 0V4zM5 5H3v1a4 4 0 0 0 4 4M19 5h2v1a4 4 0 0 1-4 4M12 12v4M8 20h8M9 16h6v4H9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>Champions</p>
      <h3 class="rs-names"><span>${esc(champ.players[0])}</span><span class="rs-and">&amp;</span><span>${esc(champ.players[1])}</span></h3>
      <p class="rs-final">Won the final <b>${winScore(f)}</b> against ${esc(runner.name)}</p>
      <dl class="rs-podium">
        <div><dt>Runners-up</dt><dd><a href="${journeyHref(runner)}">${esc(runner.name)}</a></dd></div>
        ${semis.length ? `<div><dt>Semi-finalists</dt><dd>${semis.map((t) => `<a href="${journeyHref(t)}">${esc(t.name)}</a>`).join('<span class="dot"> · </span>')}</dd></div>` : ''}
      </dl>
      <div class="rs-actions">
        <a class="rs-link" href="${journeyHref(champ)}">Their journey <span aria-hidden="true">→</span></a>
        <a class="rs-link" href="${matchHref(f.match.id)}">Final scorecard <span aria-hidden="true">→</span></a>
      </div>
    </article>`;
  }).join('');
}

function numbers(states) {
  const done = Object.values(states).filter((s) => s.status === 'completed');
  let points = 0;
  let golden = 0;
  let shutouts = 0;
  for (const st of done) {
    const t = st.match.format.target;
    for (const g of st.score.games) {
      points += g.a + g.b;
      const lo = Math.min(g.a, g.b);
      if (lo === t - 1) golden++; // decided on the golden point
      if (lo === 0) shutouts++;
    }
  }
  const teams = Object.keys(T.teamIndex).length;
  const stats = [
    [done.length, 'matches played'],
    [teams, 'teams'],
    [points.toLocaleString('en-IN'), 'points won'],
    [golden, 'golden-point finishes'],
    [shutouts, `${shutouts === 1 ? 'game' : 'games'} won to love`],
    [T.cats.length, 'champions crowned'],
  ];
  return stats.map(([n, l]) => `<div><dt>${l}</dt><dd>${n}</dd></div>`).join('');
}

const ORDER = { Champions: 0, 'Runners-up': 1, 'Semi-finalist': 2, 'Quarter-finalist': 3 };
const expandedCats = new Set();
let teamRows = '';
function teams(states) {
  return T.cats.map((c) => {
    const list = Object.values(c.teamsByGroup).flat()
      .map((t) => ({ t, j: teamJourney(t.id, states) }))
      .sort((x, y) => (ORDER[x.j.standing] ?? 9) - (ORDER[y.j.standing] ?? 9) || y.j.won - x.j.won || x.t.name.localeCompare(y.t.name));
    const rest = list.filter(({ j }) => !(j.standing in ORDER && ORDER[j.standing] <= 2)).length;
    return `<section class="rs-teams-cat${expandedCats.has(c.code) ? ' is-open' : ''}" data-cat="${c.code}"><h3>${esc(c.name)}</h3><ul>${list.map(({ t, j }) => `
      <li class="${ORDER[j.standing] <= 2 ? 'is-top' : 'is-rest'}" data-search="${esc(`${t.players.join(' ')} ${c.name}`.toLowerCase())}"><a href="${journeyHref(t)}">
        <span class="rs-t-name">${esc(t.fullName)}</span>
        <span class="rs-t-standing rs-tone-${j.tone}">${esc(j.standing)}</span>
        <span class="rs-t-record">${j.won}W ${j.lost}L</span>
      </a></li>`).join('')}</ul>${rest ? `<button type="button" class="rs-more-btn" data-more="${c.code}" aria-expanded="${expandedCats.has(c.code)}"><span class="when-closed">Show all ${list.length} teams</span><span class="when-open">Show fewer</span></button>` : ''}</section>`;
  }).join('');
}

function applySearch() {
  const q = ($('[data-team-search]').value || '').trim().toLowerCase();
  $('[data-team-list]').classList.toggle('is-searching', !!q); // a search looks through every team
  let shown = 0;
  document.querySelectorAll('[data-team-list] li').forEach((li) => {
    const hit = !q || li.dataset.search.includes(q);
    li.hidden = !hit;
    if (hit) shown++;
  });
  document.querySelectorAll('.rs-teams-cat').forEach((s) => { s.hidden = ![...s.querySelectorAll('li')].some((li) => !li.hidden); });
  $('[data-team-empty]').hidden = shown > 0;
}
$('[data-team-search]').addEventListener('input', applySearch);
$('[data-team-list]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-more]');
  if (!b) return;
  const sec = b.closest('.rs-teams-cat');
  const open = !sec.classList.contains('is-open');
  sec.classList.toggle('is-open', open);
  b.setAttribute('aria-expanded', open);
  if (open) expandedCats.add(b.dataset.more); else expandedCats.delete(b.dataset.more);
});

startLoop((states) => {
  const all = Object.values(states);
  const played = all.filter((s) => s.status === 'completed').length;
  $('[data-results-status]').textContent = played === all.length
    ? `All ${all.length} matches played · ${T.cats.length} champions crowned`
    : `${played} of ${all.length} matches played`;
  $('[data-champions]').innerHTML = champions(states);
  $('[data-numbers]').innerHTML = numbers(states);
  const rows = teams(states);
  if (rows !== teamRows) {
    teamRows = rows;
    $('[data-team-list]').innerHTML = rows;
    applySearch();
  }
});
