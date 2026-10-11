// Initial data, researched Oct 11, 2026. Loaded by /api/setup with INSERT OR IGNORE,
// so running setup again never overwrites newer numbers.
// Sources: rwa.xyz asset pages (funds, chains), issuer and TreasuryDirect docs (terms),
// U.S. Treasury Daily Treasury Bill Rates (tbills).

export const funds = [
  {
    "fund": "BUIDL",
    "name": "BlackRock USD Institutional Digital Liquidity Fund",
    "manager": "BlackRock",
    "platform": "Securitize",
    "aum_usd": 2204072774,
    "aum_chg_30d_pct": -19.46,
    "nav": 1.0,
    "secondary_price": null,
    "apy_7d_pct": 3.68,
    "apy_30d_pct": 3.62,
    "mgmt_fee": "0.20–0.50% (0.50% most chains; 0.20% on some)",
    "holders": 105,
    "chains": 10,
    "as_of": "2026-10-11",
    "source": "https://app.rwa.xyz/assets/BUIDL"
  },
  {
    "fund": "BENJI",
    "name": "Franklin OnChain U.S. Government Money Fund (FOBXX)",
    "manager": "Franklin Templeton",
    "platform": "Benji",
    "aum_usd": 707756783,
    "aum_chg_30d_pct": 3.14,
    "nav": 1.0,
    "secondary_price": null,
    "apy_7d_pct": 3.72,
    "apy_30d_pct": 3.69,
    "mgmt_fee": "0.20%",
    "holders": 1131,
    "chains": 8,
    "as_of": "2026-10-11",
    "source": "https://app.rwa.xyz/assets/BENJI"
  }
];

export const terms = [
  {
    "option": "BUIDL",
    "eligibility": "US qualified purchasers (Reg D, BVI fund)",
    "min_buy": "$5,000,000",
    "min_redeem": "$250,000",
    "fees": "0.20–0.50% mgmt; 0% sub/redeem",
    "mint_settlement": "USD wire by 2:30 PM ET business day; tokens minted on receipt (same day)",
    "redeem_settlement": "Tokens in by 3:00 PM ET; USD wired by transfer agent (same/next day). 24/7 USDC exit via Circle facility",
    "secondary": "UniswapX RFQ vs USDC, whitelisted holders only, 24/7 (since Feb 2026). No public price feed",
    "tax_note": "Offshore fund distributions; generally no state-tax exemption"
  },
  {
    "option": "BENJI",
    "eligibility": "US investors (1940 Act registered MMF)",
    "min_buy": "$20",
    "min_redeem": "None listed",
    "fees": "0.20% mgmt; 0% sub/redeem",
    "mint_settlement": "Daily subscriptions in USD; USDC on-ramp for institutions",
    "redeem_settlement": "Same day or next business day per fund cutoff",
    "secondary": "Permissioned peer-to-peer wallet transfers only; no DEX market. Intraday yield accrues by the second",
    "tax_note": "MMF dividends; state exemption only for the Treasury-interest share"
  },
  {
    "option": "T-bill · TreasuryDirect",
    "eligibility": "Anyone with a TreasuryDirect account",
    "min_buy": "$100 (multiples of $100)",
    "min_redeem": "Hold to maturity",
    "fees": "None",
    "mint_settlement": "Buy at weekly auction; settles on issue date",
    "redeem_settlement": "Paid at maturity; 45-day hold before transfer to a broker to sell",
    "secondary": "None in TreasuryDirect; must transfer out to sell",
    "tax_note": "Exempt from state and local income tax"
  },
  {
    "option": "T-bill · Brokerage",
    "eligibility": "Any brokerage customer",
    "min_buy": "$1,000 typical (some brokers $100 at auction)",
    "min_redeem": "Sell any time in secondary market",
    "fees": "Usually $0 commission; bid/ask spread on secondary trades",
    "mint_settlement": "Auction or secondary; secondary settles T+1",
    "redeem_settlement": "Sell T+1, or hold to maturity",
    "secondary": "Deep OTC Treasury market",
    "tax_note": "Exempt from state and local income tax"
  }
];

