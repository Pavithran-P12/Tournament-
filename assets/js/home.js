import { EVENT } from './tournament-data.js?v=20261024l';
import { tournament, standings } from './engine.js?v=20261024l';
import { mountDrawNotice, startLoop, markActiveNav, paintLiveCount, fmtTime, esc, matchHref } from './ui.js?v=20261024l';
import { matchCard, emptyState } from './components.js?v=20261024l';

const $ = (s) => document.querySelector(s);
const T = tournament();

// Static content
$('[data-rules]').innerHTML = EVENT.rules.map((r) => `<li>${esc(r)}</li>`).join('');
$('[data-includes]').innerHTML = EVENT.includes.map((i) => `<li><strong>${esc(i.title)}</strong><span>${esc(i.detail)}</span></li>`).join('');
const finals = T.matches.filter((m) => m.stage === 'final').sort((x, y) => x.start - y.start);
const finalTimes = [...new Set(finals.map((m) => m.start))].map((start) => {
  const names = finals.filter((m) => m.start === start).map((m) => T.cats.find((c) => c.code === m.cat).short);
  return `${names.join(' and ')} at ${fmtTime(start)}`;
});
const range = (codes) => {
  const ms = T.matches.filter((m) => m.stage === 'league' && codes.includes(m.cat));
  return `${fmtTime(Math.min(...ms.map((m) => m.start)))} to ${fmtTime(Math.max(...ms.map((m) => m.end)))}`;
};
$('[data-timeline]').innerHTML = [
  ['Beginner league', range(['BMD', 'BWD']), "Beginner Men's and Beginner Women's group matches."],
  ['Intermediate league', range(['IMD', 'IXD']), "Intermediate Men's and Intermediate Mixed group matches."],
  ['Quarter-finals', `From ${fmtTime(T.stageStarts.quarter)}`, "Men's and Mixed: the top two of each group. A1 v B2, C1 v D2, B1 v A2, D1 v C2."],
  ['Semi-finals', `From ${fmtTime(T.stageStarts.semi)}`, 'Winners of quarter-finals 1 and 2 meet, and winners of 3 and 4.'],
  ['Finals', `From ${fmtTime(T.stageStarts.final)}`, `${finalTimes.join('. ')}. Trophies for the winner and runner-up in each category.`],
].map(([t, when, what]) => `<li><span class="tl-when">${when}</span><strong>${t}</strong><span>${what}</span></li>`).join('');

mountDrawNotice();
markActiveNav();

startLoop((states, clock) => {
  paintLiveCount(states);
  const all = Object.values(states);
  const live = all.filter((s) => s.status === 'live').sort((a, b) => a.match.court - b.match.court);
  const played = all.filter((s) => s.status === 'completed').length;

  let status;
  if (played === all.length) status = 'All matches played. See the results for every category.';
  else if (played || live.length) status = `${played} of ${all.length} matches played. ${live.length} on court now.`;
  else if (clock.phase === 'before') status = `${all.length} matches across ${EVENT.courts} courts on Sunday 25 October. First serve at ${fmtTime(EVENT.dayStart)}.`;
  else status = `First serve at ${fmtTime(EVENT.dayStart)}. ${all.length} matches across ${EVENT.courts} courts.`;
  $('[data-day-status]').textContent = status;
  const heroLive = $('[data-hero-live]');
  heroLive.textContent = live.length ? `Watch ${live.length} live ${live.length === 1 ? 'match' : 'matches'}` : 'Watch live scores';

  $('[data-live-grid]').innerHTML = live.length
    ? live.map((s) => matchCard(s)).join('')
    : emptyState(played === all.length ? 'Play has finished for the day.' : 'No matches on court right now.');

  const upcoming = all.filter((s) => s.status === 'upcoming' || s.status === 'waiting').sort((a, b) => a.match.start - b.match.start || a.match.court - b.match.court).slice(0, 6);
  $('[data-next-list]').innerHTML = upcoming.length
    ? upcoming.map((s) => `<li><a href="${matchHref(s.match.id)}"><span class="nl-time">${fmtTime(s.match.start)}</span><span class="nl-court">Court ${s.match.court}</span><span class="nl-teams">${esc(s.a?.name ?? 'To be decided')} <span class="vs">v</span> ${esc(s.b?.name ?? 'To be decided')}</span></a></li>`).join('')
    : '<li class="empty">Nothing left to schedule.</li>';

  $('[data-cat-grid]').innerHTML = T.cats.map((c) => {
    const teams = Object.values(c.teamsByGroup).flat().length;
    const final = states[`${c.code}-F`];
    const groupCount = Object.keys(c.teamsByGroup).length;
    const groupsDone = Object.keys(c.teamsByGroup).filter((g) => standings(c.code, g, states).complete).length;
    let progress;
    if (final.status === 'completed') progress = `<span class="cat-champ">Champions: ${esc(final.winnerTeam.name)}</span>`;
    else if (final.status === 'live') progress = '<span class="cat-live">Final in progress</span>';
    else progress = `<span>${groupsDone} of ${groupCount} ${groupCount === 1 ? 'group' : 'groups'} complete</span>`;
    return `<a class="cat-card" href="matches.html?cat=${c.code}">
      <span class="cat-level cat-level-${c.level.toLowerCase()}">${c.level}</span>
      <strong class="cat-name">${esc(c.name.replace(`${c.level} `, ''))}</strong>
      <span class="cat-meta">${teams} teams in ${Object.keys(c.teamsByGroup).length} ${Object.keys(c.teamsByGroup).length === 1 ? 'group' : 'groups'}</span>
      <span class="cat-progress">${progress}</span>
    </a>`;
  }).join('');
});
