// Builds the fixture list, court schedule, standings and knockout bracket from tournament-data.js.
// Match results come from the scorers (published results file plus this device). The seeded
// simulation is only used by tests and previews (snapshot(..., { simulate: true })).

import { EVENT, CATEGORIES, TEAMS, SAME_PERSON, rng } from './tournament-data.js?v=20261024l';
import { FORMATS, summarize } from './scoring.js?v=20261024l';

/** Round-robin rounds (circle method). Odd group sizes get a bye each round. */
export function roundRobin(n) {
  const ids = Array.from({ length: n }, (_, i) => i);
  if (n % 2) ids.push(null);
  const m = ids.length;
  const rounds = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs = [];
    for (let i = 0; i < m / 2; i++) {
      const a = ids[i];
      const b = ids[m - 1 - i];
      if (a !== null && b !== null) pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    ids.splice(1, 0, ids.pop()); // rotate all but the first
  }
  return rounds;
}

/** "Nikish Anand Bala Thiruvalluvar" -> "Nikish A.B.T.", "D Britto Baskar" -> "D. Britto B." */
export function shortName(full) {
  const words = full.split(/\s+/).filter(Boolean);
  const core = (w) => w.replace(/\./g, '');
  const isInitials = (w) => core(w).length <= 3 && core(w) === core(w).toUpperCase();
  const gi = words.findIndex((w) => core(w).length > 1 && !isInitials(w));
  if (gi < 0) return full;
  const letters = (ws) => ws.flatMap((w) => (isInitials(w) ? [...core(w)] : [core(w)[0].toUpperCase()]));
  const before = letters(words.slice(0, gi));
  const after = letters(words.slice(gi + 1));
  return `${before.length ? `${before.join('.')}. ` : ''}${words[gi]}${after.length ? ` ${after.join('.')}.` : ''}`;
}

export const personKey = (name) => {
  const k = name.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  return SAME_PERSON[k] ?? k;
};

// Group refs { g, r } are "rank r of group g"; { w } is the winner of an earlier knockout match.
const KO = {
  qf: [
    { id: 'QF1', stage: 'quarter', label: 'Quarter-final 1', from: [{ g: 'A', r: 1 }, { g: 'B', r: 2 }] },
    { id: 'QF2', stage: 'quarter', label: 'Quarter-final 2', from: [{ g: 'C', r: 1 }, { g: 'D', r: 2 }] },
    { id: 'QF3', stage: 'quarter', label: 'Quarter-final 3', from: [{ g: 'B', r: 1 }, { g: 'A', r: 2 }] },
    { id: 'QF4', stage: 'quarter', label: 'Quarter-final 4', from: [{ g: 'D', r: 1 }, { g: 'C', r: 2 }] },
    { id: 'SF1', stage: 'semi', label: 'Semi-final 1', from: [{ w: 'QF1' }, { w: 'QF2' }] },
    { id: 'SF2', stage: 'semi', label: 'Semi-final 2', from: [{ w: 'QF3' }, { w: 'QF4' }] },
    { id: 'F', stage: 'final', label: 'Final', from: [{ w: 'SF1' }, { w: 'SF2' }] },
  ],
  final2: [
    { id: 'F', stage: 'final', label: 'Final', from: [{ g: 'A', r: 1 }, { g: 'A', r: 2 }] },
  ],
};
const STAGE_ORDER = { quarter: 0, semi: 1, final: 2 };

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];
export function refLabel(ref) {
  if (ref.g) return ref.r === 1 ? `Group ${ref.g} winner` : `Group ${ref.g} runner-up`;
  if (ref.q) return ref.q <= 6 ? `${ORDINAL[ref.q]} best group winner` : `${ref.q === 7 ? 'Best' : '2nd best'} runner-up`;
  const n = ref.w.slice(2);
  return ref.w.startsWith('QF') ? `Winner of quarter-final ${n}` : `Winner of semi-final ${n}`;
}

let cache = null;

