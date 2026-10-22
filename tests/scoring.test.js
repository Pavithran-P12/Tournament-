// Run with: npm test (or: node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMATS, gameWinner, isValidScore, replay, summarize, applyEvent, describeFormat, gameScores } from '../assets/js/scoring.js';

const L = FORMATS.league; // single game to 15, golden point
const K = FORMATS.knockout; // best of 3 to 21, golden point
const pts = (side, n) => Array(n).fill(side);

test('league: first to 15 wins, golden point at 14-14', () => {
  assert.equal(gameWinner(15, 13, L), 'A');
  assert.equal(gameWinner(9, 15, L), 'B');
  assert.equal(gameWinner(14, 13, L), null);
  assert.equal(gameWinner(14, 14, L), null);
  assert.equal(gameWinner(15, 14, L), 'A'); // no deuce
  assert.equal(gameWinner(14, 15, L), 'B');
});

test('knockout game: first to 21, golden point at 20-20', () => {
  assert.equal(gameWinner(21, 19, K), 'A');
  assert.equal(gameWinner(21, 20, K), 'A');
  assert.equal(gameWinner(20, 20, K), null);
});

test('describes the formats', () => {
  assert.equal(describeFormat(L), 'Single game to 15, golden point at 14–14');
  assert.equal(describeFormat(K), 'Best of 3 games to 21, golden point at 20–20');
});

test('score validation', () => {
  assert.ok(isValidScore(15, 14, L));
  assert.ok(!isValidScore(16, 14, L));
  assert.ok(!isValidScore(15, 15, L));
  assert.ok(!isValidScore(-1, 3, L));
});

test('league match ends after one game', () => {
  const s = summarize([...pts('A', 14), ...pts('B', 14), 'B'], L);
  assert.equal(s.winner, 'B');
  assert.equal(s.a, 14);
  assert.equal(s.b, 15);
  assert.equal(s.games.length, 1);
});

test('golden point is flagged at 14-14, and it is also match point', () => {
  const s = summarize([...pts('A', 14), ...pts('B', 14)], L);
  assert.equal(s.goldenPoint, true);
  assert.equal(s.matchPoint, 'A'); // either side; A checked first
  const t = summarize([...pts('A', 14), ...pts('B', 10)], L);
  assert.equal(t.gamePoint, 'A');
  assert.equal(t.matchPoint, 'A');
  assert.equal(t.goldenPoint, false);
});

test('knockout: best of 3, game scores and games won', () => {
  const g1 = [...pts('A', 21)]; // A 21-0
  const g2 = [...pts('B', 21)]; // B 21-0
  const s = summarize([...g1, ...g2, ...pts('A', 5)], K);
  assert.equal(s.winner, null);
  assert.deepEqual(s.gamesWon, { A: 1, B: 1 });
  assert.equal(s.gameNumber, 3);
  assert.equal(s.a, 5);
  assert.equal(s.b, 0);
  const done = summarize([...g1, ...g2, ...pts('A', 21)], K);
  assert.equal(done.winner, 'A');
  assert.equal(gameScores(done), '21–0, 0–21, 21–0');
});

test('knockout can end 2-0', () => {
  const s = summarize([...pts('B', 21), ...pts('B', 21)], K);
  assert.equal(s.winner, 'B');
  assert.equal(s.games.length, 2);
});

test('game point in game 1 is not match point; in game 3 it is', () => {
  const g1 = summarize(pts('A', 20), K);
  assert.equal(g1.gamePoint, 'A');
  assert.equal(g1.matchPoint, null);
  const g2 = summarize([...pts('A', 21), ...pts('A', 20)], K);
  assert.equal(g2.matchPoint, 'A');
});

test('serve passes to the rally winner; the game winner serves the next game', () => {
  let s = summarize([], L, 'A');
  assert.equal(s.server, 'A');
  assert.equal(s.serviceCourt, 'right');
  s = summarize(['A', 'B'], L);
  assert.equal(s.server, 'B');
  assert.equal(s.serviceCourt, 'left'); // B on 1
  s = summarize(pts('B', 21), K); // B won game 1, 0-0 in game 2
  assert.equal(s.server, 'B');
  assert.equal(s.serviceCourt, 'right');
});

test('undo is a compensating event, and can reopen a finished game', () => {
  const ev = pts('A', 15).map((side, i) => ({ id: `p${i}`, type: 'point', side }));
  const s = replay([...ev, { id: 'u', type: 'undo' }], L);
  assert.equal(s.winner, null);
  assert.equal(s.a, 14);
  const t = replay([{ id: '1', type: 'point', side: 'A' }, { id: '2', type: 'point', side: 'B' }, { id: '3', type: 'undo' }], L);
  assert.equal(t.a, 1);
  assert.equal(t.b, 0);
});

test('undo across a game boundary in a knockout', () => {
  const ev = pts('A', 21).map((side, i) => ({ id: `p${i}`, type: 'point', side }));
  const s = replay([...ev, { id: 'u', type: 'undo' }], K);
  assert.equal(s.gameNumber, 1);
  assert.equal(s.a, 20);
});

test('cannot score after the match is won, or undo with nothing to undo', () => {
  const ev = pts('A', 15).map((side, i) => ({ id: `p${i}`, type: 'point', side }));
  assert.throws(() => replay([...ev, { id: 'x', type: 'point', side: 'B' }], L), /finished/);
  assert.throws(() => replay([{ id: 'u', type: 'undo' }], L), /nothing to undo/);
});

test('duplicate taps with the same event id are applied once', () => {
  const seen = new Set();
  let events = [];
  const tap = { id: 'tap-1', type: 'point', side: 'B' };
  ({ events } = applyEvent(events, tap, L, seen));
  const second = applyEvent(events, tap, L, seen);
  assert.equal(second.applied, false);
  assert.equal(replay(second.events, L).b, 1);
});
