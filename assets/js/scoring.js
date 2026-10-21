// Badminton scoring rules for a single-game match with rally scoring.
// Pure functions only: no DOM, no storage. Used by the pages and by tests/,
// and later mirrored by the server-side scoring function.

export const FORMATS = {
  league: { key: 'league', label: 'League', target: 15, cap: 21 },
  knockout: { key: 'knockout', label: 'Knockout', target: 21, cap: 30 },
};

export function describeFormat(f) {
  return `Single game to ${f.target}, win by 2, capped at ${f.cap}`;
}

/** Returns 'A', 'B' or null for a given score under a format. */
export function gameWinner(a, b, f) {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (a === b) return null;
  if (hi >= f.cap) return a > b ? 'A' : 'B';
  if (hi >= f.target && hi - lo >= 2) return a > b ? 'A' : 'B';
  return null;
}

/** True if a score can legally exist under the format (used to validate corrections). */
export function isValidScore(a, b, f) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  if (Math.max(a, b) > f.cap) return false;
  // A score is valid if the game was still open one rally before it.
  if (a === 0 && b === 0) return true;
  const prevs = [];
  if (a > 0) prevs.push([a - 1, b]);
  if (b > 0) prevs.push([a, b - 1]);
  return prevs.some(([pa, pb]) => gameWinner(pa, pb, f) === null && isValidScore(pa, pb, f));
}

/**
 * Rebuilds match state from an append-only event log.
 * Events: { id, type: 'point', side: 'A'|'B' } | { id, type: 'undo' }
 * An undo cancels the most recent point that is still in effect; nothing is deleted.
 */
export function replay(events, f, firstServer = 'A') {
  const rallies = []; // { side, eventId }
  for (const ev of events) {
    if (ev.type === 'point') {
      const { a, b } = count(rallies);
      if (gameWinner(a, b, f)) throw new Error(`Event ${ev.id}: game already finished`);
      if (ev.side !== 'A' && ev.side !== 'B') throw new Error(`Event ${ev.id}: bad side`);
      rallies.push({ side: ev.side, eventId: ev.id });
    } else if (ev.type === 'undo') {
      if (rallies.length === 0) throw new Error(`Event ${ev.id}: nothing to undo`);
      rallies.pop();
    } else {
      throw new Error(`Unknown event type ${ev.type}`);
    }
  }
  return summarize(rallies.map((r) => r.side), f, firstServer);
}

function count(rallies) {
  let a = 0;
  let b = 0;
  for (const r of rallies) (r.side ?? r) === 'A' ? a++ : b++;
  return { a, b };
}

/** State summary from a list of rally winners ['A','B',...]. */
export function summarize(sides, f, firstServer = 'A') {
  const { a, b } = count(sides);
  const winner = gameWinner(a, b, f);
  const server = sides.length ? sides[sides.length - 1] : firstServer;
  const serverScore = server === 'A' ? a : b;
  return {
    a,
    b,
    rallies: sides.slice(),
    winner,
    server: winner ? null : server,
    // In doubles the server serves from the right court on an even score, left on odd.
    serviceCourt: winner ? null : serverScore % 2 === 0 ? 'right' : 'left',
    gamePoint: winner ? null : pointFor(a, b, f),
    deuce: !winner && a === b && a >= f.target - 1,
  };
}

/** Which side is one rally from winning (single game, so this is also match point). */
function pointFor(a, b, f) {
  if (gameWinner(a + 1, b, f)) return 'A';
  if (gameWinner(a, b + 1, f)) return 'B';
  return null;
}

/**
 * Applies a scorer action with duplicate protection.
 * `seen` is a Set of event ids already applied; a repeated id is ignored, not double-counted.
 * Returns { events, applied }.
 */
export function applyEvent(events, ev, f, seen) {
  if (seen.has(ev.id)) return { events, applied: false };
  const next = [...events, ev];
  replay(next, f); // throws if the action is not allowed
  seen.add(ev.id);
  return { events: next, applied: true };
}