export function tournament() {
  if (cache) return cache;
  const teamIndex = {};
  const cats = CATEGORIES.map((c) => {
    const teamsByGroup = {};
    for (const [letter, ids] of Object.entries(c.groups)) {
      teamsByGroup[letter] = ids.map((id) => {
        const players = TEAMS[id];
        // name is the short form used in lists; fullName is shown on the match page.
        const team = { id, players, name: `${shortName(players[0])} & ${shortName(players[1])}`, fullName: `${players[0]} & ${players[1]}`, cat: c.code, group: letter, entry: Number(id.slice(-2)), rating: rng(id)() };
        teamIndex[id] = team;
        return team;
      });
    }
    return { ...c, teamsByGroup };
  });
  const people = (teamIds) => teamIds.flatMap((id) => TEAMS[id].map(personKey));

  // League fixtures, ordered round by round so teams get rest between matches.
  const league = [];
  // A group plays full round robin unless the draw fixed its pairings (Beginner Men's groups of 6).
  const roundsFor = (c, letter, g) => c.pairings?.[letter] ?? roundRobin(g.length).map((rd) => rd.map(([i, j]) => [g[i].id, g[j].id]));
  const maxRounds = Math.max(...cats.flatMap((c) => Object.entries(c.teamsByGroup).map(([l, g]) => roundsFor(c, l, g).length)));
  for (let r = 0; r < maxRounds; r++) {
    for (const c of cats) {
      for (const [letter, g] of Object.entries(c.teamsByGroup)) {
        for (const [a, b] of roundsFor(c, letter, g)[r] ?? []) {
          league.push({ cat: c.code, stage: 'league', group: letter, round: r + 1, a, b, format: FORMATS.league });
        }
      }
    }
  }
  // Organizer's match numbers: groups in order, matches in pairings order (Match 1, 2, 3 ...).
  for (const c of cats.filter((x) => x.numbered)) {
    let no = 0;
    for (const letter of Object.keys(c.groups)) {
      for (const [a, b] of c.pairings[letter].flat()) {
        no++;
        league.find((m) => m.cat === c.code && m.a === a && m.b === b).no = no;
      }
    }
  }
  const counters = {};
  for (const m of league) {
    const key = `${m.cat}-${m.group}`;
    counters[key] = (counters[key] || 0) + 1;
    m.id = `${key}-${String(counters[key]).padStart(2, '0')}`;
    m.people = people([m.a, m.b]);
  }

  // Court schedule: each slot takes the next matches whose players are free and did not play in the
  // previous slot. Nobody is ever on two courts at once; rest is only relaxed if nothing else fits.
  // A category's matches never start before its startAt time. Teams with the most matches still to
  // play go first; remaining ties are broken by a fixed seeded shuffle, and the best of a few hundred
  // seeds is kept (earliest finish, then fewest back-to-back matches). Same data, same schedule.
  const startAt = Object.fromEntries(cats.map((c) => [c.code, c.startAt ?? EVENT.dayStart]));
  const planLeague = (seed) => {
    const rand = rng(`league-${seed}`);
    const tie = new Map(league.map((m) => [m, rand()]));
    const queue = league.slice();
    const plan = [];
    let slot = 0;
    let prev = new Set();
    let backToBack = 0;
    while (queue.length) {
      const start = EVENT.dayStart + slot * EVENT.leagueSlot;
      const busy = new Set();
      const placed = [];
      const left = {};
      for (const m of queue) { left[m.a] = (left[m.a] || 0) + 1; left[m.b] = (left[m.b] || 0) + 1; }
      const load = (m) => left[m.a] + left[m.b];
      queue.sort((x, y) => startAt[x.cat] - startAt[y.cat] || x.round - y.round || (x.no ?? 0) - (y.no ?? 0) || load(y) - load(x) || tie.get(x) - tie.get(y));
      // Numbered fixtures keep the organizer's order within a group: Match 10 never starts before Match 9.
      const inOrder = (m) => !m.no || !queue.some((x) => x.cat === m.cat && x.group === m.group && x.no && x.no < m.no);
      const fits = (m, allowBackToBack) => start >= startAt[m.cat] && inOrder(m) && !m.people.some((p) => busy.has(p) || (!allowBackToBack && prev.has(p)));
      const take = (m, allowBackToBack) => {
        queue.splice(queue.indexOf(m), 1);
        m.people.forEach((p) => busy.add(p));
        placed.push(m);
        if (allowBackToBack) backToBack++;
      };
      // Earlier sessions go first, but a category with minCourts keeps that many courts once it has started.
      for (const c of cats.filter((x) => x.minCourts)) {
        for (let k = 0; k < c.minCourts && placed.length < EVENT.courts; k++) {
          const m = queue.find((x) => x.cat === c.code && fits(x, false));
          if (m) take(m, false);
        }
      }
      for (const allowBackToBack of [false, true]) {
        for (let i = 0; i < queue.length && placed.length < EVENT.courts; ) {
          const m = queue[i];
          if (!fits(m, allowBackToBack)) { i++; continue; }
          take(m, allowBackToBack);
        }
        if (placed.length) break;
      }
      placed.forEach((m, k) => plan.push([m, k + 1, start]));
      prev = busy;
      slot++;
    }
    return { plan, slot, backToBack, score: slot * 1000 + backToBack * 10 + Math.max(...plan.filter(([m]) => startAt[m.cat] === EVENT.dayStart).map(([, , t]) => t)) / 100 };
  };
  let bestPlan = null;
  for (let seed = 0; seed < 300; seed++) {
    const p = planLeague(seed);
    if (!bestPlan || p.score < bestPlan.score) bestPlan = p;
  }
  const matches = [];
  for (const [m, court, start] of bestPlan.plan) {
    Object.assign(m, { court, start, end: start + EVENT.leagueSlot - 2 });
    matches.push(m);
  }
  const slot = bestPlan.slot;
  const leagueEnd = EVENT.dayStart + slot * EVENT.leagueSlot;

  // Knockouts. Who could reach each match is known from the draw (the teams of the feeding groups),
  // so two knockout matches only overlap in time when no player could be needed on both courts.
  const groupPeople = (cat, g) => people(cats.find((c) => c.code === cat).groups[g]);
  const koById = {};
  for (const c of cats) {
    for (const k of KO[c.format]) {
      const m = { ...k, id: `${c.code}-${k.id}`, cat: c.code, format: k.stage === 'quarter' ? FORMATS.quarter : FORMATS.knockout };
      m.fromLabels = m.from.map(refLabel);
      m.deps = m.from.filter((ref) => ref.w).map((ref) => `${c.code}-${ref.w}`);
      m.pool = new Set(m.from.flatMap((ref) => (ref.g ? groupPeople(c.code, ref.g) : [...koById[`${c.code}-${ref.w}`].pool])));
      m.length = k.stage === 'quarter' ? EVENT.quarterSlot : EVENT.knockoutSlot;
      koById[m.id] = m;
    }
  }
  // List scheduling from knockoutStart: whenever a court comes free it takes the waiting match with the
  // highest priority whose feeding matches are over. Priorities are seeded shuffles weighted towards
  // long chains (quarter -> semi -> final); the best of a few hundred seeds is kept: earliest finish,
  // then fewest overlaps between matches a player entered in two categories could both reach.
  // Knockouts start at knockoutStart, or after the league with a short break if it runs later.
  const koStart = Math.max(EVENT.knockoutStart, leagueEnd + EVENT.knockoutBreak);
  const all = Object.values(koById);
  const tail = (m) => m.length + Math.max(0, ...all.filter((x) => x.deps.includes(m.id)).map(tail));
  const tails = new Map(all.map((m) => [m, tail(m)]));
  const shares = (m, o) => o.cat !== m.cat && [...m.pool].some((p) => o.pool.has(p));
  const planKo = (seed) => {
    const rand = rng(`knockout-${seed}`);
    const key = new Map(all.map((m) => [m, tails.get(m) + rand() * 48]));
    const avoid = seed % 2 === 0;
    const at = new Map();
    const courtFree = Array(EVENT.courts).fill(koStart);
    const pending = all.slice();
    const readyAt = (m) => Math.max(koStart, ...m.deps.map((d) => at.get(koById[d]).start + koById[d].length + EVENT.knockoutRest));
    const overlapsAt = (m, t) => [...at].some(([o, p]) => p.start < t + m.length && t < p.start + o.length && shares(m, o));
    while (pending.length) {
      const now = Math.min(...courtFree);
      const court = courtFree.indexOf(now);
      const known = pending.filter((m) => m.deps.every((d) => at.has(koById[d])));
      let ready = known.filter((m) => readyAt(m) <= now);
      if (!ready.length) {
        courtFree[court] = Math.min(...courtFree.filter((f) => f > now), ...known.map(readyAt).filter((t) => t > now));
        continue;
      }
      if (avoid && ready.some((m) => !overlapsAt(m, now))) ready = ready.filter((m) => !overlapsAt(m, now));
      const m = ready.sort((x, y) => key.get(y) - key.get(x))[0];
      at.set(m, { court: court + 1, start: now });
      courtFree[court] = now + m.length;
      pending.splice(pending.indexOf(m), 1);
    }
    const end = Math.max(...[...at].map(([m, p]) => p.start + m.length));
    let overlaps = 0;
    const list = [...at];
    for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      const [m, p] = list[x]; const [o, q] = list[y];
      if (p.start < q.start + o.length && q.start < p.start + m.length && shares(m, o)) overlaps++;
    }
    return { at, score: end * 1000 + overlaps };
  };
  let bestKo = null;
  for (let seed = 0; seed < 400; seed++) {
    const p = planKo(seed);
    if (!bestKo || p.score < bestKo.score) bestKo = p;
  }
  for (const [m, p] of bestKo.at) Object.assign(m, { court: p.court, start: p.start, end: p.start + m.length - 2 });
  const ko = Object.values(koById);
  matches.push(...ko);
  matches.sort((x, y) => x.start - y.start || x.court - y.court);

  const stageStart = (stage) => Math.min(...ko.filter((m) => m.stage === stage).map((m) => m.start));
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
  cache = {
    cats, matches, byId, teamIndex, leagueEnd,
    stageStarts: { quarter: stageStart('quarter'), semi: stageStart('semi'), final: stageStart('final') }, // Infinity if a stage is not played
    dayEnds: Math.max(...matches.map((m) => m.end)),
  };
  return cache;
}

