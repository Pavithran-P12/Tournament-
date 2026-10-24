import { EVENT } from './tournament-data.js?v=20261025a';
import { tournament, standings } from './engine.js?v=20261025a';
import { mountDrawNotice, startLoop, markActiveNav, paintLiveCount, fmtTime, esc, matchHref, dayPlanHtml, sessionSpan } from './ui.js?v=20261025a';
import { matchCard, emptyState } from './components.js?v=20261025a';

const $ = (s) => document.querySelector(s);
const T = tournament();

// Static content
$('[data-rules]').innerHTML = EVENT.rules.map((r) => `<li>${esc(r)}</li>`).join('');
$('[data-includes]').innerHTML = EVENT.includes.map((i) => `<li><strong>${esc(i.title)}</strong><span>${esc(i.detail)}</span></li>`).join('');
$('[data-day-plan]').innerHTML = dayPlanHtml();
const sess = Object.fromEntries(EVENT.sessions.map((s) => [s.key, sessionSpan(s)]));
$('[data-timeline]').innerHTML = [
  ['Beginner league', sess.beginner, "Beginner Men's and Beginner Women's league matches."],
  ['Intermediate league', sess.intermediate, "Intermediate Mixed and Intermediate Men's league matches."],
  ['Knockouts', sess.knockout, "Quarter-finals (top two of each group: A1 v B2, C1 v D2, B1 v A2, D1 v C2), then semi-finals and finals. Beginner Women's: 1st v 2nd in the final."],
  ['Reporting', `${EVENT.reportBefore} minutes before your category starts`, `Beginners by ${fmtTime(EVENT.sessions[0].start - EVENT.reportBefore)}, Intermediate by ${fmtTime(EVENT.sessions[1].start - EVENT.reportBefore)}, knockouts by ${fmtTime(EVENT.sessions[2].start - EVENT.reportBefore)}. Not on court within ${EVENT.calledWithin} minutes of being called may mean a walkover.`],
].map(([t, when, what]) => `<li><span class="tl-when">${when}</span><strong>${t}</strong><span>${what}</span></li>`).join('');

mountDrawNotice();
markActiveNav();

startLoop((states, clock) => {
  paintLiveCount(states);
  const all = Object.values(states);
  const live = all.filter((s) => s.status === 'live').sort((a, b) => a.match.cat.localeCompare(b.match.cat) || (a.match.no ?? 0) - (b.match.no ?? 0));
  const played = all.filter((s) => s.status === 'completed').length;

  let status;
  if (played === all.length) status = 'All matches played. See the results for every category.';
  else if (played || live.length) status = `${played} of ${all.length} matches played. ${live.length} on court now.`;
  else status = `${all.length} matches in ${T.cats.length} categories on Sunday 25 October. First serve at ${fmtTime(EVENT.dayStart)}.`;
  $('[data-day-status]').textContent = status;
  const heroLive = $('[data-hero-live]');
  heroLive.textContent = live.length ? `Watch ${live.length} live ${live.length === 1 ? 'match' : 'matches'}` : 'Watch live scores';

  $('[data-live-grid]').innerHTML = live.length
    ? live.map((s) => matchCard(s)).join('')
    : emptyState(played === all.length ? 'Play has finished for the day.' : 'No matches on court right now.');

  // Up next: the next two matches in sheet order for each category.
  const upcoming = T.cats.flatMap((c) => all
    .filter((s) => s.match.cat === c.code && s.status === 'upcoming')
    .sort((x, y) => (x.match.no ?? 99) - (y.match.no ?? 99) || x.match.id.localeCompare(y.match.id))
    .slice(0, 2));
  $('[data-next-list]').innerHTML = upcoming.length
    ? upcoming.map((s) => `<li><a href="${matchHref(s.match.id)}"><span class="nl-time">${s.match.no ? `M${s.match.no}` : esc(s.match.id.split('-').pop())}</span><span class="nl-court">${esc(T.cats.find((c) => c.code === s.match.cat).short)}</span><span class="nl-teams">${esc(s.a?.name ?? 'To be decided')} <span class="vs">v</span> ${esc(s.b?.name ?? 'To be decided')}</span></a></li>`).join('')
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
