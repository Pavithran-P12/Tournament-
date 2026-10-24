// Builds a shareable result card sized for Instagram Stories (1080 x 1920 PNG, 9:16) for a finished match and opens a preview
// with Share (phones that support sharing files) and Download buttons.

import { EVENT } from './tournament-data.js?v=20261024w';
import { rng } from './tournament-data.js?v=20261024w';

const W = 1080;
const H = 1920;
// Instagram covers roughly the top and bottom 250px of a story with its own bars.
const SAFE_TOP = 250;
const FOOT = 1580; // top of the footer band, above the bottom safe zone
const M = 80; // outer margin
const C = {
  night: '#05211b', court: '#0e4a41', courtHi: '#13604f', line: '#eef3ef', muted: '#9fbcb3',
  live: '#ec3d7a', amber: '#f3c350', sky: '#8ed3e6', win: '#7cf0b0', ink: '#0d2622', gold: '#e9c46a',
};
const DISPLAY = "'Big Shoulders Display', 'Arial Narrow', 'DejaVu Sans Condensed', Impact, sans-serif";
const BODY = "Figtree, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws text with extra letter spacing (canvas letterSpacing is not everywhere yet). */
function spaced(ctx, text, x, y, spacing, align = 'left') {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  const saved = ctx.textAlign;
  ctx.textAlign = 'left';
  [...text].forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = saved;
  return total;
}

/** Largest size (max..min) at which every line fits maxWidth. */
function fitLines(ctx, lines, weight, family, max, min, maxWidth) {
  for (let size = max; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (lines.every((l) => ctx.measureText(l).width <= maxWidth)) return size;
  }
  return min;
}

/** Background: night green with a broadcast-style diagonal slab, pinstripes and accent slivers. */
function background(ctx, edgeL, edgeR) {
  ctx.fillStyle = C.night;
  ctx.fillRect(0, 0, W, H);
  const slab = new Path2D();
  slab.moveTo(0, 0); slab.lineTo(W, 0); slab.lineTo(W, edgeR); slab.lineTo(0, edgeL); slab.closePath();
  const g = ctx.createLinearGradient(0, 0, W, 900);
  g.addColorStop(0, C.courtHi);
  g.addColorStop(1, C.court);
  ctx.fillStyle = g;
  ctx.fill(slab);
  ctx.save();
  ctx.clip(slab);
  ctx.strokeStyle = 'rgba(255,255,255,.045)';
  ctx.lineWidth = 2;
  for (let x = -H; x < W + H; x += 26) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - H, H); ctx.stroke(); }
  const glow = ctx.createRadialGradient(W - 120, 120, 10, W - 120, 120, 520);
  glow.addColorStop(0, 'rgba(124,240,176,.22)');
  glow.addColorStop(1, 'rgba(124,240,176,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // accent slivers along the slab edge
  const edge = (offset, width, color) => {
    ctx.beginPath();
    ctx.moveTo(0, edgeL + offset); ctx.lineTo(W, edgeR + offset);
    ctx.lineTo(W, edgeR + offset + width); ctx.lineTo(0, edgeL + offset + width); ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  edge(0, 10, C.win);
  edge(22, 4, C.gold);
}

/** A large, faint line drawing of a shuttlecock behind the top-right of the card. */
function shuttleArt(ctx) {
  ctx.save();
  ctx.translate(900, 690);
  ctx.rotate(-0.32);
  ctx.strokeStyle = 'rgba(238,243,239,.08)';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  const cork = 85;
  const skirtTop = -520;
  const topHalf = 240;
  // cork
  ctx.beginPath();
  ctx.moveTo(-cork, 0);
  ctx.arc(0, 0, cork, Math.PI, 0, true);
  ctx.closePath();
  ctx.stroke();
  // skirt outline
  ctx.beginPath();
  ctx.moveTo(-cork, 0); ctx.lineTo(-topHalf, skirtTop);
  ctx.moveTo(cork, 0); ctx.lineTo(topHalf, skirtTop);
  ctx.stroke();
  // feather shafts
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo((i / 3) * cork * 0.85, 0);
    ctx.lineTo((i / 3) * topHalf, skirtTop);
    ctx.stroke();
  }
  // binding bands
  for (const t of [0.28, 0.55]) {
    const y = skirtTop * t;
    const half = cork + (topHalf - cork) * t;
    ctx.beginPath(); ctx.moveTo(-half, y); ctx.lineTo(half, y); ctx.stroke();
  }
  // scalloped feather tips
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const x0 = -topHalf + (i * 2 * topHalf) / 6;
    const x1 = x0 + (2 * topHalf) / 6;
    ctx.moveTo(x0, skirtTop);
    ctx.quadraticCurveTo((x0 + x1) / 2, skirtTop - 70, x1, skirtTop);
  }
  ctx.stroke();
  ctx.restore();
}

