import { fetchRecent } from '../../lib/treasury.js';
import { upsertTbills, logRefresh } from '../../lib/repo.js';
import { send, requireAuth, errorMessage } from '../../lib/http.js';

// GET /api/cron/tbills — pulls the last two months of Treasury bill rates into the database.
// Vercel Cron calls it on weekdays (see vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
// The admin page can also trigger it with ADMIN_TOKEN.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, { error: 'Use GET' }, { Allow: 'GET, POST' });
  if (!requireAuth(req, res, 'CRON_SECRET', 'ADMIN_TOKEN')) return;
  try {
    const rows = await fetchRecent();
    if (!rows.length) throw new Error('Treasury returned no bill rates.');
    const n = await upsertTbills(rows);
    const latest = rows.at(-1).date;
    await logRefresh('tbills', true, `${n} days through ${latest}`);
    send(res, 200, { ok: true, days: n, latest });
  } catch (e) {
    const msg = errorMessage(e);
    await logRefresh('tbills', false, msg).catch(() => {});
    send(res, 502, { error: msg });
  }
}
