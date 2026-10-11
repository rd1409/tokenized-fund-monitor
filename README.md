# Tokenized Fund Monitor

Tracks tokenized Treasury and money market funds and compares them with buying T-bills directly. It starts with:

- **BUIDL**: BlackRock USD Institutional Digital Liquidity Fund (Securitize)
- **BENJI**: Franklin OnChain U.S. Government Money Fund (FOBXX)

For each fund it shows net 7- and 30-day yield, NAV against any on-chain price, assets, mint and redeem minimums, settlement, fees, tax treatment, supply by blockchain, and the yield gap against 4- to 52-week T-bills put on the same basis.

## How it's built

| Part | Where it runs | What it does |
| --- | --- | --- |
| `public/index.html` | Vercel (static) | The monitor page. Loads everything from `/api/data` and draws it with d3. |
| `public/admin.html` | Vercel (static), at `/admin` | Set up the database, refresh T-bill rates, record fund numbers. |
| `api/data.js` | Vercel function | `GET` — returns funds, terms, chains and T-bill rates from Turso. Cached 5 minutes at the edge. |
| `api/setup.js` | Vercel function | `POST` — creates tables and loads the starting data. Safe to rerun; never overwrites newer rows. |
| `api/fund.js` | Vercel function | `POST` — saves a fund's numbers for a date, or adds a new fund. |
| `api/cron/tbills.js` | Vercel Cron, weekdays 22:15 UTC | Pulls the last two months of rates from the U.S. Treasury into Turso. |
| `lib/turso.js` | — | A small client for Turso's HTTP API. No npm dependencies anywhere in the project. |

The database has five tables: `funds`, `fund_snapshots` (one row per fund per date, so you build history), `terms`, `chain_supply` and `tbills`, plus `refresh_log`. See `lib/schema.js`.

## Deploy

### 1. Turso

1. Create a database (any name, e.g. `tokenized-fund-monitor`) in the region nearest your Vercel functions (Vercel defaults to Washington, D.C., `iad1`, so pick a US East region).
2. From the database page, copy its **URL** (`libsql://…turso.io`).
3. Create a **database token** with read and write access, and copy it.

### 2. Vercel

1. *Add New → Project*, import `rd1409/tokenized-fund-monitor`. Leave Framework Preset as **Other** and the build settings empty.
2. Under *Environment Variables* add:

   | Name | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL` | the `libsql://…` URL |
   | `TURSO_AUTH_TOKEN` | the database token |
   | `ADMIN_TOKEN` | a long random string you make up (your admin password) |
   | `CRON_SECRET` | another long random string |

3. Deploy.

### 3. Load the data

Open `https://<your-project>.vercel.app/admin`, paste your `ADMIN_TOKEN`, and click **Set up database**. Then open the home page.

## Keeping it current

- **T-bill rates** refresh automatically every weekday evening. *Refresh T-bill rates now* on `/admin` runs it on demand.
- **Fund numbers** are entered on `/admin`, because rwa.xyz has no free public API. Copy the figures from each fund's rwa.xyz page and save; each date becomes a snapshot.
- **Adding a fund**: on `/admin`, choose *+ Add a new fund*, fill in its ticker, name and numbers. It appears on the page automatically. Its mint/redeem terms card is not created; add a row to `terms` if you want one.

You can also script updates:

```bash
curl -X POST https://<your-project>.vercel.app/api/fund \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"fund":"BUIDL","as_of":"2026-10-18","nav":1,"apy_7d_pct":3.71,"apy_30d_pct":3.64,"aum_usd":2250000000}'
```

## Method

- **Yield basis.** Fund APYs compound daily; T-bill coupon-equivalent yields don't. The page converts each APY to a simple annual rate, `365 × ((1 + APY)^(1/365) − 1)`, before comparing.
- **Spread.** Fund's converted yield minus the latest 4-week bill yield, in basis points.
- **Premium / discount.** Shown only where a fund has a public on-chain price (`secondary_price`). BUIDL and BENJI have none.
- **Taxes.** All yields are before tax. T-bill interest is exempt from state and local tax; money fund distributions mostly are not.

## Develop

```bash
npm test          # API tests against a fake Turso backed by Node's built-in SQLite (Node 22+)
npx vercel dev    # run locally with your .env (see .env.example)
```

Starting data (`lib/seed.js`) was researched on Oct 11, 2026 from rwa.xyz, issuer documents, TreasuryDirect guidance and the U.S. Treasury. Not investment advice.