/** Logo, THIRDSPACE PLAY and the tournament line, inside the top safe zone. */
async function drawHeader(ctx) {
  const logo = await loadImage('assets/img/thirdspace-logo.png');
  if (logo) ctx.drawImage(logo, M, SAFE_TOP + 20, 104, 104);
  ctx.fillStyle = C.line;
  ctx.font = `900 54px ${DISPLAY}`;
  const tw = spaced(ctx, 'THIRDSPACE', M + 128, SAFE_TOP + 72, 2);
  ctx.fillStyle = C.amber;
  spaced(ctx, 'PLAY', M + 128 + tw + 14, SAFE_TOP + 72, 2);
  ctx.fillStyle = C.muted;
  ctx.font = `700 20px ${BODY}`;
  spaced(ctx, 'BADMINTON TOURNAMENT  2026', M + 130, SAFE_TOP + 110, 3.5);

}

/** Footer band: venue and Instagram on the left, date and the created-by pill on the right. */
function drawFooter(ctx) {
  // Footer band
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(0, FOOT, W, H - FOOT);
  ctx.fillStyle = C.win;
  ctx.fillRect(0, FOOT, W, 3);
  // Footer, two columns. Left: venue, then the organiser's Instagram. Right: date, then the credit pill.
  const line1 = FOOT + 50;
  ctx.font = `600 20px ${BODY}`;
  ctx.fillStyle = C.muted;
  ctx.textAlign = 'left';
  ctx.fillText('Rapid Sports Academy, Chennai', M, line1);
  ctx.textAlign = 'right';
  ctx.fillText('Sunday 25 October 2026', W - M, line1);
  ctx.textAlign = 'left';
  // Instagram glyph + handle, vertically centred with the pill below
  const igY = FOOT + 104;
  ctx.save();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3;
  roundRect(ctx, M, igY - 26, 32, 32, 9);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(M + 16, igY - 10, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.line;
  ctx.beginPath(); ctx.arc(M + 25, igY - 19, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.font = `700 26px ${BODY}`;
  ctx.fillStyle = C.line;
  ctx.fillText('@thirdspace_by_losh', M + 46, igY);

  // Created-by pill, right-aligned in the footer
  const parts = { a: 'Created with', b: 'by', c: 'P12', d: 'pavithranm.in' };
  ctx.font = `600 20px ${BODY}`;
  const wa = ctx.measureText(parts.a).width;
  const wb = ctx.measureText(parts.b).width;
  ctx.font = `900 28px ${DISPLAY}`;
  const wc = ctx.measureText(parts.c).width;
  ctx.font = `600 18px ${BODY}`;
  const wd = ctx.measureText(parts.d).width;
  const gap = 10;
  const heart = 18;
  const pw = 24 + wa + gap + heart + gap + wb + gap + wc + 16 + 1 + 16 + wd + 24;
  const ph = 52;
  const px = W - M - pw;
  const py = FOOT + 94 - ph / 2;
  roundRect(ctx, px, py, pw, ph, ph / 2);
  ctx.fillStyle = C.line;
  ctx.fill();
  let tx = px + 24;
  const base = py + 33;
  ctx.fillStyle = C.ink;
  ctx.font = `600 20px ${BODY}`;
  ctx.fillText(parts.a, tx, base);
  tx += wa + gap;
  ctx.save();
  ctx.translate(tx + heart / 2, py + 27);
  ctx.fillStyle = C.live;
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-13, -1, -7, -12, 0, -5);
  ctx.bezierCurveTo(7, -12, 13, -1, 0, 7);
  ctx.fill();
  ctx.restore();
  tx += heart + gap;
  ctx.fillStyle = C.ink;
  ctx.fillText(parts.b, tx, base);
  tx += wb + gap;
  ctx.font = `900 28px ${DISPLAY}`;
  ctx.fillStyle = C.court;
  ctx.fillText(parts.c, tx, base + 2);
  tx += wc + 16;
  ctx.fillStyle = 'rgba(13,38,34,.25)';
  ctx.fillRect(tx, py + 14, 1, ph - 28);
  tx += 17;
  ctx.font = `600 18px ${BODY}`;
  ctx.fillStyle = '#3c5852';
  ctx.fillText(parts.d, tx, base - 1);

}

/**
 * info: { category, level, stage, court, winnerPlayers, loserPlayers, winScore, loseScore, isFinal, target }
 */
export async function buildResultImage(info) {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  // Layout first: the winner block decides where the diagonal sits, so text never crosses it.
  const labelY = SAFE_TOP + 430;
  const maxW = W - 2 * M;
  // Each player gets their own line (two if a name is very long), as big as the width allows.
  let players = info.winnerPlayers.map((n) => [n.toUpperCase()]);
  let size = fitLines(ctx, players.flat(), 900, DISPLAY, 150, 56, maxW);
  ctx.font = `900 ${size}px ${DISPLAY}`;
  if (players.flat().some((n) => ctx.measureText(n).width > maxW)) {
    players = players.map(([n]) => {
      if (ctx.measureText(n).width <= maxW) return [n];
      const w = n.split(' ');
      const half = Math.ceil(w.length / 2);
      return [w.slice(0, half).join(' '), w.slice(half).join(' ')];
    });
    size = fitLines(ctx, players.flat(), 900, DISPLAY, 120, 44, maxW);
  }
  const lineH = size * 0.95;
  const sepH = 86; // the "&" divider between the two players
  const namesTop = labelY + 40 + size * 0.8;
  const blockBottom = namesTop + lineH * (players.flat().length - 1) + sepH;
  // the edge rises to the right, so leave room for it under the right end of the names
  const edgeL = Math.min(Math.max(blockBottom + 200, 1150), 1250);
  const edgeR = edgeL - 110;
  background(ctx, edgeL, edgeR);
  shuttleArt(ctx);

  await drawHeader(ctx);

  // Category row
  const rowY = SAFE_TOP + 270;
  ctx.font = `800 20px ${BODY}`;
  const lvl = info.level.toUpperCase();
  const lvlW = ctx.measureText(lvl).width + 28 + 2.5 * lvl.length;
  roundRect(ctx, M, rowY - 30, lvlW, 40, 6);
  ctx.fillStyle = info.level === 'Intermediate' ? C.live : C.sky;
  ctx.fill();
  ctx.fillStyle = info.level === 'Intermediate' ? '#fff' : C.ink;
  spaced(ctx, lvl, M + 14, rowY - 3, 2.5);
  ctx.fillStyle = C.line;
  ctx.font = `800 34px ${DISPLAY}`;
  spaced(ctx, info.category.toUpperCase(), M + lvlW + 18, rowY, 1.5);
  ctx.fillStyle = C.muted;
  ctx.font = `600 22px ${BODY}`;
  ctx.fillText(info.court ? `${info.stage}   |   Court ${info.court}` : info.stage, M, rowY + 44);

  // Winners label
  ctx.fillStyle = C.win;
  ctx.fillRect(M, labelY - 13, 46, 5);
  ctx.font = `800 26px ${BODY}`;
  spaced(ctx, info.isFinal ? 'CHAMPIONS' : 'WINNERS', M + 62, labelY, 6);

  // Winner names: player one, a gold "&" divider, player two
  ctx.font = `900 ${size}px ${DISPLAY}`;
  ctx.fillStyle = C.line;
  let y = namesTop;
  players.forEach((lines, pi) => {
    if (pi > 0) {
      const midY = ((y - lineH) + (y + sepH - size * 0.74)) / 2; // halfway between the two names
      ctx.fillStyle = C.gold;
      ctx.font = `900 48px ${DISPLAY}`;
      ctx.fillText('&', M, midY + 16);
      ctx.fillRect(M + 52, midY, 220, 3);
      ctx.font = `900 ${size}px ${DISPLAY}`;
      ctx.fillStyle = C.line;
      y += sepH;
    }
    for (const line of lines) { ctx.fillText(line, M, y); y += lineH; }
  });

  // Score: winner solid, opponent outlined
  const scoreBase = Math.min(edgeR + 120 + 260, FOOT - 70);
  ctx.font = `900 250px ${DISPLAY}`;
  const ws = String(info.winScore);
  const ls = String(info.loseScore);
  ctx.fillStyle = C.win;
  ctx.fillText(ws, M - 8, scoreBase);
  const wsW = ctx.measureText(ws).width;
  ctx.save();
  ctx.translate(M + wsW + 30, scoreBase - 100);
  ctx.rotate(0.35);
  ctx.fillStyle = 'rgba(238,243,239,.35)';
  ctx.fillRect(-4, -80, 8, 160);
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(238,243,239,.75)';
  ctx.strokeText(ls, M + wsW + 70, scoreBase);
  const scoreRight = M + wsW + 70 + ctx.measureText(ls).width;

  // Score caption, to the right of the numbers
  const capX = scoreRight + 44;
  const multi = info.bestOf > 1;
  const cap1 = multi ? 'Games won' : 'Rally scoring';
  const cap2 = multi ? info.gameLine : `Single game to ${info.target}`;
  ctx.font = `600 24px ${BODY}`;
  const capW = Math.max(ctx.measureText(cap1).width, ctx.measureText(cap2).width);
  if (capX + capW <= W - M) {
    ctx.textAlign = 'left';
    ctx.font = `700 20px ${BODY}`;
    ctx.fillStyle = C.muted;
    spaced(ctx, 'FINAL SCORE', capX, scoreBase - 150, 4);
    ctx.font = `600 24px ${BODY}`;
    ctx.fillStyle = C.line;
    ctx.fillText(cap1, capX, scoreBase - 110);
    ctx.fillText(cap2, capX, scoreBase - 76);
  } else if (multi) {
    // not enough room beside the numbers: put the game scores underneath
    ctx.font = `600 26px ${BODY}`;
    ctx.fillStyle = C.line;
    ctx.fillText(`Games  ${info.gameLine}`, M, scoreBase + 50);
  }

  drawFooter(ctx);

  return canvas;
}


/**
 * Team journey card: every match the team played or will play, in order, with results.
 * info: { category, level, group, players: [p1, p2], summary, standing, matches: [{ code, stage, opp, outcome, score, detail }] }
 * outcome: 'W' | 'L' | 'LIVE' | 'NEXT'
 */
export async function buildTeamImage(info) {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  const maxW = W - 2 * M;

  // Names: one line per player, sized to fit.
  const names = info.players.map((n) => n.toUpperCase());
  const ampW0 = 44;
  const size = fitLines(ctx, names, 900, DISPLAY, 92, 46, maxW - ampW0);
  const rowY = SAFE_TOP + 200;
  const labelY = rowY + 70;
  const name1Y = labelY + 26 + size * 0.8;
  const lineH = size * 0.98;
  const name2Y = name1Y + lineH;
  const standY = name2Y + 30 + 48;
  const summaryY = standY + 40;
  const edgeL = summaryY + 70;
  background(ctx, edgeL, edgeL - 80);
  shuttleArt(ctx);
  await drawHeader(ctx);

  // Category row
  ctx.font = `800 20px ${BODY}`;
  const lvl = info.level.toUpperCase();
  const lvlW = ctx.measureText(lvl).width + 28 + 2.5 * lvl.length;
  roundRect(ctx, M, rowY - 30, lvlW, 40, 6);
  ctx.fillStyle = info.level === 'Intermediate' ? C.live : C.sky;
  ctx.fill();
  ctx.fillStyle = info.level === 'Intermediate' ? '#fff' : C.ink;
  spaced(ctx, lvl, M + 14, rowY - 3, 2.5);
  ctx.fillStyle = C.line;
  ctx.font = `800 34px ${DISPLAY}`;
  spaced(ctx, info.category.toUpperCase(), M + lvlW + 18, rowY, 1.5);

  // Label + names
  ctx.fillStyle = C.win;
  ctx.fillRect(M, labelY - 12, 46, 5);
  ctx.font = `800 22px ${BODY}`;
  spaced(ctx, 'TOURNAMENT JOURNEY', M + 62, labelY, 5);
  ctx.font = `900 ${size}px ${DISPLAY}`;
  ctx.fillStyle = C.line;
  ctx.fillText(names[0], M, name1Y);
  ctx.fillStyle = C.gold;
  ctx.font = `900 ${Math.round(size * 0.5)}px ${DISPLAY}`;
  ctx.fillText('&', M, name2Y);
  ctx.font = `900 ${size}px ${DISPLAY}`;
  ctx.fillStyle = C.line;
  ctx.fillText(names[1], M + ampW0, name2Y);

  // Standing and record, inside the slab
  ctx.font = `900 56px ${DISPLAY}`;
  ctx.fillStyle = info.standingTone === 'gold' ? C.gold : info.standingTone === 'win' ? C.win : C.line;
  spaced(ctx, info.standing.toUpperCase(), M, standY, 2);
  ctx.font = `600 24px ${BODY}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(info.summary, M, summaryY);
  const bandY = edgeL - 100; // list starts below the slab edge (see top below)

  // Match list
  const top = edgeL + 50;
  const bottom = FOOT - 24;
  const n = Math.max(info.matches.length, 1);
  const rowH = Math.min(104, Math.floor((bottom - top) / n));
  info.matches.forEach((mt, i) => {
    const y = top + i * rowH;
    const h = rowH - 12;
    roundRect(ctx, M, y, maxW, h, 14);
    ctx.fillStyle = mt.knockout ? 'rgba(233,196,106,.10)' : 'rgba(255,255,255,.05)';
    ctx.fill();
    ctx.fillStyle = mt.knockout ? C.gold : C.win;
    ctx.fillRect(M, y + 10, 5, h - 20);
    const mid = y + h / 2;
    // code badge
    ctx.font = `900 ${Math.round(h * 0.42)}px ${DISPLAY}`;
    ctx.fillStyle = C.line;
    ctx.fillText(mt.code, M + 24, mid + h * 0.15);
    // stage + opponent
    const textX = M + 150;
    ctx.font = `700 ${Math.max(16, Math.round(h * 0.2))}px ${BODY}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(mt.stage.toUpperCase(), textX, mid - h * 0.1);
    ctx.font = `700 ${Math.max(20, Math.round(h * 0.29))}px ${BODY}`;
    ctx.fillStyle = C.line;
    let opp = `v ${mt.opp}`;
    const oppMax = maxW - 150 - 250;
    while (ctx.measureText(opp).width > oppMax && opp.length > 6) opp = `${opp.slice(0, -2)}…`;
    ctx.fillText(opp, textX, mid + h * 0.27);
    // outcome pill + score
    const pillW = 64;
    const pillH = Math.min(46, h * 0.5);
    const px = W - M - 24 - pillW;
    const colors = { W: [C.win, C.ink], L: ['rgba(238,243,239,.18)', C.line], LIVE: [C.live, '#fff'], NEXT: ['rgba(238,243,239,.10)', C.muted] };
    const [bg, fg] = colors[mt.outcome];
    roundRect(ctx, px, mid - pillH / 2, pillW, pillH, 10);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = `900 ${Math.round(pillH * 0.6)}px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText(mt.outcome === 'NEXT' ? '–' : mt.outcome === 'LIVE' ? 'LIVE' : mt.outcome, px + pillW / 2, mid + pillH * 0.22);
    ctx.textAlign = 'right';
    if (mt.score) {
      ctx.font = `900 ${Math.round(h * 0.4)}px ${DISPLAY}`;
      ctx.fillStyle = mt.outcome === 'W' ? C.win : C.line;
      ctx.fillText(mt.score, px - 18, mid + h * 0.12);
      if (mt.detail) {
        ctx.font = `600 ${Math.max(14, Math.round(h * 0.16))}px ${BODY}`;
        ctx.fillStyle = C.muted;
        ctx.fillText(mt.detail, px - 18, mid + h * 0.36);
      }
    } else {
      ctx.font = `600 ${Math.max(16, Math.round(h * 0.2))}px ${BODY}`;
      ctx.fillStyle = C.muted;
      ctx.fillText(mt.outcome === 'LIVE' ? 'In play' : 'Upcoming', px - 18, mid + 8);
    }
    ctx.textAlign = 'left';
  });
  if (!info.matches.length) {
    ctx.font = `600 28px ${BODY}`;
    ctx.fillStyle = C.muted;
    ctx.fillText('No matches yet.', M, top + 40);
  }

  drawFooter(ctx);
  return canvas;
}

let dialog;
function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'share-dialog';
  dialog.innerHTML = `
    <div class="share-head"><h2>Share result</h2><button type="button" class="btn btn-text" data-share-close>Close</button></div>
    <img alt="Result card" data-share-img>
    <div class="share-actions">
      <button type="button" class="btn btn-live" data-share-go hidden>Share image</button>
      <a class="btn btn-ghost" data-share-dl download="result.png">Download image</a>
    </div>
    <p class="share-note" data-share-note role="status"></p>`;
  document.body.append(dialog);
  dialog.querySelector('[data-share-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  return dialog;
}

/** Opens the preview dialog for any card builder. */
async function openCard(build, info, fileName, title, shareText) {
  const d = ensureDialog();
  d.querySelector('.share-head h2').textContent = title;
  const note = d.querySelector('[data-share-note]');
  note.textContent = 'Making the image…';
  d.querySelector('[data-share-img]').removeAttribute('src');
  d.showModal();
  const canvas = await build(info);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  d.querySelector('[data-share-img]').src = url;
  const dl = d.querySelector('[data-share-dl]');
  dl.href = url;
  dl.download = fileName;
  const file = new File([blob], fileName, { type: 'image/png' });
  const go = d.querySelector('[data-share-go]');
  const canShareFile = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  go.hidden = !canShareFile;
  note.textContent = canShareFile ? '' : 'Download the image, then post it anywhere.';
  go.onclick = async () => {
    try {
      await navigator.share({ files: [file], title: `${EVENT.fullName}`, text: shareText });
    } catch {
      /* the person closed the share sheet */
    }
  };
  return canvas;
}

export function openShare(info, fileName) {
  return openCard(buildResultImage, info, fileName, 'Share result', `${info.winnerPlayers.join(' & ')} win ${info.winScore}–${info.loseScore}`);
}

export function openTeamShare(info, fileName) {
  return openCard(buildTeamImage, info, fileName, 'Team journey', `${info.players.join(' & ')}: ${info.standing}. ${info.summary}`);
}
