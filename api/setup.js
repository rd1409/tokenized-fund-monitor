import { setupDb } from '../lib/repo.js';
import { send, requireAuth, errorMessage } from '../lib/http.js';

// POST /api/setup — creates the tables and loads the starting data. Safe to run again:
// existing rows are never overwritten. Requires `Authorization: Bearer <ADMIN_TOKEN>`.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' }, { Allow: 'POST' });
  if (!requireAuth(req, res, 'ADMIN_TOKEN')) return;
  try {
    const counts = await setupDb();
    send(res, 200, { ok: true, counts });
  } catch (e) {
    send(res, 500, { error: errorMessage(e) });
  }
}
