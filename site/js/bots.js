// Little agents living on the headline. They stand on the tops of the
// letters, walk along them, peek over edges, watch the cursor, and hop away or
// duck when it comes close. On touch screens a tap startles them instead.
//
// How they know where the letters are: each character's position comes from a
// DOM Range, the glyph is drawn at that spot on a canvas, and every pixel
// column is scanned for the top and bottom of the ink. A bot may stand at x
// when there is ink under its feet and nothing it would cover: no higher ink
// on its own line, and no line above reaching down into it. So they never sit
// on top of a letter's shape, only on its top edge. startBots returns cheer(),
// which makes them all hop for joy.

import { agentMarkup, agentParts, setFace, setEyes, ART, VIEW_W, VIEW_H } from './agent-art.js';

const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rand = (a, b) => a + Math.random() * (b - a);
const ease = (t) => t * t * (3 - 2 * t);

// Other agents on the page (the one on the terminal card) that only watch.
const watchers = [];
let cursor = null; // client coordinates of a mouse or pen, or null
let tap = null; // { x, y, until } for touch

addEventListener(
  'pointermove',
  (e) => {
    if (e.pointerType === 'touch') return;
    cursor = { x: e.clientX, y: e.clientY };
    requestWatchers();
  },
  { passive: true },
);
addEventListener('pointerout', (e) => {
  if (!e.relatedTarget) cursor = null;
});
addEventListener('blur', () => (cursor = null));

let watcherFrame = 0;
function requestWatchers() {
  if (watcherFrame) return;
  watcherFrame = requestAnimationFrame(() => {
    watcherFrame = 0;
    drawWatchers();
  });
}

// An agent that stays put and follows the cursor with its eyes.
export function watch(svg) {
  const parts = agentParts(svg);
  watchers.push({ svg, parts, lx: 0, ly: 0 });
  setFace(parts, 'open', 'smile');
  drawWatchers();
}

function drawWatchers() {
  for (const w of watchers) {
    const r = w.svg.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const ex = r.left + r.width * ((ART.pad.l + 60) / VIEW_W);
    const ey = r.top + r.height * ((ART.pad.t + 68) / VIEW_H);
    const target = cursor ?? { x: ex - 80, y: ey - 30 };
    const [lx, ly] = lookAt(ex, ey, target.x, target.y);
    setEyes(w.parts, lx, ly);
  }
}

function lookAt(x, y, tx, ty) {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy) || 1;
  const reach = clamp(d / 90, 0, 1);
  return [(dx / d) * reach, (dy / d) * reach];
}