export const chains = [
  {
    "fund": "BUIDL",
    "network": "Solana",
    "supply_usd": 917104177.92,
    "key": "BUIDL · Solana"
  },
  {
    "fund": "BUIDL",
    "network": "Avalanche",
    "supply_usd": 483526560.8,
    "key": "BUIDL · Avalanche"
  },
  {
    "fund": "BUIDL",
    "network": "Ethereum",
    "supply_usd": 435692112.27,
    "key": "BUIDL · Ethereum"
  },
  {
    "fund": "BUIDL",
    "network": "Aptos",
    "supply_usd": 156855543.37,
    "key": "BUIDL · Aptos"
  },
  {
    "fund": "BUIDL",
    "network": "BNB Chain",
    "supply_usd": 146754413.17,
    "key": "BUIDL · BNB Chain"
  },
  {
    "fund": "BUIDL",
    "network": "Optimism",
    "supply_usd": 26494825.39,
    "key": "BUIDL · Optimism"
  },
  {
    "fund": "BUIDL",
    "network": "Tempo",
    "supply_usd": 17117950.75,
    "key": "BUIDL · Tempo"
  },
  {
    "fund": "BUIDL",
    "network": "Polygon",
    "supply_usd": 11942551.95,
    "key": "BUIDL · Polygon"
  },
  {
    "fund": "BUIDL",
    "network": "Arbitrum",
    "supply_usd": 8584638.63,
    "key": "BUIDL · Arbitrum"
  },
  {
    "fund": "BENJI",
    "network": "Stellar",
    "supply_usd": 469870050.29,
    "key": "BENJI · Stellar"
  },
  {
    "fund": "BENJI",
    "network": "Base",
    "supply_usd": 59823267.03,
    "key": "BENJI · Base"
  },
  {
    "fund": "BENJI",
    "network": "Ethereum",
    "supply_usd": 48283484.15,
    "key": "BENJI · Ethereum"
  },
  {
    "fund": "BENJI",
    "network": "Arbitrum",
    "supply_usd": 48029171.07,
    "key": "BENJI · Arbitrum"
  },
  {
    "fund": "BENJI",
    "network": "Avalanche",
    "supply_usd": 34355137.92,
    "key": "BENJI · Avalanche"
  },
  {
    "fund": "BENJI",
    "network": "Polygon",
    "supply_usd": 32259087.35,
    "key": "BENJI · Polygon"
  },
  {
    "fund": "BENJI",
    "network": "Aptos",
    "supply_usd": 14726717.01,
    "key": "BENJI · Aptos"
  },
  {
    "fund": "BENJI",
    "network": "Solana",
    "supply_usd": 409868.21,
    "key": "BENJI · Solana"
  }
];

export const tbills = [
  {
    "date": "2026-10-01",
    "w4": 3.96,
    "w6": 3.99,
    "w8": 4.06,
    "w13": 4.1,
    "w17": 4.19,
    "w26": 4.28,
    "w52": 4.44
  },
  {
    "date": "2026-10-02",
    "w4": 3.95,
    "w6": 3.98,
    "w8": 4.04,
    "w13": 4.11,
    "w17": 4.19,
    "w26": 4.29,
    "w52": 4.46
  },
  {
    "date": "2026-10-05",
    "w4": 3.95,
    "w6": 3.98,
    "w8": 4.05,
    "w13": 4.15,
    "w17": 4.2,
    "w26": 4.31,
    "w52": 4.46
  },
  {
    "date": "2026-10-06",
    "w4": 3.95,
    "w6": 4.02,
    "w8": 4.05,
    "w13": 4.14,
    "w17": 4.19,
    "w26": 4.3,
    "w52": 4.45
  },
  {
    "date": "2026-10-07",
    "w4": 3.94,
    "w6": 4.02,
    "w8": 4.06,
    "w13": 4.15,
    "w17": 4.21,
    "w26": 4.29,
    "w52": 4.42
  },
  {
    "date": "2026-10-08",
    "w4": 4.04,
    "w6": 4.04,
    "w8": 4.06,
    "w13": 4.15,
    "w17": 4.22,
    "w26": 4.31,
    "w52": 4.43
  },
  {
    "date": "2026-10-09",
    "w4": 4.03,
    "w6": 4.03,
    "w8": 4.05,
    "w13": 4.16,
    "w17": 4.22,
    "w26": 4.33,
    "w52": 4.46
  }
];

