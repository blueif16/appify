// /api/comments: list, add, resolve and delete comments for the studio UI.

import { addComment, readComments, removeComment, updateComment } from '../comments.js';

export default async function commentRoutes({ cwd, json, readBody }) {
  return async (req, res, url) => {
    const match = url.pathname.match(/^\/api\/comments(?:\/([\w-]+))?$/);
    if (!match) return false;
    const id = match[1];

    try {
      if (!id && req.method === 'GET') json(res, await readComments(cwd));
      else if (!id && req.method === 'POST') json(res, await addComment(cwd, JSON.parse(await readBody(req))), 201);
      else if (id && req.method === 'PATCH') {
        const comment = await updateComment(cwd, id, JSON.parse(await readBody(req)));
        comment ? json(res, comment) : json(res, { error: `No comment ${id}.` }, 404);
      } else if (id && req.method === 'DELETE') {
        (await removeComment(cwd, id)) ? json(res, { ok: true }) : json(res, { error: `No comment ${id}.` }, 404);
      } else json(res, { error: 'Not supported.' }, 405);
    } catch (err) {
      json(res, { error: err.message }, 400);
    }
    return true;
  };
}
