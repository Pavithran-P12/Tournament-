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
  assert.ok(!TEAMS['IXD-09'], 'duplicate mixed entry removed');
  const count = (code) => CATEGORIES.find((c) => c.code === code);
  assert.deepEqual(Object.values(count('BMD').groups).map((g) => g.length), [6, 6, 6, 6]);
  assert.deepEqual(Object.values(count('IMD').groups).map((g) => g.length), [6, 4, 4, 4]);
  assert.deepEqual(Object.values(count('IXD').groups).map((g) => g.length), [4, 4, 4, 4]);
  assert.deepEqual(Object.values(count('BWD').groups).map((g) => g.length), [4]);
});

test('every team plays exactly 3 league matches against different opponents in its group', () => {
  const T = tournament();
  for (const c of T.cats) {
    for (const [letter, teams] of Object.entries(c.teamsByGroup)) {
      const ids = teams.map((t) => t.id);
      for (const t of teams) {
        const mine = T.matches.filter((m) => m.stage === 'league' && (m.a === t.id || m.b === t.id));
        const opponents = mine.map((m) => (m.a === t.id ? m.b : m.a));
        assert.equal(new Set(opponents).size, opponents.length, `${t.name} meets someone twice`);
        assert.ok(opponents.every((o) => ids.includes(o)), `${t.name} plays outside group ${letter}`);
        assert.equal(mine.length, 3, t.name);
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

test('knockout slots never mix categories that share players', () => {
  const T = tournament();
  const catPeople = {};
  for (const c of T.cats) catPeople[c.code] = new Set(Object.values(c.teamsByGroup).flat().flatMap((t) => t.players.map(personKey)));
  const shares = (x, y) => [...catPeople[x]].some((p) => catPeople[y].has(p));
  const slots = {};
  for (const m of T.matches.filter((x) => x.stage !== 'league')) (slots[m.start] ??= new Set()).add(m.cat);
  for (const cats of Object.values(slots)) {
    const list = [...cats];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) assert.ok(!shares(list[i], list[j]), `${list[i]} and ${list[j]} share players`);
  }
});

test('whole day fits between 9 AM and 4 PM, knockouts after the league', () => {
  const T = tournament();
  assert.ok(T.dayEnds <= EVENT.dayEnd, `ends at ${T.dayEnds}`);
  const ko = T.matches.filter((m) => m.stage !== 'league');
  assert.ok(ko.every((m) => m.start >= T.leagueEnd));
  // each knockout match starts after the matches it depends on have finished
  for (const m of ko) for (const ref of m.from) if (ref.w) assert.ok(T.byId[`${m.cat}-${ref.w}`].end <= m.start, m.id);
});

test('with every result in, every match is decided', () => {
  for (const s of Object.values(all())) {
    assert.equal(s.status, 'completed', s.match.id);
    assert.ok(s.score.winner);
  }
});

test('semi-finals pair A1 v C1 and B1 v D1 where groups go straight to semis', () => {
  const s = all();
  for (const code of ['BMD', 'IMD', 'IXD']) {
    const w = (g) => standings(code, g, s).rows[0].team.id;
    assert.deepEqual([s[`${code}-SF1`].a.id, s[`${code}-SF1`].b.id], [w('A'), w('C')]);
    assert.deepEqual([s[`${code}-SF2`].a.id, s[`${code}-SF2`].b.id], [w('B'), w('D')]);
    assert.equal(s[`${code}-F`].a.id, s[`${code}-SF1`].winnerTeam.id);
  }
});

test("Beginner Women's final is 1st v 2nd of the single group", () => {
  const s = all();
  const t = standings('BWD', 'A', s);
  assert.deepEqual([s['BWD-F'].a.id, s['BWD-F'].b.id], [t.rows[0].team.id, t.rows[1].team.id]);
});

test('group tables add up, including groups of 6', () => {
  const s = all();
  for (const [code, g, n, total] of [['IMD', 'A', 6, 9], ['IMD', 'B', 4, 6], ['IXD', 'C', 4, 6], ['BMD', 'B', 6, 9]]) {
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
