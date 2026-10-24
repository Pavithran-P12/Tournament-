import { EVENT } from './tournament-data.js?v=20261025f';
import { tournament, category } from './engine.js?v=20261025f';
import { describeFormat, replay, gameScores } from './scoring.js?v=20261025f';
import {
  mountDrawNotice, startLoop, markActiveNav, paintLiveCount, fmtTime, esc,
  stageLabel, statusPill, teamLabel, recordFor, saveLocalScore, deleteScore,
  isScorer, checkPasskey, lockScorer, downloadResults, pendingChanges, liveInfo, sessionFor, sessionSpan, reportBy,
} from './ui.js?v=20261025f';
import { openShare } from './share.js?v=20261025f';

const $ = (s) => document.querySelector(s);
const T = tournament();
// Match code comes from ?id=…; #… is accepted too, because some local dev servers drop the query string.
const id = new URLSearchParams(location.search).get('id') || decodeURIComponent(location.hash.slice(1)) || '';
const m = T.byId[id];

mountDrawNotice();
markActiveNav();
window.addEventListener('hashchange', () => location.reload());

if (!m) {
  $('[data-match-root]').innerHTML = `<a class="back" href="matches.html">All matches</a>
    <div class="not-found"><h1>${id ? 'Match not found' : 'Choose a match'}</h1><p>${id ? `There is no match with the code “${esc(id)}”.` : 'No match was selected.'} Pick one from the match list.</p>
    <a class="btn btn-live" href="matches.html">Go to matches</a></div>`;
  startLoop(paintLiveCount);
} else {
  init();
}

