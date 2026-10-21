import { EVENT } from './tournament-data.js?v=20261022g';
import { tournament, category } from './engine.js?v=20261022g';
import { describeFormat, replay } from './scoring.js?v=20261022g';
import {
  mountDrawNotice, startLoop, markActiveNav, paintLiveCount, fmtTime, esc,
  stageLabel, statusPill, teamLabel, recordFor, saveLocalScore, deleteScore,
  isScorer, checkPasskey, lockScorer, downloadResults, pendingChanges, publishedInfo,
} from './ui.js?v=20261022g';

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
  const writeRecord = (rec) => saveLocalScore(m.id, { events: rec.events, confirmed: !!rec.confirmed });
  let deleteArmed = 0;
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  function render(states) {
    paintLiveCount(states);
    const st = states[m.id];
    const s = st.score;
    const nameA = teamLabel(st, 'A');
    const nameB = teamLabel(st, 'B');

    $('[data-title]').innerHTML = `${esc(nameA)} <span class="vs">v</span> ${esc(nameB)}`;
    $('[data-meta]').textContent = `${stageLabel(m)}. Court ${m.court}, ${fmtTime(m.start)}.`;
    $('[data-status]').innerHTML = statusPill(st);

    const court = $('[data-court]');
    court.dataset.status = st.status;
    court.dataset.winner = s.winner ?? '';
    $('[data-team="A"]').textContent = nameA;
    $('[data-team="B"]').textContent = nameB;
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
    if (st.status === 'completed') chipText = `${st.winnerTeam ? esc(st.winnerTeam.name) : ''} win`;
    else if (st.status === 'live' && s.gamePoint) chipText = 'Match point';
    else if (st.status === 'live' && s.deuce) chipText = 'Deuce';
    else if (st.status === 'upcoming') chipText = `Starts ${fmtTime(m.start)}`;
    else if (st.status === 'waiting') chipText = 'Waiting for teams';
    chip.hidden = !chipText;
    chip.innerHTML = chipText;

    $('[data-announce]').textContent = st.status === 'live' || st.status === 'completed' ? `${nameA} ${s.a}, ${nameB} ${s.b}` : '';

    renderSheet(s.rallies, nameA, nameB);
    renderDetails(st);
    renderScorer(st, nameA, nameB);
  }

  function renderSheet(rallies, nameA, nameB) {
    const sheet = $('[data-sheet]');
    if (!rallies.length) {
      sheet.innerHTML = '<p class="empty small">The rally-by-rally score appears here once play starts.</p>';
      return;
    }
    let a = 0;
    let b = 0;
    // One column per rally; only the rally winner's row gets a number, like a paper score sheet.
    const cols = rallies.map((side, i) => {
      side === 'A' ? a++ : b++;
      const col = i + 3;
      return `<span class="c ca" style="grid-column:${col}">${side === 'A' ? a : ''}</span><span class="c cb" style="grid-column:${col}">${side === 'B' ? b : ''}</span>`;
    });
    sheet.innerHTML = `<div class="sheet-grid" style="--cols:${rallies.length + 1}">
      <span class="sheet-name na" title="${esc(nameA)}">${esc(nameA)}</span>
      <span class="sheet-name nb" title="${esc(nameB)}">${esc(nameB)}</span>
      <span class="c ca zero" style="grid-column:2">0</span><span class="c cb zero" style="grid-column:2">0</span>
      ${cols.join('')}
    </div>`;
    sheet.scrollLeft = sheet.scrollWidth;
  }

  function renderDetails(st) {
    const rows = [
      ['Category', cat.name],
      ['Stage', stageLabel(m)],
      ['Court', `Court ${m.court}`],
      ['Scheduled', `${fmtTime(m.start)}, ${EVENT.dateLabel}`],
      ['Format', describeFormat(m.format)],
      ['Match code', m.id],
    ];
    if (st.status === 'completed' && st.winnerTeam) rows.splice(2, 0, ['Winner', st.winnerTeam.name]);
    $('[data-details]').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  }

  let askingPasskey = false;

  function renderScorer(st, nameA, nameB) {
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
    const pub = publishedInfo().updated;
    $('[data-pending]').textContent = n
      ? `${n} ${n === 1 ? 'match has' : 'matches have'} changes saved on this phone only. Download the results file and send it to the organizer to publish.`
      : `Everything on this phone matches the published results${pub ? ` (updated ${new Date(pub).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })})` : ''}.`;
  }

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
