// Fetch and parse the U.S. Treasury's Daily Treasury Bill Rates (CSV).
// Keeps the coupon-equivalent yield for each bill term.

const URL_TMPL = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/' +
  'daily-treasury-rates.csv/all/{ym}?type=daily_treasury_bill_rates&field_tdr_date_value_month={ym}&page&_format=csv';

export const TERMS = { '4 WEEKS': 'w4', '6 WEEKS': 'w6', '8 WEEKS': 'w8', '13 WEEKS': 'w13', '17 WEEKS': 'w17', '26 WEEKS': 'w26', '52 WEEKS': 'w52' };
export const TERM_KEYS = Object.values(TERMS);

function splitCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

export function parseBillCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0]).map(h => h.toUpperCase());
  const cols = {};
  header.forEach((h, i) => {
    for (const [term, key] of Object.entries(TERMS)) {
      if (h.startsWith(term) && h.includes('COUPON')) cols[key] = i;
    }
  });
  // Some exports label only the bank-discount column with the term; its coupon column follows it.
  header.forEach((h, i) => {
    for (const [term, key] of Object.entries(TERMS)) {
      if (cols[key] === undefined && h.startsWith(term) && (header[i + 1] || '').includes('COUPON')) cols[key] = i + 1;
    }
  });
  const rows = [];
  for (const line of lines.slice(1)) {
    const rec = splitCsvLine(line);
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(rec[0] || '');
    if (!m) continue;
    const row = { date: `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` };
    for (const key of TERM_KEYS) {
      const v = cols[key] === undefined ? NaN : parseFloat(rec[cols[key]]);
      row[key] = Number.isFinite(v) ? v : null;
    }
    if (row.w4 !== null || row.w13 !== null) rows.push(row);
  }
  return rows;
}

export async function fetchMonth(ym) {
  const res = await fetch(URL_TMPL.replaceAll('{ym}', ym), { headers: { 'User-Agent': 'tokenized-fund-monitor' } });
  if (!res.ok) throw new Error(`Treasury HTTP ${res.status} for ${ym}`);
  return parseBillCsv(await res.text());
}

// Current month plus the previous one, so the first days of a month still have history.
export async function fetchRecent(today = new Date()) {
  const ym = d => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const thisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const [a, b] = await Promise.all([fetchMonth(ym(lastMonth)), fetchMonth(ym(thisMonth))]);
  const byDate = new Map([...a, ...b].map(r => [r.date, r]));
  return [...byDate.values()].sort((x, y) => (x.date < y.date ? -1 : 1));
}
