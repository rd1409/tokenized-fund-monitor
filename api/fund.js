import { saveFund, fundExists } from '../lib/repo.js';
import { validateFund } from '../lib/validate.js';
import { send, requireAuth, readJson, errorMessage } from '../lib/http.js';

// POST /api/fund — record a fund's numbers for a date (adds a new fund if `name` is given).
// Requires `Authorization: Bearer <ADMIN_TOKEN>`.
//
// Body: { fund, as_of, nav, apy_7d_pct, apy_30d_pct, aum_usd, aum_chg_30d_pct, secondary_price,
//         holders, chains, networks?: [{network, supply_usd}], name?, manager?, platform?, mgmt_fee?, source? }
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' }, { Allow: 'POST' });
  if (!requireAuth(req, res, 'ADMIN_TOKEN')) return;
  let body;
  try { body = await readJson(req); } catch { return send(res, 400, { error: 'Body is not valid JSON.' }); }
  const { value, error } = validateFund(body);
  if (error) return send(res, 400, { error });
  try {
    if (!value.name && !(await fundExists(value.fund))) {
      return send(res, 400, { error: `${value.fund} isn't tracked yet. Include its name to add it.` });
    }
    await saveFund(value);
    send(res, 200, { ok: true, saved: { fund: value.fund, as_of: value.as_of } });
  } catch (e) {
    send(res, 500, { error: errorMessage(e) });
  }
}
