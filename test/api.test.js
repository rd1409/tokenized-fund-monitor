import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { installFakes, invoke, SAMPLE_CSV } from './helpers.js';
import { parseBillCsv } from '../lib/treasury.js';
import { execute } from '../lib/turso.js';
import setup from '../api/setup.js';
import data from '../api/data.js';
import fund from '../api/fund.js';
import tbills from '../api/cron/tbills.js';
import * as seed from '../lib/seed.js';

let fakes;
before(() => { fakes = installFakes(); });

test('parses Treasury CSV into coupon-equivalent yields', () => {
  const rows = parseBillCsv(SAMPLE_CSV);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { date: '2026-10-12', w4: 4.02, w6: 4.03, w8: 4.05, w13: 4.16, w17: 4.22, w26: 4.33, w52: 4.46 });
});

test('data endpoint explains an empty database', async () => {
  const r = await invoke(data);
  assert.equal(r.status, 500);
  assert.match(r.json.hint, /Set up database/);
});

test('setup requires the admin token', async () => {
  assert.equal((await invoke(setup, { method: 'POST' })).status, 401);
  assert.equal((await invoke(setup, { method: 'POST', token: 'wrong' })).status, 401);
  assert.equal((await invoke(setup, { method: 'GET', token: 'admin-secret' })).status, 405);
});

