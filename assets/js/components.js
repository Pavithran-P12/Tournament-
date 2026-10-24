import { esc, fmtTime, matchHref, stageLabel, statusPill, teamLabel } from './ui.js?v=20261024l';
import { category } from './engine.js?v=20261024l';
import { gameScores } from './scoring.js?v=20261024l';

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
      <span class="court-ball" title="Court ${m.court}"><span class="sr-only">Court </span>${m.court}</span>
      <span class="mcard-info">
        ${showCategory ? `<span class="mcard-cat"><span class="lvl lvl-${cat.level.toLowerCase()}">${esc(cat.level)}</span>${esc(cat.name.replace(`${cat.level} `, '').replace(' Doubles', ''))}</span>` : ''}
        <span class="mcard-stage">${league ? `${single ? '' : `<b class="g-chip" title="Group ${m.group}">${m.group}</b>`}${m.no ? `Match ${m.no}` : `Round ${m.round}`}` : esc(showCategory ? stageLabel(m) : m.label.replace('Quarter-final', 'QF').replace('Semi-final', 'SF'))}</span>
      </span>
      ${statusPill(st)}
    </div>
    ${row('A')}${row('B')}
    ${gamesLine(st)}
    ${st.clash ? `<p class="mcard-games mcard-clash">A player is also in ${esc(category(st.clash.cat).short)} ${esc(st.clash.label.toLowerCase())}. Starts once they are free.</p>` : ''}
  </a>`;
}

function gamesLine(st) {
  const s = st.score;
  if (st.match.format.bestOf < 2 || (st.status !== 'live' && st.status !== 'completed')) return '';
  if (st.status === 'completed') return `<p class="mcard-games">Games ${esc(gameScores(s))}</p>`;
  const done = s.games.slice(0, -1).map((g) => `${g.a}–${g.b}`).join(', ');
  return `<p class="mcard-games">Game ${s.gameNumber}${done ? `. Earlier: ${esc(done)}` : ''}</p>`;
}

export function emptyState(text) {
  return `<p class="empty">${esc(text)}</p>`;
}

export function slotHeading(min) {
  return fmtTime(min);
}
