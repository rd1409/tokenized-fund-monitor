import { SNAPSHOT_FIELDS } from './schema.js';

const NUMERIC = new Set(SNAPSHOT_FIELDS);
const INTEGER = new Set(['holders', 'chains']);
const TEXT = ['name', 'manager', 'platform', 'mgmt_fee', 'source'];

// Checks and normalises a fund update. Returns {value} or {error}.
export function validateFund(input) {
  if (!input || typeof input !== 'object') return { error: 'Send a JSON object.' };
  const fund = String(input.fund || '').trim().toUpperCase();
  if (!/^[A-Z0-9._-]{1,20}$/.test(fund)) return { error: 'fund must be a ticker of 1–20 letters, digits, dot, dash or underscore.' };
  const as_of = String(input.as_of || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(as_of) || Number.isNaN(Date.parse(as_of + 'T00:00:00Z'))) return { error: 'as_of must be a date like 2026-10-11.' };

  const out = { fund, as_of };
  for (const k of NUMERIC) {
    const raw = input[k];
    if (raw === undefined || raw === null || raw === '') { out[k] = null; continue; }
    const n = Number(typeof raw === 'string' ? raw.replace(/[,$%\s]/g, '') : raw);
    if (!Number.isFinite(n)) return { error: `${k} must be a number.` };
    if (INTEGER.has(k) && !Number.isInteger(n)) return { error: `${k} must be a whole number.` };
    if (k !== 'aum_chg_30d_pct' && n < 0) return { error: `${k} can't be negative.` };
    out[k] = n;
  }
  if (out.nav === null) return { error: 'nav is required (1.00 for a stable-NAV fund).' };
  if (out.apy_7d_pct !== null && out.apy_7d_pct > 50) return { error: 'apy_7d_pct looks wrong: enter percent, e.g. 3.68.' };

  for (const k of TEXT) {
    if (input[k] !== undefined && input[k] !== null) out[k] = String(input[k]).trim().slice(0, 300);
  }
  if (out.source && !/^https?:\/\//.test(out.source)) return { error: 'source must be a web address starting with http.' };

  if (input.networks !== undefined) {
    if (!Array.isArray(input.networks)) return { error: 'networks must be a list of {network, supply_usd}.' };
    out.networks = [];
    for (const c of input.networks) {
      const network = String(c?.network || '').trim().slice(0, 60);
      const supply = Number(c?.supply_usd);
      if (!network || !Number.isFinite(supply) || supply < 0) return { error: 'Each network needs a name and a non-negative supply_usd.' };
      out.networks.push({ network, supply_usd: supply });
    }
  }
  return { value: out };
}
