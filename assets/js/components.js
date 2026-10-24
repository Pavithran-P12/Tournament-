import { esc, fmtTime, matchHref, stageLabel, statusPill, teamLabel, matchCode } from './ui.js?v=20261025f';
import { category } from './engine.js?v=20261025f';
import { gameScores } from './scoring.js?v=20261025f';

/** Compact match card used on the home page and in the match center. */
export function matchCard(st, { showCategory = true } = {}) {
  const m = st.match;
  const cat = category(m.cat);
  const league = m.stage === 'league';
  // Knockout rows take the colour of the group each team came from (or will come from).
  const groupOf = (side) => {
    const team = side === 'A' ? st.a : st.b;
    if (team) return team.group;
    return m.from?.[side === 'A' ? 0 : 1]?.g ?? null;
  };
  const single = Object.keys(cat.groups).length === 1;
  const row = (side) => {
    const team = side === 'A' ? st.a : st.b;
    const g = league ? null : groupOf(side);
    const score = side === 'A' ? st.score.a : st.score.b;
    const serving = st.status === 'live' && st.score.server === side;
    const won = st.score.winner === side;
    const lost = st.score.winner && !won;
    const showScore = st.status === 'live' || st.status === 'completed';
    // Best-of-3: games won once finished, current game points while live.
    const multi = m.format.bestOf > 1;
    const big = multi && st.status === 'completed' ? st.score.gamesWon[side] : score;
    return `<div class="mrow${won ? ' is-won' : ''}${lost ? ' is-lost' : ''}${team ? '' : ' is-tbd'}${g ? ` has-group group-${g.toLowerCase()}${single ? '' : ' has-chip'}` : ''}">
      <span class="mrow-team">${g && !single ? `<b class="g-chip" title="From group ${g}">${g}</b>` : ''}${esc(teamLabel(st, side))}${won ? '<span class="w-badge" title="Winner">W</span>' : ''}${serving ? '<span class="serve-dot" title="Serving"><span class="sr-only">serving</span></span>' : ''}</span>
      <span class="mrow-score">${showScore ? big : ''}</span>
    </div>`;
  };
  const groupClass = league ? ` mcard-league group-${m.group.toLowerCase()}` : ' mcard-ko';
  return `<a class="mcard mcard-${st.status}${groupClass}" href="${matchHref(m.id)}" data-score="${st.score.a}-${st.score.b}">
    <div class="mcard-meta">
      <span class="court-ball${matchCode(m).length > 2 ? ' is-wide' : ''}" title="${m.stage === 'league' ? `Match ${matchCode(m)}` : esc(m.label)}"><span class="sr-only">Match </span>${matchCode(m)}</span>
      <span class="mcard-info">
        ${showCategory ? `<span class="mcard-cat"><span class="lvl lvl-${cat.level.toLowerCase()}">${esc(cat.level)}</span>${esc(cat.name.replace(`${cat.level} `, '').replace(' Doubles', ''))}</span>` : ''}
        <span class="mcard-stage">${league ? `${single ? '' : `<b class="g-chip" title="Group ${m.group}">${m.group}</b>`}${single ? '' : `Group ${m.group}`}${st.court ? `${single ? '' : ' · '}Court ${st.court}` : ''}` : esc(showCategory ? stageLabel(m) : m.label.replace('Quarter-final', 'QF').replace('Semi-final', 'SF'))}${!league && st.court ? ` · Court ${st.court}` : ''}</span>
      </span>
      ${statusPill(st)}
    </div>
    ${row('A')}${row('B')}
    ${gamesLine(st)}
  </a>`;
}

function gamesLine(st) {
  const s = st.score;
  if (st.match.format.bestOf < 2 || (st.status !== 'live' && st.status !== 'completed')) return '';
  if (st.status === 'completed') return `<p class="mcard-games">Games ${esc(gameScores(s))}</p>`;
  const done = s.games.slice(0, -1).map((g) => `${g.a}–${g.b}`).join(', ');
  return `<p class="mcard-games">Game ${s.gameNumber}${done ? `. Earlier: ${esc(done)}` : ''}</p>`;
}

/** One slim row for the schedule list: number, group, both teams, score or status. */
export function matchRow(st) {
  const m = st.match;
  const cat = category(m.cat);
  const single = Object.keys(cat.groups).length === 1;
  const league = m.stage === 'league';
  const g = league ? m.group : null;
  const team = (side) => {
    const won = st.status === 'completed' && st.score.winner === side;
    const lost = st.status === 'completed' && st.score.winner && !won;
    const from = !league ? (side === 'A' ? st.a : st.b)?.group ?? m.from?.[side === 'A' ? 0 : 1]?.g : null;
    const tbd = !(side === 'A' ? st.a : st.b);
    return `<span class="mr-team${won ? ' is-won' : ''}${lost ? ' is-lost' : ''}${tbd ? ' is-tbd' : ''}">${from && !single ? `<b class="g-chip group-${from.toLowerCase()}">${from}</b>` : ''}${esc(teamLabel(st, side))}${won ? '<span class="w-badge" title="Winner">W</span>' : ''}</span>`;
  };
  const multi = m.format.bestOf > 1;
  let res = '';
  if (st.status === 'completed') res = `<span class="mr-score">${multi ? `${st.score.gamesWon.A}–${st.score.gamesWon.B}` : `${st.score.a}–${st.score.b}`}</span>`;
  else if (st.status === 'live') res = `<span class="mr-score is-live">${st.score.a}–${st.score.b}</span><span class="mr-tag mr-live">Live</span>`;
  else if (st.status === 'waiting') res = '<span class="mr-tag">TBD</span>';
  else res = '<span class="mr-tag">Upcoming</span>';
  const code = league ? (m.no ?? m.round) : m.id.split('-').pop();
  return `<a class="mrow-c mr-${st.status}${g ? ` group-${g.toLowerCase()}` : ' mr-ko'}" href="${matchHref(m.id)}">
    <span class="mr-no${String(code).length > 2 ? ' is-wide' : ''}" title="${league ? `Match ${code}` : esc(m.label)}">${code}</span>
    ${g && !single ? `<b class="g-chip mr-g" title="Group ${g}">${g}</b>` : '<span class="mr-g"></span>'}
    <span class="mr-teams">${team('A')}<span class="vs">v</span>${team('B')}</span>
    <span class="mr-res">${res}${st.court ? `<span class="mr-court">Court ${st.court}</span>` : ''}</span>
  </a>`;
}

export function emptyState(text) {
  return `<p class="empty">${esc(text)}</p>`;
}

export function slotHeading(min) {
  return fmtTime(min);
}