export function category(code) {
  return tournament().cats.find((c) => c.code === code);
}

/** The full rally sequence a simulated match would follow (tests and previews only). */
function sequenceFor(m, a, b) {
  const key = `${m.id}:${a.id}:${b.id}`;
  m._seq ??= {};
  if (m._seq[key]) return m._seq[key];
  const rand = rng(key);
  const p = 0.5 + (a.rating - b.rating) * 0.32;
  const sides = [];
  while (!summarize(sides, m.format).winner) sides.push(rand() < p ? 'A' : 'B');
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
  const resolve = (m, ref) => {
    if (ref.g) {
      const table = standings(m.cat, ref.g, states);
      return table.complete ? T.teamIndex[table.rows[ref.r - 1].team.id] : null;
    }
    if (ref.q) {
      const q = qualifiers(m.cat, states);
      return q.complete ? q.seeds[ref.q - 1].team : null;
    }
    const prior = states[`${m.cat}-${ref.w}`];
    return prior && prior.status === 'completed' ? prior.winnerTeam : null;
  };

  for (const m of T.matches) {
    const a = m.stage === 'league' ? T.teamIndex[m.a] : resolve(m, m.from[0]);
    const b = m.stage === 'league' ? T.teamIndex[m.b] : resolve(m, m.from[1]);
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
      st.status = 'waiting';
    }
    if (st.status === 'completed' && st.score.winner) st.winnerTeam = st.score.winner === 'A' ? a : b;
    states[m.id] = st;
  }
  // A player entered in two categories can reach two knockout matches that overlap in the schedule.
  // Once the teams are known, flag the later match: it starts when both matches' players are free.
  const ko = Object.values(states).filter((s) => s.match.stage !== 'league' && s.a && s.b);
  const peopleOf = (s) => [...s.a.players, ...s.b.players].map(personKey);
  for (const s of ko) {
    if (s.status !== 'upcoming') continue;
    const mine = peopleOf(s);
    const other = ko.find((o) => o !== s && o.match.cat !== s.match.cat && o.status !== 'completed'
      && o.match.start <= s.match.start && s.match.start < o.match.end + 2 && peopleOf(o).some((p) => mine.includes(p)));
    if (other) s.clash = other.match;
  }
  return states;
}

