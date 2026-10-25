// Badminton scoring rules with rally scoring and a golden point (no deuce).
// League: single game to 15. At 14-14 the next rally wins the game.
// Quarter-finals: single game to 15 (golden point at 14-14). Semi-finals and finals: single game to 21. At 20-20 the next rally wins the game.
// Pure functions only: no DOM, no storage. Used by the pages and by tests/.

export const FORMATS = {
  league: { key: 'league', label: 'League', target: 15, bestOf: 1 },
  quarter: { key: 'quarter', label: 'Quarter-final', target: 15, bestOf: 1 },
  knockout: { key: 'knockout', label: 'Knockout', target: 21, bestOf: 1 },
};

export function describeFormat(f) {
  const games = f.bestOf > 1 ? `Best of ${f.bestOf} games to ${f.target}` : `Single game to ${f.target}`;
  return `${games}, golden point at ${f.target - 1}–${f.target - 1}`;
}

/** Winner of one game: first to the target. With a golden point there is no win-by-two. */
export function gameWinner(a, b, f) {
  if (a >= f.target && a > b) return 'A';
  if (b >= f.target && b > a) return 'B';
  return null;
}

/** True if a single game score can exist under the format. */
export function isValidScore(a, b, f) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  if (a > f.target || b > f.target) return false;
  return !(a === f.target && b === f.target);
}

const gamesToWin = (f) => Math.floor(f.bestOf / 2) + 1;

/**
 * Match state from the list of rally winners ['A','B',...] across all games.
 * a / b are the points in the current game (or the last game once the match is over).
 */
export function summarize(sides, f, firstServer = 'A') {
  const games = [];
  let cur = { a: 0, b: 0, winner: null };
  const won = { A: 0, B: 0 };
  let matchWinner = null;
  for (const side of sides) {
    if (matchWinner) break;
    side === 'A' ? cur.a++ : cur.b++;
    const w = gameWinner(cur.a, cur.b, f);
    if (w) {
      cur.winner = w;
      games.push(cur);
      won[w]++;
      if (won[w] >= gamesToWin(f)) matchWinner = w;
      else cur = { a: 0, b: 0, winner: null };
    }
  }
  const inPlay = !matchWinner;
  if (inPlay) games.push(cur); // the game in progress (0–0 right after a game ends)
  const current = games[games.length - 1];
  // The rally winner serves next; a new game is served by the winner of the last one.
  const server = sides.length ? sides[sides.length - 1] : firstServer;
  const serverScore = server === 'A' ? current.a : current.b;
  const pointFor = () => {
    if (!inPlay) return null;
    if (gameWinner(current.a + 1, current.b, f)) return 'A';
    if (gameWinner(current.a, current.b + 1, f)) return 'B';
    return null;
  };
  const gp = pointFor();
  return {
    a: current.a,
    b: current.b,
    games, // [{ a, b, winner }]
    gamesWon: won,
    gameNumber: games.length,
    rallies: sides.slice(),
    winner: matchWinner,
    server: inPlay ? server : null,
    // In doubles the server serves from the right court on an even score, left on odd.
    serviceCourt: inPlay ? (serverScore % 2 === 0 ? 'right' : 'left') : null,
    gamePoint: gp,
    matchPoint: gp && won[gp] + 1 >= gamesToWin(f) ? gp : null,
    goldenPoint: inPlay && current.a === f.target - 1 && current.b === f.target - 1,
  };
}

/**
 * Rebuilds match state from an append-only event log.
 * Events: { id, type: 'point', side: 'A'|'B' } | { id, type: 'undo' }
 * An undo cancels the most recent point that is still in effect; nothing is deleted.
 */
export function replay(events, f, firstServer = 'A') {
  const sides = [];
  for (const ev of events) {
    if (ev.type === 'point') {
      if (ev.side !== 'A' && ev.side !== 'B') throw new Error(`Event ${ev.id}: bad side`);
      if (summarize(sides, f, firstServer).winner) throw new Error(`Event ${ev.id}: match already finished`);
      sides.push(ev.side);
    } else if (ev.type === 'undo') {
      if (sides.length === 0) throw new Error(`Event ${ev.id}: nothing to undo`);
      sides.pop();
    } else {
      throw new Error(`Unknown event type ${ev.type}`);
    }
  }
  return summarize(sides, f, firstServer);
}

/**
 * Applies a scorer action with duplicate protection.
 * `seen` is a Set of event ids already applied; a repeated id is ignored, not double-counted.
 */
export function applyEvent(events, ev, f, seen) {
  if (seen.has(ev.id)) return { events, applied: false };
  const next = [...events, ev];
  replay(next, f);
  seen.add(ev.id);
  return { events: next, applied: true };
}

/** "21–18, 17–21, 21–15" from side A's point of view. */
export function gameScores(score) {
  return score.games.filter((g) => g.a || g.b).map((g) => `${g.a}–${g.b}`).join(', ');
}
