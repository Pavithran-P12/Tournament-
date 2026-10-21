import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tournament, snapshot, standings } from '../assets/js/engine.js';
import { EVENT } from '../assets/js/tournament-data.js';

test('every team plays (group size - 1) league matches', () => {
  const T = tournament();
  for (const c of T.cats) {
    for (const [letter, teams] of Object.entries(c.teamsByGroup)) {
      for (const t of teams) {
        const n = T.matches.filter((m) => m.stage === 'league' && (m.a === t.id || m.b === t.id)).length;
        assert.equal(n, teams.length - 1, `${c.code} ${letter} ${t.name}`);
      }
    }
  }
});

test('no court is double-booked and no team plays twice in one slot', () => {
  const T = tournament();
  const seen = new Set();
  for (const m of T.matches) {
    const key = `${m.start}-${m.court}`;
    assert.ok(!seen.has(key), `court clash ${key}`);
    seen.add(key);
    assert.ok(m.court >= 1 && m.court <= EVENT.courts);
  }
  const slots = {};
  for (const m of T.matches.filter((x) => x.stage === 'league')) {
    slots[m.start] ??= new Set();
    for (const t of [m.a, m.b]) {
      assert.ok(!slots[m.start].has(t), `${t} twice at ${m.start}`);
      slots[m.start].add(t);
    }
  }
});

test('whole day fits between 9 AM and 4 PM', () => {
  const T = tournament();
  const last = Math.max(...T.matches.map((m) => m.end));
  assert.ok(last <= EVENT.dayEnd, `ends at ${last}`);
});

test('before the day nothing is played; after it every match has a winner', () => {
  const before = snapshot(8 * 60, {}, { simulate: true });
  assert.ok(Object.values(before).every((s) => s.status === 'upcoming'));
  const after = snapshot(17 * 60, {}, { simulate: true });
  for (const s of Object.values(after)) {
    assert.equal(s.status, 'completed', s.match.id);
    assert.ok(s.score.winner);
  }
});

test('semi-finals pair A1 v C1 and B1 v D1, and the final pairs the semi winners', () => {
  const after = snapshot(17 * 60, {}, { simulate: true });
  for (const code of ['BMD', 'BWD', 'IMD', 'IXD']) {
    const a1 = standings(code, 'A', after).rows[0].team.id;
    const c1 = standings(code, 'C', after).rows[0].team.id;
    const sf1 = after[`${code}-SF1`];
    assert.deepEqual([sf1.a.id, sf1.b.id], [a1, c1]);
    const f = after[`${code}-F`];
    assert.equal(f.a.id, after[`${code}-SF1`].winnerTeam.id);
    assert.equal(f.b.id, after[`${code}-SF2`].winnerTeam.id);
  }
});

test('3-team groups work and their tables add up', () => {
  const after = snapshot(17 * 60, {}, { simulate: true });
  const t = standings('BWD', 'D', after);
  assert.equal(t.rows.length, 3);
  assert.equal(t.total, 3);
  assert.equal(t.rows.reduce((s, r) => s + r.won, 0), 3);
  assert.equal(t.rows.reduce((s, r) => s + r.pf, 0), t.rows.reduce((s, r) => s + r.pa, 0));
});

test('a scorer override takes priority over the simulation', () => {
  const T = tournament();
  const m = T.matches.find((x) => x.stage === 'league');
  const s = snapshot(8 * 60, { [m.id]: ['A', 'A', 'B'] })[m.id];
  assert.equal(s.status, 'live');
  assert.equal(s.score.a, 2);
});

test('without simulation, unscored matches stay upcoming and scored ones count', () => {
  const T = tournament();
  const m = T.matches.find((x) => x.stage === 'league');
  const win = Array(15).fill('A');
  const s = snapshot(23 * 60, { [m.id]: { sides: win, confirmed: true } });
  assert.equal(s[m.id].status, 'completed');
  assert.equal(s[m.id].confirmed, true);
  const others = Object.values(s).filter((x) => x.match.id !== m.id && x.match.stage === 'league');
  assert.ok(others.every((x) => x.status === 'upcoming'));
  const semis = Object.values(s).filter((x) => x.match.stage !== 'league');
  assert.ok(semis.every((x) => x.status === 'waiting'));
});
