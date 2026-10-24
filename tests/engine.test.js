import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tournament, snapshot, standings, roundRobin, personKey } from '../assets/js/engine.js';
import { EVENT, CATEGORIES, TEAMS } from '../assets/js/tournament-data.js';

const DONE = 23 * 60;
const all = () => snapshot(DONE, {}, { simulate: true });

test('round robin gives every pair exactly once', () => {
  for (const n of [3, 4, 5]) {
    const seen = new Set();
    for (const round of roundRobin(n)) {
      const inRound = new Set();
      for (const [a, b] of round) {
        const key = [a, b].sort().join('-');
        assert.ok(!seen.has(key), `pair ${key} twice for n=${n}`);
        seen.add(key);
        assert.ok(!inRound.has(a) && !inRound.has(b), 'team twice in a round');
        inRound.add(a); inRound.add(b);
      }
    }
    assert.equal(seen.size, (n * (n - 1)) / 2);
  }
});

test('the draw uses every entered team exactly once', () => {
  const drawn = CATEGORIES.flatMap((c) => Object.values(c.groups).flat());
  assert.equal(new Set(drawn).size, drawn.length, 'a team is drawn twice');
  assert.deepEqual([...drawn].sort(), Object.keys(TEAMS).sort());
  const count = (code) => CATEGORIES.find((c) => c.code === code);
  assert.deepEqual(Object.values(count('BMD').groups).map((g) => g.length), [6, 6, 6, 6]);
  assert.deepEqual(Object.values(count('IMD').groups).map((g) => g.length), [5, 5, 5, 5]);
  assert.deepEqual(Object.values(count('IXD').groups).map((g) => g.length), [4, 4, 4, 4]);
  assert.deepEqual(Object.values(count('BWD').groups).map((g) => g.length), [5]);
});

test('every team plays everyone in its group once', () => {
  const T = tournament();
  for (const c of T.cats) {
    for (const [letter, teams] of Object.entries(c.teamsByGroup)) {
      const ids = teams.map((t) => t.id);
      for (const t of teams) {
        const mine = T.matches.filter((m) => m.stage === 'league' && (m.a === t.id || m.b === t.id));
        const opponents = mine.map((m) => (m.a === t.id ? m.b : m.a));
        assert.equal(new Set(opponents).size, opponents.length, `${t.name} meets someone twice`);
        assert.ok(opponents.every((o) => ids.includes(o)), `${t.name} plays outside group ${letter}`);
        assert.equal(mine.length, teams.length - 1, t.name);
      }
    }
  }
});

test('no court is double-booked and nobody plays two matches at once', () => {
  const T = tournament();
  const courts = new Set();
  const people = {};
  for (const m of T.matches) {
    const key = `${m.start}-${m.court}`;
    assert.ok(!courts.has(key), `court clash ${key}`);
    courts.add(key);
    assert.ok(m.court >= 1 && m.court <= EVENT.courts);
    if (m.stage !== 'league') continue;
    people[m.start] ??= new Set();
    for (const p of m.people) {
      assert.ok(!people[m.start].has(p), `${p} twice at ${m.start}`);
      people[m.start].add(p);
    }
  }
});

test('players entered in two categories are recognised as one person', () => {
  assert.equal(personKey('Pavan kumar'), personKey('Pavan'));
  assert.equal(personKey('Sathishkumar krishnamoorthy'), personKey('Sathish krishnamoorthy'));
  assert.equal(personKey('Sarvesh S mahalingam'), personKey('Sarvesh Mahalingam'));
  assert.equal(personKey('Praveen kumar ethiendran'), personKey('Praveen kumar Ethiendran'));
  assert.equal(personKey('Gowri arjunan'), personKey('Gowri Arjunan'));
});

test('sessions start on time and knockouts follow the league', () => {
  const T = tournament();
  const league = (codes) => T.matches.filter((m) => m.stage === 'league' && codes.includes(m.cat));
  assert.ok(league(['BMD', 'BWD']).every((m) => m.start >= 9 * 60), 'beginners from 9');
  assert.ok(league(['IMD', 'IXD']).every((m) => m.start >= 10 * 60 + 45), 'intermediate from 10:45');
  assert.equal(Math.min(...league(['IMD']).map((m) => m.start)), 10 * 60 + 48, "Intermediate Men's starts in the first slot after 10:45");
  const ko = T.matches.filter((m) => m.stage !== 'league');
  assert.ok(ko.every((m) => m.start >= Math.max(14 * 60, T.leagueEnd)), 'knockouts after the league, not before 2');
  // each knockout match starts after the matches it depends on have finished
  for (const m of ko) for (const ref of m.from) if (ref.w) assert.ok(T.byId[`${m.cat}-${ref.w}`].end <= m.start, m.id);
});

test("numbered matches never start before a lower-numbered match in the same group", () => {
  const T = tournament();
  const ms = T.matches.filter((m) => m.no);
  for (const m of ms) {
    for (const o of ms) if (o.cat === m.cat && o.group === m.group && o.no < m.no) assert.ok(o.start <= m.start, `${m.cat} match ${m.no} before match ${o.no}`);
  }
});

