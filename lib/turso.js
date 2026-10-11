// Minimal Turso (libSQL) client over the HTTP "Hrana v2 pipeline" API.
// No npm dependencies: uses the built-in fetch in Node 18+.

function baseUrl() {
  const raw = process.env.TURSO_DATABASE_URL;
  if (!raw) throw new Error('TURSO_DATABASE_URL is not set');
  // Turso shows libsql://<db>-<org>.turso.io; the HTTP API is the same host over https.
  return raw.trim().replace(/^libsql:\/\//, 'https://').replace(/\/+$/, '');
}

function toArg(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { type: 'null' };
    return Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER
      ? { type: 'integer', value: String(v) }
      : { type: 'float', value: v };
  }
  return { type: 'text', value: String(v) };
}

function fromValue(c) {
  switch (c.type) {
    case 'null': return null;
    case 'integer': return Number(c.value);
    case 'float': return Number(c.value);
    case 'text': return c.value;
    case 'blob': return c.base64;
    default: return c.value ?? null;
  }
}

function toRows(result) {
  const names = result.cols.map(c => c.name);
  return result.rows.map(r => Object.fromEntries(r.map((c, i) => [names[i], fromValue(c)])));
}

/**
 * Run statements in one round trip. Each item is a SQL string or {sql, args}.
 * Returns one array of row objects per statement. Throws on the first error.
 */
export async function execute(statements, { transaction = false } = {}) {
  const list = statements.map(s => (typeof s === 'string' ? { sql: s, args: [] } : s));
  const stmt = s => ({ sql: s.sql, args: (s.args || []).map(toArg) });
  return transaction ? runBatch(list.map(stmt)) : runPipeline(list.map(stmt));
}

async function post(requests) {
  const res = await fetch(`${baseUrl()}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.TURSO_AUTH_TOKEN ? { Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN}` } : {}),
    },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Turso HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const body = await res.json();
  const first = body.results[0];
  if (first.type === 'error') throw new Error(`Turso error: ${first.error?.message || 'unknown'}`);
  return body.results;
}

// Independent statements in one round trip; throws on the first error.
async function runPipeline(stmts) {
  const results = await post([...stmts.map(s => ({ type: 'execute', stmt: s })), { type: 'close' }]);
  return stmts.map((_, i) => {
    const r = results[i];
    if (r.type === 'error') throw new Error(`Turso error in statement ${i + 1}: ${r.error?.message || 'unknown'}`);
    return toRows(r.response.result);
  });
}

// All-or-nothing: BEGIN, each step runs only if the one before succeeded,
// COMMIT on success, ROLLBACK otherwise.
async function runBatch(stmts) {
  const n = stmts.length;
  const steps = [{ stmt: { sql: 'BEGIN' } }];
  stmts.forEach((s, i) => steps.push({ stmt: s, condition: { type: 'ok', step: i } }));
  steps.push({ stmt: { sql: 'COMMIT' }, condition: { type: 'ok', step: n } });
  steps.push({ stmt: { sql: 'ROLLBACK' }, condition: { type: 'not', cond: { type: 'ok', step: n + 1 } } });
  const [r] = await post([{ type: 'batch', batch: { steps } }, { type: 'close' }]);
  const { step_results: results, step_errors: errors } = r.response.result;
  const bad = errors.findIndex((e, i) => e && i <= n + 1);
  if (bad !== -1) {
    const where = bad === 0 ? 'BEGIN' : bad === n + 1 ? 'COMMIT' : `statement ${bad}`;
    throw new Error(`Turso error in ${where} (rolled back): ${errors[bad].message || 'unknown'}`);
  }
  return results.slice(1, n + 1).map(toRows);
}

export async function query(sql, args = []) {
  const [rows] = await execute([{ sql, args }]);
  return rows;
}
