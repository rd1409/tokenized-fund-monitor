import { readAll } from '../lib/repo.js';
import { send, errorMessage } from '../lib/http.js';

// GET /api/data — everything the page needs, in one call.
export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Use GET' }, { Allow: 'GET' });
  try {
    const data = await readAll();
    // Cache at Vercel's edge for 5 minutes; serve stale for up to a day while it refreshes.
    send(res, 200, data, { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' });
  } catch (e) {
    const msg = errorMessage(e);
    const hint = /no such table/i.test(msg)
      ? 'The database has no tables yet. Open /admin and click "Set up database".'
      : /TURSO_DATABASE_URL/.test(msg) ? 'Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel, then redeploy.' : undefined;
    send(res, 500, { error: msg, hint }, { 'Cache-Control': 'no-store' });
  }
}