test("league matches carry the organizer's match numbers", () => {
  const T = tournament();
  const no = (cat, n) => T.matches.find((m) => m.cat === cat && m.no === n);
  assert.deepEqual([no('BMD', 1).a, no('BMD', 1).b], ['BMD-01', 'BMD-06']);
  assert.deepEqual([no('BMD', 23).a, no('BMD', 23).b], ['BMD-11', 'BMD-09']);
  assert.deepEqual([no('BMD', 60).a, no('BMD', 60).b], ['BMD-22', 'BMD-23']);
  assert.deepEqual([no('IMD', 1).a, no('IMD', 1).b], ['IMD-01', 'IMD-02']);
  assert.deepEqual([no('IMD', 40).a, no('IMD', 40).b], ['IMD-19', 'IMD-20']);
  assert.equal(T.matches.filter((m) => m.cat === 'BMD' && m.no).length, 60);
  assert.equal(T.matches.filter((m) => m.cat === 'IMD' && m.no).length, 40);
  assert.deepEqual([no('BWD', 4).a, no('BWD', 4).b], ['BWD-02', 'BWD-05']);
  assert.deepEqual([no('BWD', 10).a, no('BWD', 10).b], ['BWD-04', 'BWD-05']);
});

test('quarter-finals are one game to 21, semi-finals and finals best of 3', () => {
  const T = tournament();
  for (const m of T.matches.filter((x) => x.stage !== 'league')) {
    assert.equal(m.format.target, 21);
    assert.equal(m.format.bestOf, m.stage === 'quarter' ? 1 : 3, m.id);
  }
  assert.equal(T.matches.filter((m) => m.stage === 'quarter').length, 12);
});

test('with every result in, every match is decided', () => {
  for (const s of Object.values(all())) {
    assert.equal(s.status, 'completed', s.match.id);
    assert.ok(s.score.winner);
  }
});

test('quarter-finals pair group winners with runners-up, and the bracket follows on', () => {
  const s = all();
  for (const code of ['BMD', 'IMD', 'IXD']) {
    const pos = (g, r) => standings(code, g, s).rows[r - 1].team.id;
    const pair = (id) => [s[`${code}-${id}`].a.id, s[`${code}-${id}`].b.id];
    assert.deepEqual(pair('QF1'), [pos('A', 1), pos('B', 2)]);
    assert.deepEqual(pair('QF2'), [pos('C', 1), pos('D', 2)]);
    assert.deepEqual(pair('QF3'), [pos('B', 1), pos('A', 2)]);
    assert.deepEqual(pair('QF4'), [pos('D', 1), pos('C', 2)]);
    assert.deepEqual(pair('SF1'), [s[`${code}-QF1`].winnerTeam.id, s[`${code}-QF2`].winnerTeam.id]);
    assert.deepEqual(pair('SF2'), [s[`${code}-QF3`].winnerTeam.id, s[`${code}-QF4`].winnerTeam.id]);
    assert.deepEqual(pair('F'), [s[`${code}-SF1`].winnerTeam.id, s[`${code}-SF2`].winnerTeam.id]);
  }
});

test("Beginner Women's final is 1st v 2nd of the single group", () => {
  const s = all();
  const t = standings('BWD', 'A', s);
  assert.deepEqual([s['BWD-F'].a.id, s['BWD-F'].b.id], [t.rows[0].team.id, t.rows[1].team.id]);
});

test('group tables add up, including groups of 5 and 6', () => {
  const s = all();
  for (const [code, g, n, total] of [['IMD', 'A', 5, 10], ['IMD', 'D', 5, 10], ['IXD', 'B', 4, 6], ['BMD', 'B', 6, 15], ['BMD', 'D', 6, 15], ['BWD', 'A', 5, 10]]) {
    const t = standings(code, g, s);
    assert.equal(t.rows.length, n);
    assert.equal(t.total, total);
    assert.equal(t.rows.reduce((x, r) => x + r.won, 0), t.total);
    assert.equal(t.rows.reduce((x, r) => x + r.pf, 0), t.rows.reduce((x, r) => x + r.pa, 0));
  }
});

test('a scorer override takes priority over the simulation', () => {
  const T = tournament();
  const m = T.matches.find((x) => x.stage === 'league');
  const s = snapshot(8 * 60, { [m.id]: ['A', 'A', 'B'] })[m.id];
  assert.equal(s.status, 'live');
  assert.equal(s.score.a, 2);
});

test('without simulation, unscored matches stay upcoming and knockouts wait for teams', () => {
  const T = tournament();
  const m = T.matches.find((x) => x.stage === 'league');
  const s = snapshot(DONE, { [m.id]: { sides: Array(15).fill('A'), confirmed: true } });
  assert.equal(s[m.id].status, 'completed');
  assert.equal(s[m.id].confirmed, true);
  assert.ok(Object.values(s).filter((x) => x.match.id !== m.id && x.match.stage === 'league').every((x) => x.status === 'upcoming'));
  assert.ok(Object.values(s).filter((x) => x.match.stage !== 'league').every((x) => x.status === 'waiting'));
});

test('short names keep the first name and turn the rest into initials', async () => {
  const { shortName } = await import('../assets/js/engine.js');
  assert.equal(shortName('Nikish Anand Bala Thiruvalluvar'), 'Nikish A.B.T.');
  assert.equal(shortName('D Britto Baskar'), 'D. Britto B.');
  assert.equal(shortName('Pavan'), 'Pavan');
  assert.equal(shortName('Sangeetha PK'), 'Sangeetha P.K.');
  const T = tournament();
  const t = T.teamIndex['BMD-09'];
  assert.equal(t.name, 'Yuvanath M. & Nikish A.B.T.');
  assert.equal(t.fullName, 'Yuvanath Mathivanan & Nikish Anand Bala Thiruvalluvar');
});

test('every player name is in proper case', () => {
  for (const players of Object.values(TEAMS)) {
    for (const p of players) for (const w of p.split(' ')) assert.ok(/^[A-Z]/.test(w), `${p}`);
  }
});
