// Test helpers: a fake Turso HTTP server backed by Node's built-in SQLite,
// a fake Treasury CSV endpoint, and minimal req/res objects for the handlers.
import { DatabaseSync } from 'node:sqlite';

export const SAMPLE_CSV = [
  'Date,4 WEEKS BANK DISCOUNT,4 WEEKS COUPON EQUIVALENT,6 WEEKS BANK DISCOUNT,6 WEEKS COUPON EQUIVALENT,8 WEEKS BANK DISCOUNT,8 WEEKS COUPON EQUIVALENT,13 WEEKS BANK DISCOUNT,13 WEEKS COUPON EQUIVALENT,17 WEEKS BANK DISCOUNT,17 WEEKS COUPON EQUIVALENT,26 WEEKS BANK DISCOUNT,26 WEEKS COUPON EQUIVALENT,52 WEEKS BANK DISCOUNT,52 WEEKS COUPON EQUIVALENT',
  '10/12/2026,3.95,4.02,3.96,4.03,3.97,4.05,4.06,4.16,4.11,4.22,4.18,4.33,4.26,4.46',
  '10/13/2026,3.94,4.01,3.96,4.03,3.97,4.05,4.05,4.15,4.10,4.21,4.17,4.32,4.25,4.45',
].join('\n');

function encode(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'bigint') return { type: 'integer', value: String(v) };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  return { type: 'text', value: String(v) };
}
function decode(a) {
  if (a.type === 'null') return null;
  if (a.type === 'integer') return Number(a.value);
  if (a.type === 'float') return a.value;
  return a.value;
}

function run(db, stmt) {
  const s = db.prepare(stmt.sql);
  const args = (stmt.args || []).map(decode);
  const cols = s.columns();
  if (!cols.length) { s.run(...args); return { cols: [], rows: [] }; }
  const rows = s.all(...args);
  return { cols: cols.map(c => ({ name: c.name })), rows: rows.map(r => cols.map(c => encode(r[c.name]))) };
}

export function installFakes({ treasury = SAMPLE_CSV, tursoToken = 'turso-secret' } = {}) {
  const db = new DatabaseSync(':memory:');
  const calls = { turso: 0, treasury: 0 };
  globalThis.fetch = async (url, opts = {}) => {
    url = String(url);
    if (url.startsWith('https://home.treasury.gov/')) {
      calls.treasury++;
      if (treasury instanceof Error) return new Response('down', { status: 503 });
      return new Response(treasury, { status: 200 });
    }
    if (url === 'https://test-db.turso.io/v2/pipeline') {
      calls.turso++;
      if (opts.headers?.Authorization !== `Bearer ${tursoToken}`) return new Response('unauthorized', { status: 401 });
      const { requests } = JSON.parse(opts.body);
      const results = requests.map(r => {
        if (r.type === 'close') return { type: 'ok', response: { type: 'close' } };
        if (r.type === 'execute') {
          try { return { type: 'ok', response: { type: 'execute', result: run(db, r.stmt) } }; }
          catch (e) { return { type: 'error', error: { message: e.message } }; }
        }
        if (r.type === 'batch') {
          const res = [], errs = [];
          const ok = i => res[i] != null;
          const check = c => !c ? true : c.type === 'ok' ? ok(c.step) : c.type === 'error' ? errs[c.step] != null : c.type === 'not' ? !check(c.cond) : true;
          r.batch.steps.forEach((st, i) => {
            res[i] = null; errs[i] = null;
            if (!check(st.condition)) return;
            try { res[i] = run(db, st.stmt); } catch (e) { errs[i] = { message: e.message }; }
          });
          return { type: 'ok', response: { type: 'batch', result: { step_results: res, step_errors: errs } } };
        }
        return { type: 'error', error: { message: 'unknown request ' + r.type } };
      });
      return new Response(JSON.stringify({ baton: null, base_url: null, results }), { status: 200 });
    }
    throw new Error('Unexpected fetch ' + url);
  };
  process.env.TURSO_DATABASE_URL = 'libsql://test-db.turso.io';
  process.env.TURSO_AUTH_TOKEN = tursoToken;
  process.env.ADMIN_TOKEN = 'admin-secret';
  process.env.CRON_SECRET = 'cron-secret';
  return { db, calls };
}

export async function invoke(handler, { method = 'GET', body, token, headers = {} } = {}) {
  const req = { method, headers: { ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body };
  const res = {
    statusCode: 200, headers: {}, text: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(t) { this.text = t || ''; },
  };
  await handler(req, res);
  return { status: res.statusCode, headers: res.headers, json: res.text ? JSON.parse(res.text) : null };
}
