import { esc, fmtTime, matchHref, stageLabel, statusPill, teamLabel } from './ui.js';
import { category } from './engine.js';

/** Compact match card used on the home page and in the match center. */
export function matchCard(st, { showCategory = true } = {}) {
  const m = st.match;
  const cat = category(m.cat);
  const row = (side) => {
    const team = side === 'A' ? st.a : st.b;
    const score = side === 'A' ? st.score.a : st.score.b;
    const serving = st.status === 'live' && st.score.server === side;
    const won = st.score.winner === side;
    const lost = st.score.winner && !won;
    const showScore = st.status === 'live' || st.status === 'completed';
    return `<div class="mrow${won ? ' is-won' : ''}${lost ? ' is-lost' : ''}${team ? '' : ' is-tbd'}">
      <span class="mrow-team">${esc(teamLabel(st, side))}${serving ? '<span class="serve-dot" title="Serving"><span class="sr-only">serving</span></span>' : ''}</span>
      <span class="mrow-score">${showScore ? score : ''}</span>
    </div>`;
  };
  return `<a class="mcard mcard-${st.status}" href="${matchHref(m.id)}" data-score="${st.score.a}-${st.score.b}">
    <div class="mcard-meta">
      <span class="mcard-court">Court ${m.court}</span>
      <span class="mcard-stage">${showCategory ? `${esc(cat.short)}, ` : ''}${esc(stageLabel(m))}</span>
      ${statusPill(st)}
    </div>
    ${row('A')}${row('B')}
  </a>`;
}

export function emptyState(text) {
  return `<p class="empty">${esc(text)}</p>`;
}

export function slotHeading(min) {
  return fmtTime(min);
}