export function startBots(wrap) {
  const title = wrap.querySelector('.title');
  const layer = wrap.querySelector('.bots');
  if (!title || !layer) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let geo = null;
  let bots = [];
  let raf = 0;
  let last = 0;
  let onscreen = true;

  // ---- Geometry ------------------------------------------------------------

  function measure() {
    const cs = getComputedStyle(title);
    const F = parseFloat(cs.fontSize);
    const box = layer.getBoundingClientRect();
    const W = Math.ceil(box.width);
    if (!W) return null;
    const padY = Math.ceil(F * 0.6);
    const Hc = Math.ceil(box.height) + padY * 2;
    canvas.width = W;
    canvas.height = Hc;
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${F}px ${cs.fontFamily}`;
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText('Hg');
    const asc = m.fontBoundingBoxAscent ?? F * 0.92;
    const desc = m.fontBoundingBoxDescent ?? F * 0.24;

    // Characters and the line each one is on.
    const lines = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent;
      for (let i = 0; i < text.length; i++) {
        if (/\s/.test(text[i])) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getClientRects()[0];
        if (!r || !r.width) continue;
        const baseline = r.top - box.top + (r.height - (asc + desc)) / 2 + asc;
        let line = lines.find((l) => Math.abs(l.baseline - baseline) < F * 0.4);
        if (!line) lines.push((line = { baseline, chars: [] }));
        line.chars.push({ ch: text[i], x: r.left - box.left });
      }
    }
    lines.sort((a, b) => a.baseline - b.baseline);

    for (const line of lines) {
      ctx.clearRect(0, 0, W, Hc);
      ctx.fillStyle = '#000';
      for (const c of line.chars) ctx.fillText(c.ch, c.x, line.baseline + padY);
      const data = ctx.getImageData(0, 0, W, Hc).data;
      line.top = new Float32Array(W).fill(Infinity);
      line.bottom = new Float32Array(W).fill(-Infinity);
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < Hc; y++) {
          if (data[(y * W + x) * 4 + 3] > 110) {
            line.top[x] = y - padY;
            break;
          }
        }
        if (line.top[x] === Infinity) continue;
        for (let y = Hc - 1; y >= 0; y--) {
          if (data[(y * W + x) * 4 + 3] > 110) {
            line.bottom[x] = y - padY;
            break;
          }
        }
      }
      line.left = line.chars[0]?.x ?? 0;
      line.right = W;
      for (let x = W - 1; x >= 0; x--) if (line.top[x] !== Infinity) { line.right = x; break; }
      for (let x = 0; x < W; x++) if (line.top[x] !== Infinity) { line.left = x; break; }
    }

    const h = clamp(F * 0.28, 18, 40); // bot height in px
    const w = h; // the art is square
    const feet = Math.max(4, Math.round(w * 0.34));
    const body = Math.round(w * 0.92);
    lines.forEach((line, li) => {
      line.sup = new Float32Array(W).fill(NaN);
      for (let x = 0; x < W; x++) {
        const f0 = x - (feet >> 1);
        const b0 = x - (body >> 1);
        if (b0 < 0 || b0 + body >= W) continue;
        let y = Infinity;
        let ink = 0;
        for (let c = f0; c < f0 + feet; c++) {
          if (line.top[c] !== Infinity) {
            ink++;
            if (line.top[c] < y) y = line.top[c];
          }
        }
        if (ink < feet * 0.6) continue;
        let clear = true;
        for (let c = b0; c < b0 + body && clear; c++) {
          if (line.top[c] < y - 1.5) clear = false;
          for (let up = 0; up < li && clear; up++) if (lines[up].bottom[c] > y - h - 4) clear = false;
        }
        if (clear) line.sup[x] = y;
      }
      // Edges worth peeking over: the end of a walkable stretch with a drop
      // (a gap between words, or a lower letter) beyond it.
      line.edges = [];
      for (let x = 1; x < W - 1; x++) {
        if (Number.isNaN(line.sup[x])) continue;
        for (const dir of [-1, 1]) {
          const n = line.sup[x + dir];
          if (!Number.isNaN(n) && Math.abs(n - line.sup[x]) <= 2) continue;
          const beyond = x + dir * ((feet >> 1) + 4);
          const t = line.top[beyond] ?? Infinity;
          if (t > line.sup[x] + h * 0.3) line.edges.push({ x, dir });
        }
      }
      line.spots = [];
      for (let x = 0; x < W; x++) if (!Number.isNaN(line.sup[x])) line.spots.push(x);
    });

    return { F, W, h, w, feet, body, lines: lines.filter((l) => l.spots.length) };
  }

  const walkable = (line, a, b) => {
    const ya = line.sup[a];
    const yb = line.sup[b];
    return !Number.isNaN(ya) && !Number.isNaN(yb) && Math.abs(ya - yb) <= 2.5;
  };

  function nearestSpot(line, x) {
    let best = null;
    for (const s of line.spots) if (best === null || Math.abs(s - x) < Math.abs(best - x)) best = s;
    return best;
  }

  const crowded = (b, x, gap = geo.body * 1.15) =>
    bots.some((o) => o !== b && o.line === b.line && (Math.abs(o.x - x) < gap || (o.hop && Math.abs(o.hop.x1 - x) < gap)));
  // Another bot in the way, ahead in the direction of travel.
  const blockedAhead = (b, dir) =>
    bots.some((o) => o !== b && o.line === b.line && (o.x - b.x) * dir > 0 && Math.abs(o.x - b.x) < geo.body * 1.2);

  // ---- Bots ----------------------------------------------------------------

  function makeBot(lineIndex, frac, i) {
    const line = geo.lines[lineIndex];
    const holder = document.createElement('div');
    holder.innerHTML = agentMarkup('bot');
    const svg = holder.firstElementChild;
    layer.append(svg);
    const span = line.right - line.left;
    const home = nearestSpot(line, line.left + span * frac);
    const b = {
      svg,
      parts: agentParts(svg),
      line: lineIndex,
      x: home,
      y: line.sup[home],
      home,
      state: 'enter',
      timer: 0.5 + i * 0.42,
      vy: 0,
      drop: -geo.h * 4,
      lean: 0,
      leanT: 0,
      sq: 1,
      sqV: 0,
      sqT: 1,
      ant: 0,
      antV: 0,
      bob: 0,
      phase: Math.random() * 6,
      lx: 0,
      ly: 0,
      idleLook: [rand(-0.6, 0.6), rand(-0.2, 0.5)],
      idleLookUntil: 0,
      blinkAt: performance.now() + rand(1500, 4000),
      blinkUntil: 0,
      calm: 0,
      mood: null,
      moodUntil: 0,
      hop: null,
      after: 'idle',
      peekDir: 0,
      target: null,
      pendingPeek: 0,
    };
    svg.style.width = `${(geo.h * VIEW_W) / ART.size}px`;
    svg.style.height = `${(geo.h * VIEW_H) / ART.size}px`;
    svg.style.opacity = '0';
    return b;
  }

  function plan() {
    const narrow = geo.W < 520;
    const two = geo.lines.length > 1;
    const list = narrow
      ? two ? [[0, 0.3], [1, 0.62]] : [[0, 0.3], [0, 0.75]]
      : two ? [[0, 0.24], [0, 0.74], [1, 0.52]] : [[0, 0.2], [0, 0.55], [0, 0.85]];
    return list;
  }

  function build(keep) {
    const old = bots;
    layer.replaceChildren();
    bots = [];
    geo = measure();
    if (!geo || !geo.lines.length) return;
    plan().forEach(([li, frac], i) => {
      const lineIndex = Math.min(li, geo.lines.length - 1);
      const b = makeBot(lineIndex, frac, i);
      const prev = keep && old[i];
      if (prev && prev.state !== 'enter') {
        // Keep the bot where it was, as a share of the headline's width.
        const line = geo.lines[b.line];
        const x = nearestSpot(line, (prev.x / prev.W) * geo.W);
        Object.assign(b, { x, y: line.sup[x], state: 'idle', timer: rand(0.5, 2) });
        b.svg.style.opacity = '1';
      }
      b.W = geo.W;
      bots.push(b);
    });
    if (reduceQuery.matches) {
      for (const b of bots) {
        b.state = 'still';
        b.svg.style.opacity = '1';
      }
    }
    bots.forEach(draw);
  }

  function hopTo(b, x1, { after = 'idle', lift = 0.5, quick = false } = {}) {
    const line = geo.lines[b.line];
    const y1 = Number.isNaN(line.sup[x1]) ? b.y : line.sup[x1];
    const dx = Math.abs(x1 - b.x);
    const dur = clamp((quick ? 0.2 : 0.28) + dx / (geo.w * (quick ? 9 : 6)), 0.22, 0.7);
    const H = Math.abs(y1 - b.y) / 2 + geo.h * lift;
    b.hop = { x0: b.x, y0: b.y, x1, y1, t: 0, dur, H };
    b.state = 'hop';
    b.after = after;
    b.sqV -= 3;
    b.antV += 260 * Math.sign(x1 - b.x || 1);
  }

  function landingBeyond(b, from, dir, max) {
    const line = geo.lines[b.line];
    for (let x = from + dir; Math.abs(x - from) <= max; x += dir) {
      if (x < 0 || x >= geo.W) return null;
      if (Number.isNaN(line.sup[x])) continue;
      // Land a little way into the stretch, not on its very edge.
      let land = x;
      for (let k = 1; k < geo.feet && !Number.isNaN(line.sup[x + dir * k]); k++) land = x + dir * k;
      return crowded(b, land) ? null : land;
    }
    return null;
  }

  function fleeSpot(b, dir, cur, R) {
    const line = geo.lines[b.line];
    let best = null;
    let bestD = -1;
    const min = geo.w * 0.7;
    const max = geo.w * 3.4;
    for (let x = Math.round(b.x + dir * min); Math.abs(x - b.x) <= max; x += dir) {
      if (x < 0 || x >= geo.W) break;
      if (Number.isNaN(line.sup[x]) || crowded(b, x)) continue;
      const d = Math.hypot(x - cur.x, line.sup[x] - geo.h / 2 - cur.y);
      if (d > bestD) {
        best = x;
        bestD = d;
      }
    }
    return bestD > R * 0.9 || (best !== null && bestD > Math.hypot(b.x - cur.x, b.y - cur.y) + geo.w) ? best : null;
  }

  function chooseNext(b, cur, R) {
    const line = geo.lines[b.line];
    const roll = Math.random();
    const far = (x) => !cur || Math.hypot(x - cur.x, line.sup[x] - cur.y) > R * 1.6;
    if (roll < 0.28 && line.edges.length) {
      const options = line.edges.filter((e) => Math.abs(e.x - b.x) < geo.W * 0.5 && far(e.x) && !crowded(b, e.x));
      const e = options[Math.floor(Math.random() * options.length)];
      if (e) {
        b.target = e.x;
        b.pendingPeek = e.dir;
        b.state = 'walk';
        return;
      }
    }
    if (roll < 0.78) {
      for (let tries = 0; tries < 12; tries++) {
        const x = line.spots[Math.floor(Math.random() * line.spots.length)];
        if (Math.abs(x - b.x) > geo.w && Math.abs(x - b.x) < geo.W * 0.45 && far(x) && !crowded(b, x)) {
          b.target = x;
          b.pendingPeek = 0;
          b.state = 'walk';
          return;
        }
      }
    }
    b.idleLook = [rand(-0.9, 0.9), rand(-0.4, 0.8)];
    b.timer = rand(1.4, 3.2);
    b.state = 'idle';
  }

  function react(b, cur, R) {
    const dir = Math.sign(b.x - cur.x) || (Math.random() < 0.5 ? -1 : 1);
    const spot = fleeSpot(b, dir, cur, R) ?? fleeSpot(b, -dir, cur, R);
    b.lean = 0;
    b.leanT = 0;
    if (spot !== null && Math.random() < 0.75) {
      b.mood = ['wide', 'o', true];
      b.moodUntil = performance.now() + 700;
      hopTo(b, spot, { after: 'flee', lift: 0.7, quick: true });
    } else {
      b.state = 'duck';
      b.calm = 0;
      b.sqT = 0.56;
    }
  }

  function setMood(b, now) {
    if (b.mood && now < b.moodUntil) return setFace(b.parts, ...b.mood);
    b.mood = null;
    switch (b.state) {
      case 'duck': return setFace(b.parts, 'shut', 'flat');
      case 'flee':
      case 'wary': return setFace(b.parts, 'wide', 'o', true);
      case 'peek': return setFace(b.parts, 'open', 'o');
      case 'hop': return setFace(b.parts, b.after === 'flee' ? 'wide' : 'open', b.after === 'flee' ? 'o' : 'smile', b.after === 'flee');
      default: return setFace(b.parts, 'open', 'smile');
    }
  }

  function think(b, dt, cur, now) {
    const line = geo.lines[b.line];
    const R = Math.max(70, geo.h * 2.5);
    const cy = b.y - geo.h * 0.5;
    const d = cur ? Math.hypot(cur.x - b.x, cur.y - cy) : Infinity;
    const free = b.state === 'idle' || b.state === 'walk' || b.state === 'peek' || b.state === 'wary';

    if (tap && now < tap.until && free) {
      const td = Math.hypot(tap.x - b.x, tap.y - cy);
      if (td < R * 1.3 && !tap.hit.has(b)) {
        tap.hit.add(b);
        b.mood = ['wide', 'o', true];
        b.moodUntil = now + 800;
        const dir = Math.sign(b.x - tap.x) || 1;
        const spot = fleeSpot(b, dir, tap, R * 0.6);
        if (spot !== null) hopTo(b, spot, { after: 'idle', lift: 0.8, quick: true });
        else hopTo(b, Math.round(b.x), { after: 'idle', lift: 0.9 });
        return;
      }
    }

    if (free && d < R) return react(b, cur, R);

    switch (b.state) {
      case 'enter': {
        b.timer -= dt;
        if (b.timer > 0) return;
        b.svg.style.opacity = '1';
        b.vy += 2600 * dt;
        b.drop = Math.min(0, b.drop + b.vy * dt);
        if (b.drop === 0) {
          b.sq = 0.62;
          b.sqV = 0;
          b.antV += 300;
          b.mood = ['happy', 'smile', false];
          b.moodUntil = now + 900;
          b.state = 'idle';
          b.timer = rand(1, 2.5);
        }
        return;
      }
      case 'idle':
        b.leanT = 0;
        b.timer -= dt;
        if (b.timer <= 0) chooseNext(b, cur, R);
        return;
      case 'wary':
        b.leanT = 0;
        if (d > R * 1.6) b.calm += dt;
        else b.calm = 0;
        if (b.calm > 1.2) {
          b.target = crowded(b, b.home) ? null : b.home;
          b.pendingPeek = 0;
          b.state = b.target !== null && Math.abs(b.target - b.x) > 2 ? 'walk' : 'idle';
          b.timer = rand(0.8, 2);
        }
        return;
      case 'flee':
        // Between hops: keep going while the cursor is still close.
        if (d < R * 1.3) {
          const dir = Math.sign(b.x - cur.x) || 1;
          const spot = fleeSpot(b, dir, cur, R);
          if (spot !== null) return hopTo(b, spot, { after: 'flee', lift: 0.6, quick: true });
          b.state = 'duck';
          b.calm = 0;
          b.sqT = 0.56;
          return;
        }
        b.state = 'wary';
        b.calm = 0;
        return;
      case 'duck':
        b.sqT = 0.56;
        b.leanT = 0;
        if (d > R * 1.2) b.calm += dt;
        else b.calm = 0;
        if (b.calm > 0.35) {
          b.sqT = 1;
          b.mood = ['happy', 'smile', false];
          b.moodUntil = now + 700;
          hopTo(b, Math.round(b.x), { after: 'wary', lift: 0.35 });
          b.calm = 0;
        }
        return;
      case 'peek':
        b.leanT = b.peekDir * 18;
        b.timer -= dt;
        if (b.timer <= 0) {
          b.leanT = 0;
          b.state = 'idle';
          b.timer = rand(0.8, 2.2);
        }
        return;
      case 'hop': {
        const hp = b.hop;
        hp.t = Math.min(1, hp.t + dt / hp.dur);
        const e = ease(hp.t);
        b.x = hp.x0 + (hp.x1 - hp.x0) * e;
        b.y = hp.y0 + (hp.y1 - hp.y0) * e - hp.H * 4 * hp.t * (1 - hp.t);
        b.lean = b.leanT = Math.sign(hp.x1 - hp.x0) * 10 * Math.sin(hp.t * Math.PI);
        if (hp.t >= 1) {
          b.x = hp.x1;
          b.y = hp.y1;
          b.hop = null;
          b.sq = 0.72;
          b.sqV = 0;
          b.lean = b.leanT = 0;
          b.state = b.after;
          b.calm = 0;
          if (b.state === 'idle') b.timer = rand(0.8, 2);
          if (b.state === 'walk' && b.target === null) b.state = 'idle';
        }
        return;
      }
      case 'walk': {
        if (b.target === null) {
          b.state = 'idle';
          return;
        }
        const dir = Math.sign(b.target - b.x);
        let move = geo.w * 1.5 * dt;
        while (move > 0) {
          const cx = Math.round(b.x);
          const nx = cx + dir;
          if (Math.abs(b.target - b.x) <= 1) {
            b.x = b.target;
            b.target = null;
            if (b.pendingPeek) {
              b.state = 'peek';
              b.peekDir = b.pendingPeek;
              b.timer = rand(1.1, 1.9);
            } else {
              b.state = 'idle';
              b.timer = rand(1, 3);
            }
            break;
          }
          if (blockedAhead(b, dir)) {
            b.target = null;
            b.state = 'idle';
            b.timer = rand(0.6, 1.6);
            break;
          }
          if (!walkable(line, cx, nx)) {
            const land = landingBeyond(b, cx, dir, geo.w * 3);
            if (land !== null && (dir > 0 ? land <= b.target + geo.w * 2 : land >= b.target - geo.w * 2)) {
              hopTo(b, land, { after: 'walk' });
            } else {
              b.target = null;
              b.state = 'idle';
              b.timer = rand(1, 2);
            }
            break;
          }
          const step = Math.min(1, move);
          b.x += dir * step;
          move -= step;
        }
        if (b.state === 'walk') {
          const sup = line.sup[Math.round(b.x)];
          if (!Number.isNaN(sup)) b.y += (sup - b.y) * clamp(dt * 25, 0, 1);
          b.phase += dt * 11;
          b.leanT = Math.sin(b.phase) * 7;
          b.bob = Math.abs(Math.sin(b.phase)) * 5;
        }
        return;
      }
    }
  }

  function look(b, cur, now) {
    // Eyes sit at (60, 68) of 120: a bit above the middle of the bot.
    const ex = b.x;
    const ey = b.y - geo.h * (52 / 120);
    let target = cur;
    if (b.state === 'peek' && b.timer > 0.4) return [b.peekDir * 0.8, 0.95];
    if (!target && tap && now < tap.until) target = tap;
    if (target) return lookAt(ex, ey, target.x, target.y);
    if (now > b.idleLookUntil) {
      b.idleLookUntil = now + rand(1200, 3200);
      const other = bots.find((o) => o !== b && Math.random() < 0.35);
      b.idleLook = other ? lookAt(ex, ey, other.x, other.y - geo.h / 2) : [rand(-0.9, 0.9), rand(-0.3, 0.8)];
    }
    return b.idleLook;
  }

  function step(b, dt, cur, now) {
    // Springs for squash and the antenna, a soft follow for lean.
    b.sqV += ((b.sqT - b.sq) * 320 - b.sqV * 16) * dt;
    b.sq += b.sqV * dt;
    b.antV += (-b.ant * 260 - b.antV * 9) * dt;
    b.ant += b.antV * dt;
    b.lean += (b.leanT - b.lean) * clamp(dt * 10, 0, 1);
    if (b.state !== 'walk') b.bob += (0 - b.bob) * clamp(dt * 12, 0, 1);

    const [lx, ly] = look(b, cur, now);
    const k = clamp(dt * 14, 0, 1);
    b.lx += (lx - b.lx) * k;
    b.ly += (ly - b.ly) * k;
    if (now > b.blinkAt) {
      b.blinkUntil = now + 130;
      b.blinkAt = now + rand(2200, 5600);
    }
    setMood(b, now);
    const wide = b.parts.face.startsWith('wide');
    setEyes(b.parts, b.lx, b.ly, now < b.blinkUntil ? 0.1 : 1, wide);
  }

  function draw(b) {
    const s = geo.h / ART.size;
    const ox = (ART.pad.l + ART.footX) * s;
    const oy = (ART.pad.t + ART.footY) * s;
    const peekShift = b.state === 'peek' ? b.peekDir * geo.w * 0.08 * Math.min(1, Math.abs(b.lean) / 18) : 0;
    const y = b.y + (b.state === 'enter' ? b.drop : 0);
    b.svg.style.transform = `translate3d(${(b.x - ox + peekShift).toFixed(2)}px, ${(y - oy).toFixed(2)}px, 0)`;
    const sy = clamp(b.sq, 0.45, 1.25);
    const sx = 1 + (1 - sy) * 0.55;
    b.parts.pose.setAttribute(
      'transform',
      `translate(60 120) rotate(${b.lean.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-60 ${(-120 - b.bob).toFixed(2)})`,
    );
    b.parts.antenna.setAttribute('transform', `rotate(${clamp(b.ant, -35, 35).toFixed(2)} 60 30)`);
  }

  // ---- Loop ----------------------------------------------------------------

  function frame(now) {
    raf = 0;
    if (!geo) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    const box = layer.getBoundingClientRect();
    const cur = cursor ? { x: cursor.x - box.left, y: cursor.y - box.top } : null;
    if (tap && !tap.local) Object.assign(tap, { x: tap.cx - box.left, y: tap.cy - box.top, local: true });
    for (const b of bots) think(b, dt, cur, now);
    for (const b of bots) {
      step(b, dt, cur, now);
      draw(b);
    }
    if (tap && now > tap.until) tap = null;
    schedule();
  }

  function schedule() {
    if (raf || !onscreen || document.hidden) return;
    if (reduceQuery.matches) return;
    raf = requestAnimationFrame(frame);
  }

  function stillFrame() {
    // Reduced motion: they stand still; only their eyes follow the cursor.
    if (!geo) return;
    const box = layer.getBoundingClientRect();
    const cur = cursor ? { x: cursor.x - box.left, y: cursor.y - box.top } : null;
    for (const b of bots) {
      const [lx, ly] = cur ? lookAt(b.x, b.y - geo.h * 0.43, cur.x, cur.y) : [0, 0.2];
      setFace(b.parts, 'open', 'smile');
      setEyes(b.parts, lx, ly);
      draw(b);
    }
  }

  addEventListener(
    'pointermove',
    () => {
      if (reduceQuery.matches) requestAnimationFrame(stillFrame);
    },
    { passive: true },
  );

  addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return;
      cursor = null;
      const r = wrap.getBoundingClientRect();
      const pad = 80;
      if (e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) return;
      tap = { cx: e.clientX, cy: e.clientY, until: performance.now() + 1800, hit: new Set() };
      schedule();
    },
    { passive: true },
  );

  new IntersectionObserver(([entry]) => {
    onscreen = entry.isIntersecting;
    last = 0;
    schedule();
  }).observe(wrap);
  document.addEventListener('visibilitychange', () => {
    last = 0;
    schedule();
  });
  reduceQuery.addEventListener?.('change', () => {
    build(true);
    if (reduceQuery.matches) stillFrame();
    else schedule();
  });

  let resizeTimer;
  let lastWidth = 0;
  new ResizeObserver(() => {
    const width = Math.round(wrap.getBoundingClientRect().width);
    if (width === lastWidth) return;
    lastWidth = width;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      build(bots.length > 0);
      if (reduceQuery.matches) stillFrame();
      schedule();
    }, 120);
  }).observe(wrap);

  const fontReady = document.fonts
    ? Promise.race([document.fonts.load(`600 100px ${getComputedStyle(title).fontFamily}`).then(() => document.fonts.ready), new Promise((r) => setTimeout(r, 2500))])
    : Promise.resolve();
  fontReady.then(() => {
    lastWidth = Math.round(wrap.getBoundingClientRect().width);
    build(false);
    if (reduceQuery.matches) stillFrame();
    schedule();
  });

  // For checking the skyline: ?bots=debug draws where they may stand.
  if (new URLSearchParams(location.search).get('bots') === 'debug') {
    window.__bots = { get geo() { return geo; }, get bots() { return bots; } };
  }

  // Get started, or a copied prompt: each one hops on the spot, happy.
  function cheer() {
    if (!geo || reduceQuery.matches) return;
    bots.forEach((b, i) => {
      setTimeout(() => {
        if (!['idle', 'walk', 'peek', 'wary'].includes(b.state)) return;
        b.mood = ['happy', 'smile'];
        b.moodUntil = performance.now() + 900;
        b.lean = 0;
        b.leanT = 0;
        hopTo(b, Math.round(b.x), { lift: 1.2 });
        schedule();
      }, i * 120);
    });
  }
  return { cheer };
}
