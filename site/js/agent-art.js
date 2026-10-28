// The studio's agent sticker (studio/ui/stickers/agent.svg), drawn in the same
// units: a holo shell with ears, an antenna with a pink tip, and a dark visor.
// The studio draws the face live on a canvas; here the face is made of SVG
// parts the page can move: pupils, lids, mouth and brows.
//
// Units: the art spans 0..120 across and 0..120 down to the bottom of the
// shell, so the point it stands on is (60, 120).

export const ART = { size: 120, footX: 60, footY: 120, pad: { l: 16, t: 10, r: 16, b: 10 } };
const { pad } = ART;
export const VIEW_W = ART.size + pad.l + pad.r;
export const VIEW_H = ART.size + pad.t + pad.b;

// Eye centres, as in the studio's stickers.js.
export const EYES = [
  [48, 68],
  [72, 68],
];

const eye = ([x, y], side) => `
  <g class="a-eye" transform="translate(${x} ${y})">
    <g class="e-open">
      <rect x="-6" y="-8.4" width="12" height="16.8" rx="6" fill="#f5f5f7"/>
      <g class="e-pupil"><circle r="3.7" fill="#1d1d1f"/><circle cx="-1.4" cy="-1.6" r="1.05" fill="#fff"/></g>
    </g>
    <g fill="none" stroke="#f5f5f7" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <path class="e-happy" d="M-5 1.5A5.6 5.6 0 0 1 5 1.5" display="none"/>
      <path class="e-shut" d="M-5.6 1Q0 3.8 5.6 1" display="none"/>
      <path class="e-squeeze" d="M${-side * 4.8} -4.8L${side * 4} 0L${-side * 4.8} 4.8" display="none"/>
    </g>
  </g>`;

export function agentMarkup(className = '') {
  return `<svg class="${className}" viewBox="${-pad.l} ${-pad.t} ${VIEW_W} ${VIEW_H}" aria-hidden="true" focusable="false">
  <g filter="url(#die-cut)">
    <g class="a-pose">
      <g class="a-antenna">
        <path d="M60 30V16" stroke="#1d1d1f" stroke-width="4" stroke-linecap="round"/>
        <circle cx="60" cy="11" r="7" fill="#ffd6ea" stroke="#1d1d1f" stroke-width="4"/>
      </g>
      <rect x="4" y="58" width="14" height="30" rx="5" fill="#e5e5ea" stroke="#1d1d1f" stroke-width="4"/>
      <rect x="102" y="58" width="14" height="30" rx="5" fill="#e5e5ea" stroke="#1d1d1f" stroke-width="4"/>
      <rect x="14" y="30" width="92" height="88" rx="30" fill="url(#agent-shell)" stroke="#1d1d1f" stroke-width="4"/>
      <rect x="14" y="30" width="92" height="88" rx="30" fill="url(#agent-gloss)"/>
      <rect x="25" y="46" width="70" height="50" rx="20" fill="url(#agent-visor)" stroke="#1d1d1f" stroke-width="3"/>
      <path d="M35 54c6-3 13-4 21-4" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="52" y="104" width="16" height="5" rx="2.5" fill="#1d1d1f"/>
      <g class="a-brows" fill="none" stroke="#1d1d1f" stroke-width="3" stroke-linecap="round" display="none">
        <path d="M41.6 39.5H52.8"/><path d="M78.4 39.5H67.2"/>
      </g>
      ${eye(EYES[0], 1)}${eye(EYES[1], -1)}
      <g class="a-mouth" fill="none" stroke="#f5f5f7" stroke-width="3" stroke-linecap="round">
        <path class="m-smile" d="M53.5 82.5Q60 88 66.5 82.5"/>
        <ellipse class="m-o" cx="60" cy="84" rx="3" ry="3.4" fill="#f5f5f7" stroke="none" display="none"/>
        <path class="m-flat" d="M54 84H66" display="none"/>
      </g>
    </g>
  </g>
</svg>`;
}

// Handles to the parts of one rendered agent, and a face setter that only
// touches the DOM when something changes.
export function agentParts(svg) {
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const parts = {
    pose: q('.a-pose'),
    antenna: q('.a-antenna'),
    brows: q('.a-brows'),
    open: qa('.e-open'),
    pupils: qa('.e-pupil'),
    happy: qa('.e-happy'),
    shut: qa('.e-shut'),
    squeeze: qa('.e-squeeze'),
    smile: q('.m-smile'),
    o: q('.m-o'),
    flat: q('.m-flat'),
    face: '',
  };
  return parts;
}

const show = (el, on) => el.setAttribute('display', on ? 'inline' : 'none');

// eyes: open | wide | happy | shut | squeeze. mouth: smile | o | flat.
export function setFace(parts, eyes, mouth, brows = false) {
  const key = `${eyes}|${mouth}|${brows}`;
  if (parts.face === key) return;
  parts.face = key;
  const open = eyes === 'open' || eyes === 'wide';
  parts.open.forEach((g) => show(g, open));
  parts.happy.forEach((p) => show(p, eyes === 'happy'));
  parts.shut.forEach((p) => show(p, eyes === 'shut'));
  parts.squeeze.forEach((p) => show(p, eyes === 'squeeze'));
  show(parts.smile, mouth === 'smile');
  show(parts.o, mouth === 'o');
  show(parts.flat, mouth === 'flat');
  show(parts.brows, brows);
}

// lx, ly in -1..1: where the pupils look. lid in 0..1: 1 open, 0 closed.
export function setEyes(parts, lx, ly, lid = 1, wide = false) {
  const px = (lx * 2.3).toFixed(2);
  const py = (ly * 3.6).toFixed(2);
  parts.pupils.forEach((p) => p.setAttribute('transform', `translate(${px} ${py})`));
  const sx = wide ? 1.16 : 1;
  const sy = (wide ? 1.1 : 1) * Math.max(0.12, lid);
  parts.open.forEach((g) => g.setAttribute('transform', `scale(${sx} ${sy.toFixed(3)})`));
}