function init() {
  const cat = category(m.cat);
  document.title = `${m.id} | ThirdSpace Play`;
  $('[data-cat]').textContent = cat.name;

  let prev = { a: null, b: null };
  let scoring = false;
  let lockUntil = 0;

  const record = () => recordFor(m.id);
  const writeRecord = (rec) => saveLocalScore(m.id, { events: rec.events || [], confirmed: !!rec.confirmed, ...(rec.court ? { court: rec.court } : {}) });
  let deleteArmed = 0;
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  function render(states) {
    paintLiveCount(states);
    const st = states[m.id];
    const s = st.score;
    const nameA = teamLabel(st, 'A');
    const nameB = teamLabel(st, 'B');

    const wA = s.winner === 'A' && st.status === 'completed' ? '<span class="w-badge" title="Winner">W</span>' : '';
    const wB = s.winner === 'B' && st.status === 'completed' ? '<span class="w-badge" title="Winner">W</span>' : '';
    $('[data-title]').innerHTML = `<span class="tt-a${wA ? ' is-winner' : ''}">${esc(nameA)}${wA}</span> <span class="vs">v</span> <span class="tt-b${wB ? ' is-winner' : ''}">${esc(nameB)}${wB}</span>`;
    $('[data-meta]').textContent = `${stageLabel(m)}.${st.court ? ` Court ${st.court}.` : ''}`;
    const sess = sessionFor(m);
    $('[data-report]').innerHTML = st.status === 'upcoming' || st.status === 'waiting'
      ? `<span aria-hidden="true">⏰</span> <strong>Report ${reportBy(sess)}</strong> <span>${esc(sess.label)} ${esc(sessionSpan(sess))}</span>`
      : '';
    $('[data-report]').hidden = !(st.status === 'upcoming' || st.status === 'waiting');
    $('[data-status]').innerHTML = statusPill(st);

    const court = $('[data-court]');
    court.dataset.status = st.status;
    court.dataset.winner = s.winner ?? '';
    $('[data-team="A"]').innerHTML = `${esc(nameA)}${wA}`;
    $('[data-team="B"]').innerHTML = `${esc(nameB)}${wB}`;
    for (const side of ['A', 'B']) {
      const el = $(`[data-score="${side}"]`);
      const val = side === 'A' ? s.a : s.b;
      el.textContent = st.status === 'upcoming' || st.status === 'waiting' ? '0' : val;
      const key = side.toLowerCase();
      if (prev[key] !== null && prev[key] !== val) {
        el.classList.remove('bump');
        void el.offsetWidth; // restart the animation
        el.classList.add('bump');
      }
      prev[key] = val;
    }

    // Serving position: the server stands in the right court on an even score, left on odd.
    // Team A is drawn at the top facing down, so their right is the left of the screen.
    const shuttle = $('[data-shuttle]');
    if (st.status === 'live' && s.server) {
      const right = s.serviceCourt === 'right';
      const screenLeft = s.server === 'A' ? right : !right;
      shuttle.hidden = false;
      shuttle.style.left = screenLeft ? '30%' : '70%';
      shuttle.style.top = s.server === 'A' ? '31%' : '69%';
      $('[data-serve-text]').textContent = `${s.server === 'A' ? nameA : nameB} serving from the ${s.serviceCourt} court`;
    } else {
      shuttle.hidden = true;
    }

    const chip = $('[data-net-chip]');
    let chipText = '';
    const multi = m.format.bestOf > 1;
    const finalLine = multi ? `${Math.max(s.gamesWon.A, s.gamesWon.B)}–${Math.min(s.gamesWon.A, s.gamesWon.B)}` : `${Math.max(s.a, s.b)}–${Math.min(s.a, s.b)}`;
    if (st.status === 'completed') chipText = `<span class="w-badge" title="Winner">W</span> ${st.winnerTeam ? esc(st.winnerTeam.name) : ''} win ${finalLine}`;
    else if (st.status === 'live' && s.goldenPoint) chipText = 'Golden point';
    else if (st.status === 'live' && s.matchPoint) chipText = 'Match point';
    else if (st.status === 'live' && s.gamePoint) chipText = 'Game point';
    else if (st.status === 'upcoming') chipText = m.no ? `Match ${m.no} · upcoming` : 'Upcoming';
    else if (st.status === 'waiting') chipText = 'Waiting for teams';
    chip.hidden = !chipText;
    chip.innerHTML = chipText;

    $('[data-announce]').textContent = st.status === 'live' || st.status === 'completed' ? `${nameA} ${s.a}, ${nameB} ${s.b}` : '';

    $('[data-share]').hidden = !(st.status === 'completed' && st.winnerTeam);
    lastState = st;
    renderGames(st);
    renderSheet(s.rallies, nameA, nameB);
    renderStats(st, nameA, nameB);
    renderDetails(st);
    renderScorer(st, nameA, nameB);
  }

  /** Games won and per-game scores beside the court (best-of-3 only). */
  function renderGames(st) {
    const box = $('[data-games]');
    const s = st.score;
    const show = m.format.bestOf > 1 && (st.status === 'live' || st.status === 'completed');
    box.hidden = !show;
    if (!show) return;
    const chips = s.games.map((g, i) => {
      const cur = !g.winner && st.status === 'live';
      return `<li class="${cur ? 'is-current' : ''}"><span class="gm-label">Game ${i + 1}</span>
        <span class="gm-score"><b class="${g.winner === 'A' ? 'w' : ''}">${g.a}</b><i>–</i><b class="${g.winner === 'B' ? 'w' : ''}">${g.b}</b></span></li>`;
    }).join('');
    box.innerHTML = `<div class="games-tally"><span class="gt-a">${s.gamesWon.A}</span><span class="gt-label">Games</span><span class="gt-b">${s.gamesWon.B}</span></div><ol class="games-list">${chips}</ol>`;
  }

  function renderSheet(rallies, nameA, nameB) {
    const sheet = $('[data-sheet]');
    if (!rallies.length) {
      sheet.innerHTML = '<p class="empty small">The rally-by-rally score appears here once play starts.</p>';
      return;
    }
    // Split the rallies into games, then draw one paper-style row pair per game.
    const games = [];
    let cur = [];
    let a = 0;
    let b = 0;
    for (const side of rallies) {
      cur.push(side);
      side === 'A' ? a++ : b++;
      const f = m.format;
      if ((a >= f.target && a > b) || (b >= f.target && b > a)) { games.push(cur); cur = []; a = 0; b = 0; }
    }
    if (cur.length) games.push(cur);
    const multi = m.format.bestOf > 1;
    sheet.innerHTML = games.map((g, gi) => {
      let x = 0;
      let y = 0;
      const cols = g.map((side, i) => {
        side === 'A' ? x++ : y++;
        const col = i + 3;
        return `<span class="c ca" style="grid-column:${col}">${side === 'A' ? x : ''}</span><span class="c cb" style="grid-column:${col}">${side === 'B' ? y : ''}</span>`;
      });
      return `${multi ? `<p class="sheet-game">Game ${gi + 1}</p>` : ''}<div class="sheet-scroll"><div class="sheet-grid" style="--cols:${g.length + 1}">
        <span class="sheet-name na" title="${esc(nameA)}">${esc(nameA)}</span>
        <span class="sheet-name nb" title="${esc(nameB)}">${esc(nameB)}</span>
        <span class="c ca zero" style="grid-column:2">0</span><span class="c cb zero" style="grid-column:2">0</span>
        ${cols.join('')}
      </div></div>`;
    }).join('');
    sheet.querySelectorAll('.sheet-scroll').forEach((el) => { el.scrollLeft = el.scrollWidth; });
  }

  /** Numbers worth knowing, all derived from the rally-by-rally record. */
  function matchStats(rallies) {
    const out = { A: { points: 0, run: 0, lead: 0, onServe: 0 }, B: { points: 0, run: 0, lead: 0, onServe: 0 }, leadChanges: 0 };
    let server = EVENT.firstServer;
    let run = 0;
    let last = null;
    let leader = null;
    let a = 0;
    let b = 0;
    for (const side of rallies) {
      out[side].points++;
      if (side === server) out[side].onServe++;
      run = side === last ? run + 1 : 1;
      out[side].run = Math.max(out[side].run, run);
      last = side;
      server = side;
      side === 'A' ? a++ : b++;
      out.A.lead = Math.max(out.A.lead, a - b);
      out.B.lead = Math.max(out.B.lead, b - a);
      const now = a > b ? 'A' : b > a ? 'B' : leader;
      if (leader && now !== leader) out.leadChanges++;
      leader = now;
      // a new game starts from 0–0
      if ((a >= m.format.target && a > b) || (b >= m.format.target && b > a)) { a = 0; b = 0; leader = null; }
    }
    return out;
  }

  function renderStats(st, nameA, nameB) {
    const panel = $('[data-stats-panel]');
    const rallies = st.score.rallies;
    panel.hidden = !rallies.length;
    if (!rallies.length) return;
    const x = matchStats(rallies);
    const row = (label, key, hint) => {
      const va = x.A[key];
      const vb = x.B[key];
      const total = Math.max(va + vb, 1);
      return `<div class="stat" title="${hint}">
        <span class="stat-v stat-a${va > vb ? ' is-more' : ''}">${va}</span>
        <div class="stat-mid"><span class="stat-label">${label}</span>
          <div class="stat-bar"><span class="sb-a" style="width:${(va / total) * 100}%"></span><span class="sb-b" style="width:${(vb / total) * 100}%"></span></div></div>
        <span class="stat-v stat-b${vb > va ? ' is-more' : ''}">${vb}</span>
      </div>`;
    };
    $('[data-stats]').innerHTML = `
      <div class="stat-heads"><span class="sh-a">${esc(nameA)}</span><span class="sh-b">${esc(nameB)}</span></div>
      ${row('Points', 'points', 'Total rallies won')}
      ${row('Won on serve', 'onServe', 'Rallies won while serving')}
      ${row('Longest run', 'run', 'Most points in a row')}
      ${row('Biggest lead', 'lead', 'Largest gap in the score')}
      <p class="stat-foot">${rallies.length} rallies played. ${x.leadChanges ? `The lead changed hands ${x.leadChanges} ${x.leadChanges === 1 ? 'time' : 'times'}.` : 'One team led throughout.'}</p>`;
  }

  function renderDetails(st) {
    const won = (side) => st.status === 'completed' && st.score.winner === side;
    const fromGroup = (side) => {
      if (m.stage === 'league' || Object.keys(cat.groups).length === 1) return '';
      const g = (side === 'A' ? st.a : st.b)?.group ?? m.from?.[side === 'A' ? 0 : 1]?.g;
      return g ? `<b class="g-chip group-${g.toLowerCase()}" title="From group ${g}">${g}</b>` : '';
    };
    const team = (side) => `<span class="dt-team dt-team-${side.toLowerCase()}">${fromGroup(side)}${esc(teamLabel(st, side, { full: true }))}${won(side) ? '<span class="w-badge">W</span>' : ''}</span>`;
    const stage = m.stage === 'league'
      ? `<span class="stage-chip group-${m.group.toLowerCase()}"><b>${m.group}</b> Group ${m.group}, ${m.no ? `match ${m.no}` : `round ${m.round}`}</span>`
      : `<span class="stage-chip stage-ko">${esc(stageLabel(m))}</span>`;
    const rows = [
      ['Team 1', team('A')],
      ['Team 2', team('B')],
      ['Category', `<span class="cat-chip cat-chip-${cat.level.toLowerCase()}">${esc(cat.level)}</span> ${esc(cat.name.replace(`${cat.level} `, ''))}`],
      ['Stage', stage],
      ['Court', st.court ? `<span class="court-chip">${st.court}</span> Court ${st.court}` : 'Called on the day'],
      ['Session', `${esc(sessionFor(m).label)}, ${esc(sessionSpan(sessionFor(m)))}, ${esc(EVENT.dateLabel)}`],
      ['Format', esc(describeFormat(m.format))],
      ['Match code', `<code>${esc(m.id)}</code>`],
    ];
    $('[data-details]').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }

  let askingPasskey = false;

  function renderScorer(st, nameA, nameB) {
    const pick = $('[data-court-pick]');
    if (document.activeElement !== pick) pick.value = st.court ? String(st.court) : '';
    const rec = record();
    const canScore = !!(st.a && st.b);
    if (scoring && !isScorer()) scoring = false;
    const toggle = $('[data-scorer-toggle]');
    toggle.hidden = scoring || askingPasskey || !canScore;
    toggle.textContent = st.status === 'completed' ? 'Correct this result' : 'Score this match';
    $('[data-passkey]').hidden = !askingPasskey;
    const panel = $('[data-scorer]');
    panel.hidden = !scoring;
    document.body.classList.toggle('is-scoring', scoring);
    if (!scoring) return;
    $('[data-btn-team="A"]').textContent = nameA;
    $('[data-btn-team="B"]').textContent = nameB;
    const finished = !!st.score.winner;
    const confirmed = !!rec?.confirmed;
    document.querySelectorAll('[data-point]').forEach((b) => { b.disabled = finished || Date.now() < lockUntil; });
    $('[data-undo]').disabled = confirmed || !st.score.rallies.length;
    $('[data-delete]').textContent = Date.now() < deleteArmed ? 'Tap again to delete' : "Delete this match's scores";
    const result = $('[data-result]');
    result.hidden = !finished;
    if (finished) {
      const w = st.score.winner === 'A' ? nameA : nameB;
      const sc = st.score.winner === 'A' ? `${st.score.a}–${st.score.b}` : `${st.score.b}–${st.score.a}`;
      result.innerHTML = confirmed
        ? `<p><strong>Result confirmed.</strong> ${esc(w)} won ${sc}.</p>
           <button type="button" class="btn btn-text" data-reopen>Reopen to correct</button>`
        : `<p><strong>${esc(w)} win ${sc}.</strong> Check the score with the umpire, then confirm. If the last point was a mistake, undo it.</p>
           <button type="button" class="btn btn-live" data-confirm>Confirm result</button>`;
    }
    const n = pendingChanges();
    const lv = liveInfo();
    const at = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    const box = $('[data-pending]');
    box.className = n ? 'sync-wait' : lv.ok ? 'sync-ok' : 'sync-wait';
    box.textContent = n
      ? `${n} ${n === 1 ? 'match is' : 'matches are'} waiting to go live${lv.error ? ' (no connection)' : ''}. Keep this page open; it sends automatically when the internet is back.`
      : lv.ok ? `✓ Live for everyone · synced ${at(lv.at)}` : 'Connecting to live scores…';
  }

  let lastState = null;
  $('[data-share]').addEventListener('click', () => {
    const st = lastState;
    if (!st || st.status !== 'completed') return;
    const w = st.score.winner;
    const winner = w === 'A' ? st.a : st.b;
    const loser = w === 'A' ? st.b : st.a;
    openShare({
      category: cat.name.replace(`${cat.level} `, ''),
      level: cat.level,
      stage: stageLabel(m),
      court: st.court || null,
      winnerPlayers: winner.players,
      loserPlayers: loser.players,
      target: m.format.target,
      winScore: m.format.bestOf > 1 ? st.score.gamesWon[w] : Math.max(st.score.a, st.score.b),
      loseScore: m.format.bestOf > 1 ? st.score.gamesWon[w === 'A' ? 'B' : 'A'] : Math.min(st.score.a, st.score.b),
      gameLine: m.format.bestOf > 1 ? st.score.games.map((g) => (w === 'A' ? `${g.a}–${g.b}` : `${g.b}–${g.a}`)).join(', ') : null,
      games: m.format.bestOf > 1 ? st.score.games.filter((g) => g.a || g.b).map((g) => (w === 'A' ? [g.a, g.b] : [g.b, g.a])) : null,
      bestOf: m.format.bestOf,
      isFinal: m.stage === 'final',
    }, `ThirdSpace-Play-${m.id}.png`);
  });

  // Scorer actions
  const act = (fn) => { fn(); refresh(); };
  const startScoring = () => {
    if (!record()) writeRecord({ events: [], confirmed: false });
    scoring = true;
    askingPasskey = false;
    refresh();
  };
  $('[data-scorer-toggle]').addEventListener('click', () => {
    if (isScorer()) return startScoring();
    askingPasskey = true;
    refresh();
    $('[data-passkey-input]').focus();
  });
  $('[data-passkey]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('[data-passkey-input]');
    const err = $('[data-passkey-error]');
    try {
      if (await checkPasskey(input.value)) {
        input.value = '';
        err.hidden = true;
        startScoring();
      } else {
        err.textContent = 'That passkey is not correct. Check with the organizer and try again.';
        err.hidden = false;
        input.select();
      }
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });
  $('[data-passkey-cancel]').addEventListener('click', () => { askingPasskey = false; refresh(); });
  $('[data-court-pick]').addEventListener('change', (e) => {
    const rec = record() || { events: [], confirmed: false };
    writeRecord({ ...rec, court: e.target.value ? Number(e.target.value) : null });
    refresh();
  });
  $('[data-lock]').addEventListener('click', () => { lockScorer(); scoring = false; refresh(); });

  document.querySelectorAll('[data-point]').forEach((btn) => btn.addEventListener('click', () => {
    if (Date.now() < lockUntil || !isScorer()) return; // ignore an accidental double tap
    lockUntil = Date.now() + 450;
    setTimeout(refresh, 460);
    act(() => {
      const rec = record() ?? { events: [] };
      const ev = { id: newId(), type: 'point', side: btn.dataset.point, at: new Date().toISOString() };
      try {
        replay([...rec.events, ev], m.format);
        writeRecord({ ...rec, events: [...rec.events, ev] });
      } catch { /* game already finished */ }
    });
  }));
  $('[data-undo]').addEventListener('click', () => act(() => {
    const rec = record();
    if (!rec || rec.confirmed) return;
    const ev = { id: newId(), type: 'undo', at: new Date().toISOString() };
    try {
      replay([...rec.events, ev], m.format);
      writeRecord({ ...rec, events: [...rec.events, ev] });
    } catch { /* nothing to undo */ }
  }));
  $('[data-delete]').addEventListener('click', () => {
    if (Date.now() < deleteArmed) {
      deleteArmed = 0;
      act(() => { deleteScore(m.id); scoring = false; });
    } else {
      deleteArmed = Date.now() + 4000;
      setTimeout(refresh, 4100);
      refresh();
    }
  });
  $('[data-result]').addEventListener('click', (e) => {
    if (e.target.closest('[data-confirm]')) act(() => writeRecord({ ...record(), confirmed: true }));
    if (e.target.closest('[data-reopen]')) act(() => writeRecord({ ...record(), confirmed: false }));
  });
  $('[data-download]').addEventListener('click', downloadResults);

  const refresh = startLoop(render);
}
