// Comments left in the studio, stored in <project>/.appify/comments.json so
// any coding agent can read them, with or without the studio running.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const commentsFile = (cwd) => path.join(cwd, '.appify', 'comments.json');

export async function readComments(cwd) {
  try {
    const data = JSON.parse(await readFile(commentsFile(cwd), 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// Writes go one at a time so two quick saves can't overwrite each other.
let queue = Promise.resolve();
function change(cwd, fn) {
  const run = queue.then(async () => {
    const list = await readComments(cwd);
    const result = fn(list);
    const file = commentsFile(cwd);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(`${file}.tmp`, `${JSON.stringify(list, null, 2)}\n`);
    await rename(`${file}.tmp`, file);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

export function addComment(cwd, input) {
  const text = String(input.text ?? '').trim().slice(0, 2000);
  if (!text) throw new Error('A comment needs some text.');
  return change(cwd, (list) => {
    const next = Math.max(0, ...list.map((c) => Number(String(c.id).slice(1)) || 0)) + 1;
    const comment = {
      id: `c${next}`,
      createdAt: new Date().toISOString(),
      status: 'open',
      text,
      page: String(input.page ?? '/'),
      device: input.device,
      mode: input.mode,
      viewport: input.viewport,
      element: input.element,
    };
    list.push(comment);
    return comment;
  });
}

// Only the status and text can change.
export function updateComment(cwd, id, patch) {
  return change(cwd, (list) => {
    const comment = list.find((c) => c.id === id);
    if (!comment) return null;
    if (patch.status === 'open' || patch.status === 'resolved') comment.status = patch.status;
    if (typeof patch.text === 'string' && patch.text.trim()) comment.text = patch.text.trim().slice(0, 2000);
    return comment;
  });
}

export function removeComment(cwd, id) {
  return change(cwd, (list) => {
    const at = list.findIndex((c) => c.id === id);
    if (at === -1) return false;
    list.splice(at, 1);
    return true;
  });
}
