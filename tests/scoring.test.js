// Run with: npm test (or: node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMATS, gameWinner, isValidScore, replay, summarize, applyEvent } from '../assets/js/scoring.js';

const L = FORMATS.league; // 15, cap 21
const K = FORMATS.knockout; // 21, cap 30

test('league game is won at 15 with a 2-point lead', () => {
  assert.equal(gameWinner(15, 13, L), 'A');
  assert.equal(gameWinner(9, 15, L), 'B');
  assert.equal(gameWinner(14, 13, L), null);
});

test('league game continues at 15-14 and is decided by 2 points in deuce', () => {
  assert.equal(gameWinner(15, 14, L), null);
  assert.equal(gameWinner(16, 14, L), 'A');
  assert.equal(gameWinner(18, 18, L), null);
  assert.equal(gameWinner(19, 17, L), 'A');
});

test('league cap: at 20-20 the next point wins', () => {
  assert.equal(gameWinner(20, 20, L), null);
  assert.equal(gameWinner(21, 20, L), 'A');
  assert.equal(gameWinner(20, 21, L), 'B');
});

test('knockout game follows BWF: 21, win by 2, cap 30', () => {
  assert.equal(gameWinner(21, 19, K), 'A');
  assert.equal(gameWinner(21, 20, K), null);
  assert.equal(gameWinner(29, 29, K), null);
  assert.equal(gameWinner(30, 29, K), 'A');
});

test('score validation rejects impossible finals', () => {
  assert.ok(isValidScore(15, 0, L));
  assert.ok(isValidScore(21, 20, L));
  assert.ok(!isValidScore(16, 10, L)); // game ended at 15-10
  assert.ok(!isValidScore(22, 20, L)); // above cap
  assert.ok(!isValidScore(-1, 3, L));
});

test('serve passes to the rally winner and court follows the server score', () => {
  let s = summarize([], L, 'A');
  assert.equal(s.server, 'A');
  assert.equal(s.serviceCourt, 'right');
  s = summarize(['A'], L);
  assert.equal(s.server, 'A');
  assert.equal(s.serviceCourt, 'left'); // A on 1
  s = summarize(['A', 'B'], L);
  assert.equal(s.server, 'B');
  assert.equal(s.serviceCourt, 'left'); // B on 1
  s = summarize(['A', 'B', 'B'], L);
  assert.equal(s.serviceCourt, 'right'); // B on 2
});

test('game point and deuce flags', () => {
  const s = summarize([...Array(14).fill('A'), ...Array(10).fill('B')], L);
  assert.equal(s.gamePoint, 'A');
  const d = summarize([...Array(14).fill('A'), ...Array(14).fill('B')], L);
  assert.equal(d.deuce, true);
  assert.equal(d.gamePoint, null);
});

test('undo is a compensating event, not a deletion', () => {
  const events = [
    { id: 'e1', type: 'point', side: 'A' },
    { id: 'e2', type: 'point', side: 'B' },
    { id: 'e3', type: 'undo' },
    { id: 'e4', type: 'point', side: 'A' },
  ];
  const s = replay(events, L);
  assert.equal(s.a, 2);
  assert.equal(s.b, 0);
  assert.equal(events.length, 4); // history kept
});

test('cannot score after the game is won', () => {
  const ev = Array.from({ length: 15 }, (_, i) => ({ id: `p${i}`, type: 'point', side: 'A' }));
  assert.throws(() => replay([...ev, { id: 'x', type: 'point', side: 'B' }], L), /finished/);
});

test('undo can reopen a finished game (scorer mistake on the last rally)', () => {
  const ev = Array.from({ length: 15 }, (_, i) => ({ id: `p${i}`, type: 'point', side: 'A' }));
  const s = replay([...ev, { id: 'u', type: 'undo' }], L);
  assert.equal(s.winner, null);
  assert.equal(s.a, 14);
});

test('cannot undo with no points', () => {
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
