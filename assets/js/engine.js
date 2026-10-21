// Builds the fixture list, court schedule, standings and knockout bracket.
// Match results come from the scorers (published results file plus this device). The seeded
// simulation below is only used by tests and previews (snapshot(..., { simulate: true })).

import { EVENT, CATEGORIES, GROUP_LETTERS, SEMIS, sampleTeams, rng } from './tournament-data.js?v=20261022g';
import { FORMATS, summarize, gameWinner } from './scoring.js?v=20261022g';

const ROUNDS = {
  4: [[[0, 3], [1, 2]], [[0, 2], [1, 3]], [[0, 1], [2, 3]]],
  3: [[[1, 2]], [[0, 2]], [[0, 1]]],
};

let cache = null;

export function tournament() {
  if (cache) return cache;
  const cats = CATEGORIES.map((c) => ({ ...c, teamsByGroup: sampleTeams(c) }));
  const teamIndex = {};
  for (const c of cats) for (const g of Object.values(c.teamsByGroup)) for (const t of g) teamIndex[t.id] = t;

  // League fixtures, ordered by round so every team gets rest between matches.
  const league = [];
  for (let r = 0; r < 3; r++) {
    for (const c of cats) {
      for (const letter of Object.keys(c.teamsByGroup)) {
        const g = c.teamsByGroup[letter];
        for (const [i, j] of ROUNDS[g.length][r]) {
          league.push({ cat: c.code, stage: 'league', group: letter, round: r + 1, a: g[i].id, b: g[j].id });
        }
      }
    }
  }
  const groupCounters = {};
  for (const m of league) {
    const key = `${m.cat}-${m.group}`;
    groupCounters[key] = (groupCounters[key] || 0) + 1;
    m.id = `${key}-${String(groupCounters[key]).padStart(2, '0')}`;
    m.format = FORMATS.league;
  }

  // Court schedule: fill each slot with the next matches whose teams did not play in the previous slot.
  const matches = [];
  const queue = league.slice();
  let slot = 0;
  let prevTeams = new Set();
  while (queue.length) {
    const start = EVENT.dayStart + slot * EVENT.leagueSlot;
    const thisTeams = new Set();
    let court = 1;
    for (let i = 0; i < queue.length && court <= EVENT.courts; ) {
      const m = queue[i];
      const busy = [m.a, m.b].some((t) => prevTeams.has(t) || thisTeams.has(t));
      if (busy) { i++; continue; }
      queue.splice(i, 1);
      Object.assign(m, { court: court++, start, end: start + EVENT.leagueSlot - 2 });
      thisTeams.add(m.a); thisTeams.add(m.b);
      matches.push(m);
    }
    prevTeams = thisTeams;
    slot++;
  }
  const leagueEnd = EVENT.dayStart + slot * EVENT.leagueSlot;

  // Knockout: semi-finals then finals, all on a fixed timetable.
  const ko = [];
  for (const sf of SEMIS) for (const c of cats) ko.push({ id: `${c.code}-${sf.id}`, cat: c.code, stage: 'semi', label: sf.id === 'SF1' ? 'Semi-final 1' : 'Semi-final 2', from: [`${sf.a}1`, `${sf.b}1`] });
  let k = 0;
  for (const m of ko) {
    const s = Math.floor(k / EVENT.courts);
    const start = leagueEnd + 10 + s * EVENT.knockoutSlot;
    Object.assign(m, { court: (k % EVENT.courts) + 1, start, end: start + EVENT.knockoutSlot - 2, format: FORMATS.knockout });
    k++;
  }
  const semisEnd = leagueEnd + 10 + Math.ceil(ko.length / EVENT.courts) * EVENT.knockoutSlot;
  cats.forEach((c, i) => {
    const start = semisEnd + 10;
    ko.push({ id: `${c.code}-F`, cat: c.code, stage: 'final', label: 'Final', from: ['SF1', 'SF2'], court: i + 1, start, end: start + EVENT.knockoutSlot - 2, format: FORMATS.knockout });
  });
  matches.push(...ko);
  matches.sort((x, y) => x.start - y.start || x.court - y.court);

  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
  cache = { cats, matches, byId, teamIndex, leagueEnd, finalsStart: semisEnd + 10 };
  return cache;
}

export function category(code) {
  return tournament().cats.find((c) => c.code === code);
}

/** The full rally sequence a simulated match will follow, once its teams are known. */
function sequenceFor(m, a, b) {
  const key = `${m.id}:${a.id}:${b.id}`;
  m._seq ??= {};
  if (m._seq[key]) return m._seq[key];
  const rand = rng(key);
  const p = 0.5 + (a.rating - b.rating) * 0.32;
  const sides = [];
  let x = 0;
  let y = 0;
  while (!gameWinner(x, y, m.format)) {
    if (rand() < p) { sides.push('A'); x++; } else { sides.push('B'); y++; }
  }
  m._seq[key] = sides;
  return sides;
}