test('setup creates tables and loads seed data, and is safe to repeat', async () => {
  const r = await invoke(setup, { method: 'POST', token: 'admin-secret' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.counts, { funds: 2, snapshots: 2, terms: 4, chain_rows: seed.chains.length, tbill_days: seed.tbills.length });
  const again = await invoke(setup, { method: 'POST', token: 'admin-secret' });
  assert.deepEqual(again.json.counts, r.json.counts);
});

test('data endpoint returns the seeded numbers', async () => {
  const r = await invoke(data);
  assert.equal(r.status, 200);
  assert.match(r.headers['cache-control'], /s-maxage=300/);
  const buidl = r.json.funds.find(f => f.fund === 'BUIDL');
  assert.equal(buidl.apy_7d_pct, 3.68);
  assert.equal(buidl.aum_usd, 2204072774);
  assert.equal(buidl.secondary_price, null);
  assert.equal(buidl.holders, 105);
  assert.deepEqual(r.json.funds.map(f => f.fund), ['BUIDL', 'BENJI']);
  assert.equal(r.json.terms.length, 4);
  assert.equal(r.json.tbills.at(-1).date, '2026-10-09');
  assert.equal(r.json.tbills.at(-1).w4, 4.03);
  const buidlSupply = r.json.chains.filter(c => c.fund === 'BUIDL').reduce((s, c) => s + c.supply_usd, 0);
  assert.ok(Math.abs(buidlSupply - 2204072774.25) < 0.01);
});

test('cron refresh accepts CRON_SECRET or ADMIN_TOKEN and stores new days', async () => {
  assert.equal((await invoke(tbills, { token: 'nope' })).status, 401);
  const r = await invoke(tbills, { token: 'cron-secret' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.latest, '2026-10-13');
  const d = (await invoke(data)).json;
  assert.equal(d.tbills.at(-1).date, '2026-10-13');
  assert.equal(d.tbills.at(-1).w4, 4.01);
  assert.equal(d.lastRefresh.ok, 1);
  assert.equal((await invoke(tbills, { method: 'POST', token: 'admin-secret' })).status, 200);
});

test('fund endpoint validates input', async () => {
  const bad = [
    [{ fund: 'BUIDL', as_of: 'yesterday', nav: 1 }, /as_of/],
    [{ fund: 'BUIDL', as_of: '2026-10-12' }, /nav is required/],
    [{ fund: 'BUIDL', as_of: '2026-10-12', nav: 1, apy_7d_pct: 'abc' }, /apy_7d_pct must be a number/],
    [{ fund: 'BUIDL', as_of: '2026-10-12', nav: 1, apy_7d_pct: 0.0368 * 100 * 100 }, /looks wrong/],
    [{ fund: 'BUIDL', as_of: '2026-10-12', nav: 1, holders: 10.5 }, /whole number/],
    [{ fund: 'NEWFUND', as_of: '2026-10-12', nav: 1 }, /isn't tracked yet/],
    [{ fund: 'BUIDL', as_of: '2026-10-12', nav: 1, networks: [{ network: '', supply_usd: 1 }] }, /network needs a name/],
  ];
  for (const [body, msg] of bad) {
    const r = await invoke(fund, { method: 'POST', token: 'admin-secret', body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.match(r.json.error, msg);
  }
  assert.equal((await invoke(fund, { method: 'POST', body: { fund: 'BUIDL' } })).status, 401);
});

test('fund endpoint saves a new snapshot and the page shows the latest', async () => {
  const r = await invoke(fund, {
    method: 'POST', token: 'admin-secret',
    body: { fund: 'buidl', as_of: '2026-10-18', nav: '1.00', apy_7d_pct: '3.71', apy_30d_pct: '3.64', aum_usd: '$2,250,000,000', aum_chg_30d_pct: '-15.2', holders: '107', secondary_price: '',
      networks: [{ network: 'Solana', supply_usd: 1000000000 }, { network: 'Ethereum', supply_usd: 1250000000 }] },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const d = (await invoke(data)).json;
  const b = d.funds.find(f => f.fund === 'BUIDL');
  assert.equal(b.as_of, '2026-10-18');
  assert.equal(b.apy_7d_pct, 3.71);
  assert.equal(b.aum_usd, 2250000000);
  assert.equal(b.chains, 2);
  assert.equal(b.name, 'BlackRock USD Institutional Digital Liquidity Fund');
  assert.deepEqual(d.chains.filter(c => c.fund === 'BUIDL').map(c => c.network), ['Ethereum', 'Solana']);
  assert.equal(d.history.filter(h => h.fund === 'BUIDL').length, 2);
  // Re-running setup must not overwrite the newer numbers.
  await invoke(setup, { method: 'POST', token: 'admin-secret' });
  assert.equal((await invoke(data)).json.funds.find(f => f.fund === 'BUIDL').apy_7d_pct, 3.71);
});

test('fund endpoint adds a new fund when a name is given', async () => {
  const r = await invoke(fund, {
    method: 'POST', token: 'admin-secret',
    body: { fund: 'OUSG', name: 'Ondo Short-Term US Government Bond Fund', manager: 'Ondo', platform: 'Ondo', mgmt_fee: '0.15%', source: 'https://app.rwa.xyz/assets/OUSG', as_of: '2026-10-18', nav: 112.5, apy_7d_pct: 3.9 },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const d = (await invoke(data)).json;
  assert.deepEqual(d.funds.map(f => f.fund), ['BUIDL', 'BENJI', 'OUSG']);
  const bad = await invoke(fund, { method: 'POST', token: 'admin-secret', body: { fund: 'X', name: 'X', source: 'javascript:alert(1)', as_of: '2026-10-18', nav: 1 } });
  assert.equal(bad.status, 400);
});

test('transactions roll back completely on error', async () => {
  const before = (await execute(['SELECT COUNT(*) AS n FROM tbills']))[0][0].n;
  await assert.rejects(
    execute([
      { sql: 'INSERT INTO tbills (date, w4) VALUES (?, ?)', args: ['2030-01-01', 1.5] },
      { sql: 'INSERT INTO no_such_table VALUES (1)' },
    ], { transaction: true }),
    /rolled back/,
  );
  const after = (await execute(['SELECT COUNT(*) AS n FROM tbills']))[0][0].n;
  assert.equal(after, before);
});

test('Treasury outage is reported and logged, not thrown', async () => {
  const { calls } = fakes;
  const prev = globalThis.fetch;
  globalThis.fetch = async (url, opts) => String(url).includes('treasury.gov') ? new Response('down', { status: 503 }) : prev(url, opts);
  const r = await invoke(tbills, { token: 'cron-secret' });
  globalThis.fetch = prev;
  assert.equal(r.status, 502);
  assert.match(r.json.error, /Treasury HTTP 503/);
  assert.equal((await invoke(data)).json.lastRefresh.ok, 0);
  assert.ok(calls.turso > 0);
});
