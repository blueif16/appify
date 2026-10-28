// "Works with": the coding agents that can run the setup prompt, scrolling
// sideways. The same design as VAS web's LogoMarquee: two identical rows
// moving translateX(0 → -50%), linear, paused on hover, edges faded. Each row
// carries trailing padding equal to the gap, so the loop has no seam.
import { AGENTS } from './agents.js';

const SVG = 'http://www.w3.org/2000/svg';

function row(hidden) {
  const list = document.createElement('ul');
  list.className = 'marquee-row';
  if (hidden) list.setAttribute('aria-hidden', 'true');
  for (const agent of AGENTS) {
    const mark = document.createElementNS(SVG, 'svg');
    mark.setAttribute('viewBox', agent.viewBox);
    mark.setAttribute('aria-hidden', 'true');
    if (agent.evenOdd) mark.setAttribute('fill-rule', 'evenodd');
    for (const d of agent.paths) {
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('d', d);
      mark.append(path);
    }
    const name = document.createElement('span');
    name.textContent = agent.name;
    const item = document.createElement('li');
    item.append(mark, name);
    list.append(item);
  }
  return list;
}

export function startMarquee(el) {
  const track = document.createElement('div');
  track.className = 'marquee-track';
  track.append(row(false), row(true));
  el.append(track);
}