/**
 * State of every match at time `t` (minutes from midnight on the tournament day).
 * `overrides` maps matchId -> { sides, confirmed } (or a plain sides list) entered by a scorer.
 * With `simulate`, matches without scores follow a generated result (used by tests and previews);
 * otherwise a match is upcoming until a scorer starts it.
 */
export function snapshot(t, overrides = {}, { simulate = false } = {}) {
  const T = tournament();
  const states = {};
  const resolveSlot = (m, ref) => {
    if (m.stage === 'semi') {
      const g = ref[0];
      const table = standings(m.cat, g, states);
      return table.complete ? T.teamIndex[table.rows[0].team.id] : null;
    }
    const sfState = states[`${m.cat}-${ref}`];
    return sfState && sfState.status === 'completed' ? sfState.winnerTeam : null;
  };

  for (const m of T.matches) {
    const a = m.stage === 'league' ? T.teamIndex[m.a] : resolveSlot(m, m.from[0]);
    const b = m.stage === 'league' ? T.teamIndex[m.b] : resolveSlot(m, m.from[1]);
    const st = { match: m, a, b, status: 'upcoming', score: summarize([], m.format, EVENT.firstServer) };
    const ov = overrides[m.id];
    if (ov && a && b) {
      const sides = Array.isArray(ov) ? ov : ov.sides;
      st.score = summarize(sides, m.format, EVENT.firstServer);
      st.status = st.score.winner ? 'completed' : 'live';
      st.confirmed = !Array.isArray(ov) && !!ov.confirmed;
    } else if (!simulate) {
      st.status = a && b ? 'upcoming' : 'waiting';
    } else if (a && b && t >= m.start) {
      const seq = sequenceFor(m, a, b);
      if (t >= m.end) {
        st.status = 'completed';
        st.score = summarize(seq, m.format, EVENT.firstServer);
      } else {
        st.status = 'live';
        const n = Math.min(seq.length - 1, Math.floor(((t - m.start) / (m.end - m.start)) * seq.length));
        st.score = summarize(seq.slice(0, n), m.format, EVENT.firstServer);
      }
    } else if (t >= m.start && (!a || !b)) {
      st.status = 'waiting'; // its slot has arrived but the teams are not decided yet
    }
    if (st.status === 'completed' && st.score.winner) st.winnerTeam = st.score.winner === 'A' ? a : b;
    states[m.id] = st;
  }
  return states;
}

/**
 * Group table. Order: matches won, then head-to-head (two-way ties), then point difference,
 * then points scored. Anything still level is flagged for the organizer to decide.
 */
export function standings(catCode, letter, states) {
  const cat = category(catCode);
  const teams = cat.teamsByGroup[letter];
  const rows = teams.map((team) => ({ team, played: 0, won: 0, lost: 0, pf: 0, pa: 0 }));
  const row = (id) => rows.find((r) => r.team.id === id);
  const groupMatches = tournament().matches.filter((m) => m.cat === catCode && m.stage === 'league' && m.group === letter);
  let done = 0;
  for (const m of groupMatches) {
    const s = states[m.id];
    if (!s || s.status !== 'completed') continue;
    done++;
    const ra = row(m.a);
    const rb = row(m.b);
    ra.played++; rb.played++;
    ra.pf += s.score.a; ra.pa += s.score.b;
    rb.pf += s.score.b; rb.pa += s.score.a;
    if (s.score.winner === 'A') { ra.won++; rb.lost++; } else { rb.won++; ra.lost++; }
  }
  const h2h = (x, y) => {
    const m = groupMatches.find((g) => (g.a === x && g.b === y) || (g.a === y && g.b === x));
    const s = m && states[m.id];
    if (!s || s.status !== 'completed') return 0;
    const winnerId = s.score.winner === 'A' ? m.a : m.b;
    return winnerId === x ? -1 : 1;
  };
  rows.forEach((r) => (r.pd = r.pf - r.pa));
  rows.sort((x, y) => y.won - x.won || y.pd - x.pd || y.pf - x.pf);
  // Re-apply head-to-head inside two-way ties on wins.
  for (let i = 0; i < rows.length - 1; i++) {
    const sameWins = rows.filter((r) => r.won === rows[i].won);
    if (sameWins.length === 2 && rows[i + 1].won === rows[i].won) {
      if (h2h(rows[i].team.id, rows[i + 1].team.id) > 0) [rows[i], rows[i + 1]] = [rows[i + 1], rows[i]];
      i++;
    }
  }
  rows.forEach((r, i) => {
    const next = rows[i + 1];
    r.rank = i + 1;
    r.tiedWithNext = !!next && next.won === r.won && next.pd === r.pd && next.pf === r.pf && rows.filter((q) => q.won === r.won).length > 2;
  });
  const complete = done === groupMatches.length;
  return { letter, rows, complete, played: done, total: groupMatches.length, needsDecision: complete && rows[0].tiedWithNext };
}
