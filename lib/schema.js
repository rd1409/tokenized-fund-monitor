// Database schema. Every statement is idempotent so /api/setup can run more than once.
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS funds (
    fund TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    manager TEXT,
    platform TEXT,
    mgmt_fee TEXT,
    source TEXT,
    sort INTEGER NOT NULL DEFAULT 0
  )`,
  // One row per fund per day you record numbers; the page shows the latest.
  `CREATE TABLE IF NOT EXISTS fund_snapshots (
    fund TEXT NOT NULL REFERENCES funds(fund),
    as_of TEXT NOT NULL,
    aum_usd REAL,
    aum_chg_30d_pct REAL,
    nav REAL,
    secondary_price REAL,
    apy_7d_pct REAL,
    apy_30d_pct REAL,
    holders INTEGER,
    chains INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (fund, as_of)
  )`,
  `CREATE TABLE IF NOT EXISTS terms (
    option TEXT PRIMARY KEY,
    sort INTEGER NOT NULL DEFAULT 0,
    eligibility TEXT,
    min_buy TEXT,
    min_redeem TEXT,
    fees TEXT,
    mint_settlement TEXT,
    redeem_settlement TEXT,
    secondary TEXT,
    tax_note TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS chain_supply (
    fund TEXT NOT NULL REFERENCES funds(fund),
    network TEXT NOT NULL,
    as_of TEXT NOT NULL,
    supply_usd REAL NOT NULL,
    PRIMARY KEY (fund, network, as_of)
  )`,
  `CREATE TABLE IF NOT EXISTS tbills (
    date TEXT PRIMARY KEY,
    w4 REAL, w6 REAL, w8 REAL, w13 REAL, w17 REAL, w26 REAL, w52 REAL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS refresh_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job TEXT NOT NULL,
    ran_at TEXT NOT NULL DEFAULT (datetime('now')),
    ok INTEGER NOT NULL,
    detail TEXT
  )`,
];

export const TERM_FIELDS = ['eligibility', 'min_buy', 'min_redeem', 'fees', 'mint_settlement', 'redeem_settlement', 'secondary', 'tax_note'];
export const SNAPSHOT_FIELDS = ['aum_usd', 'aum_chg_30d_pct', 'nav', 'secondary_price', 'apy_7d_pct', 'apy_30d_pct', 'holders', 'chains'];