const byRecord = (x, y) => y.won - x.won || y.pd - x.pd || y.pf - x.pf;

/**
 * Group table. Order: matches won, then head-to-head (two-way ties), then point difference,
 * then points scored. Anything still level is flagged for the organizer to decide.
 */
export function standings(catCode, letter, states) {
  const cat = category(catCode);
  const teams = cat.teamsByGroup[letter];
  const rows = teams.map((team) => ({ team, group: letter, played: 0, won: 0, lost: 0, pf: 0, pa: 0 }));
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
  rows.sort(byRecord);
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
  const places = 2; // the top two of every group go through
  return {
    letter, rows, complete, played: done, total: groupMatches.length,
    needsDecision: complete && rows.slice(0, places).some((r) => r.tiedWithNext),
  };
}

/**
 * Quarter-final qualifiers for the qf8 format: the six group winners ranked by record, then the
 * two best runners-up. Pairings are 1v8, 4v5, 2v7, 3v6; a runner-up never meets its own group winner.
 */
export function qualifiers(catCode, states) {
  const cat = category(catCode);
  const tables = Object.keys(cat.teamsByGroup).map((g) => standings(catCode, g, states));
  const winners = tables.map((t) => t.rows[0]).sort(byRecord);
  const runnersUp = tables.map((t) => t.rows[1]).sort(byRecord);
  const seeds = [...winners, ...runnersUp.slice(0, 2)];
  // seeds[6] meets seeds[1] (QF3) and seeds[7] meets seeds[0] (QF1).
  if (seeds[7].group === seeds[0].group || seeds[6].group === seeds[1].group) [seeds[6], seeds[7]] = [seeds[7], seeds[6]];
  return { complete: tables.every((t) => t.complete), seeds, runnersUp };
}
