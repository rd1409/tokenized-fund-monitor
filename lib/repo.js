import { execute, query } from './turso.js';
import { SCHEMA, TERM_FIELDS, SNAPSHOT_FIELDS } from './schema.js';
import { TERM_KEYS } from './treasury.js';
import * as seed from './seed.js';

const STATIC_FUND_FIELDS = ['name', 'manager', 'platform', 'mgmt_fee', 'source'];

export async function setupDb() {
  await execute(SCHEMA);
  const stmts = [];
  seed.funds.forEach((f, i) => {
    stmts.push({
      sql: `INSERT OR IGNORE INTO funds (fund, ${STATIC_FUND_FIELDS.join(', ')}, sort) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [f.fund, ...STATIC_FUND_FIELDS.map(k => f[k]), i],
    });
    stmts.push(snapshotStmt(f.fund, f.as_of, f, 'OR IGNORE'));
  });
  seed.terms.forEach((t, i) => stmts.push({
    sql: `INSERT OR IGNORE INTO terms (option, sort, ${TERM_FIELDS.join(', ')}) VALUES (?, ?, ${TERM_FIELDS.map(() => '?').join(', ')})`,
    args: [t.option, i, ...TERM_FIELDS.map(k => t[k])],
  }));
  const asOf = Object.fromEntries(seed.funds.map(f => [f.fund, f.as_of]));
  seed.chains.forEach(c => stmts.push({
    sql: 'INSERT OR IGNORE INTO chain_supply (fund, network, as_of, supply_usd) VALUES (?, ?, ?, ?)',
    args: [c.fund, c.network, asOf[c.fund], c.supply_usd],
  }));
  seed.tbills.forEach(r => stmts.push(tbillStmt(r, 'OR IGNORE')));
  await execute(stmts, { transaction: true });
  const [[counts]] = await execute([`SELECT
    (SELECT COUNT(*) FROM funds) AS funds,
    (SELECT COUNT(*) FROM fund_snapshots) AS snapshots,
    (SELECT COUNT(*) FROM terms) AS terms,
    (SELECT COUNT(*) FROM chain_supply) AS chain_rows,
    (SELECT COUNT(*) FROM tbills) AS tbill_days`]);
  return counts;
}

function snapshotStmt(fund, asOf, data, conflict = 'OR REPLACE') {
  return {
    sql: `INSERT ${conflict} INTO fund_snapshots (fund, as_of, ${SNAPSHOT_FIELDS.join(', ')}, updated_at)
          VALUES (?, ?, ${SNAPSHOT_FIELDS.map(() => '?').join(', ')}, datetime('now'))`,
    args: [fund, asOf, ...SNAPSHOT_FIELDS.map(k => (data[k] === '' || data[k] === undefined ? null : data[k]))],
  };
}

function tbillStmt(r, conflict = 'OR REPLACE') {
  return {
    sql: `INSERT ${conflict} INTO tbills (date, ${TERM_KEYS.join(', ')}, fetched_at) VALUES (?, ${TERM_KEYS.map(() => '?').join(', ')}, datetime('now'))`,
    args: [r.date, ...TERM_KEYS.map(k => r[k] ?? null)],
  };
}

export async function upsertTbills(rows) {
  if (!rows.length) return 0;
  await execute(rows.map(r => tbillStmt(r)), { transaction: true });
  return rows.length;
}

export async function logRefresh(job, ok, detail) {
  await query('INSERT INTO refresh_log (job, ok, detail) VALUES (?, ?, ?)', [job, ok ? 1 : 0, String(detail).slice(0, 1000)]);
}

// Save a fund's numbers for one date; optionally update its descriptive fields and chain supply.
// `networks` is the per-chain breakdown [{network, supply_usd}]; `chains` is the chain count.
export async function saveFund({ fund, as_of, networks, ...rest }) {
  if (networks?.length && (rest.chains == null || rest.chains === '')) rest.chains = networks.length;
  const stmts = [];
  const statics = STATIC_FUND_FIELDS.filter(k => rest[k] !== undefined && rest[k] !== '');
  if (rest.name) {
    stmts.push({
      sql: `INSERT INTO funds (fund, ${statics.join(', ')}, sort) VALUES (?, ${statics.map(() => '?').join(', ')}, (SELECT COALESCE(MAX(sort), -1) + 1 FROM funds))
            ON CONFLICT(fund) DO UPDATE SET ${statics.map(k => `${k} = excluded.${k}`).join(', ')}`,
      args: [fund, ...statics.map(k => rest[k])],
    });
  } else if (statics.length) {
    stmts.push({ sql: `UPDATE funds SET ${statics.map(k => `${k} = ?`).join(', ')} WHERE fund = ?`, args: [...statics.map(k => rest[k]), fund] });
  }
  stmts.push(snapshotStmt(fund, as_of, rest));
  (networks || []).forEach(c => stmts.push({
    sql: 'INSERT OR REPLACE INTO chain_supply (fund, network, as_of, supply_usd) VALUES (?, ?, ?, ?)',
    args: [fund, c.network, as_of, c.supply_usd],
  }));
  await execute(stmts, { transaction: true });
}

export async function fundExists(fund) {
  return (await query('SELECT 1 AS x FROM funds WHERE fund = ?', [fund])).length > 0;
}

export async function readAll({ tbillDays = 45 } = {}) {
  const [funds, history, terms, chains, tbills, log] = await execute([
    // Latest snapshot per fund, flattened onto the fund's descriptive fields.
    `SELECT f.fund, f.name, f.manager, f.platform, f.mgmt_fee, f.source, s.as_of, ${SNAPSHOT_FIELDS.map(k => 's.' + k).join(', ')}
       FROM funds f
       JOIN fund_snapshots s ON s.fund = f.fund
        AND s.as_of = (SELECT MAX(as_of) FROM fund_snapshots WHERE fund = f.fund)
      ORDER BY f.sort, f.fund`,
    `SELECT fund, as_of, aum_usd, apy_7d_pct, apy_30d_pct, nav, secondary_price FROM fund_snapshots ORDER BY fund, as_of`,
    `SELECT option, ${TERM_FIELDS.join(', ')} FROM terms ORDER BY sort, option`,
    // Latest chain breakdown per fund.
    `SELECT c.fund, c.network, c.supply_usd, c.as_of FROM chain_supply c
      WHERE c.as_of = (SELECT MAX(as_of) FROM chain_supply WHERE fund = c.fund)
      ORDER BY c.fund, c.supply_usd DESC`,
    { sql: `SELECT date, ${TERM_KEYS.join(', ')} FROM tbills WHERE date >= date((SELECT MAX(date) FROM tbills), ?) ORDER BY date`, args: [`-${tbillDays} days`] },
    `SELECT job, ran_at, ok, detail FROM refresh_log ORDER BY id DESC LIMIT 1`,
  ]);
  return { funds, history, terms, chains, tbills, lastRefresh: log[0] || null };
}
