// GET /api/network      -> { profile, profiles }
// POST /api/network     { profile: 'fast' | 'slow-4g' } -> takes effect on the next request
import { NETWORK_PROFILES, network } from '../proxy.js';

export default async function create(ctx) {
  return async (req, res, url) => {
    if (url.pathname !== '/api/network') return false;
    if (req.method === 'POST') {
      let profile;
      try {
        ({ profile } = JSON.parse(await ctx.readBody(req)));
      } catch {}
      if (!(profile in NETWORK_PROFILES)) {
        ctx.json(res, { error: `Unknown network profile. Use one of: ${Object.keys(NETWORK_PROFILES).join(', ')}.` }, 400);
        return true;
      }
      network.profile = profile;
    }
    ctx.json(res, { profile: network.profile, profiles: Object.keys(NETWORK_PROFILES) });
    return true;
  };
}
