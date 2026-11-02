# Watchtower / Commodity Markets

## Navigation

A new **Commodity markets** tab appears directly after **Global map** and
before **Food situation & risk** in `WatchtowerWorkspace`.

Canonical URL: `/dashboard?module=watchtower#watchtower-markets`. The
existing global-map landing remains unchanged, and all other Watchtower
hash-based deep links are preserved.

## Data integrity and source

The dashboard draws **only actual published IMF Primary Commodity Prices**
series obtained through FRED's public CSV graph endpoint. Historical prices
are monthly averages, not real-time financial-exchange trades or spot quotes
from individual suppliers.

Server route: `GET /api/watchtower/commodity-markets`, authenticated through
Supabase and cached on the server for 6 hours after a successful request.

FRED source URLs:
`https://fred.stlouisfed.org/series/{SERIES_ID}`
Graph CSV:
`https://fred.stlouisfed.org/graph/fredgraph.csv?id={SERIES_ID}`

The market catalog contains 14 potential benchmark series across grains,
edible oils, protein, softs, and produce. A series only appears after its
published numeric history has actually been retrieved and validated. Any
failed, discontinued or unavailable FRED series is omitted and explicitly
included in the unavailable count. Data is not extrapolated, forward-filled,
fabricated, inferred from supplier offers, or represented as live quotes.

Sources: IMF Primary Commodity Prices syndicated by FRED; see the source
series page for each specific market's definition, unit and terms. Some
series have different benchmarks, geography or quality grades: rice Thailand,
coffee Arabica, sugar No. 11, etc. Cross-market comparison is meaningful
only with those qualifications. Normalized prices are for reference, not
a promise of comparable product grade or availability.

Unit conversions:
- IMF USD/metric-tonne: unchanged.
- IMF US cents/pound: value * 0.01 * 2204.6226218488 = USD/metric-tonne.
- QAR/metric-tonne: USD/metric-tonne * 3.64, Qatar Central Bank exchange-rate
  parity, not a variable FX quote.

The displayed 1-, 3-, and 12-month percentage changes are computed using
the **exact calendar-month** prior observation and return N/A if that
observation does not exist. We do not use a nearest past price. Annual
highs/lows refer to the most recent 12 published monthly observations.
Volatility is the standard deviation of monthly percentage changes from
the prior 12 months, when at least six comparable monthly pairs exist;
this is NOT an annualized realized trading volatility.

The purchase-quantity simulator multiplies the benchmark by tonnes and
computes the delta from the prior published month. It excludes transport,
duties, quality, taxes, insurance, storage, handling and supplier margin.
It is illustrative market-budget sensitivity, not a sourced procurement
quotation or a QAR import-cost forecast.

## User experience

Growa light theme, market ticker strip, four market-breadth KPI cards,
interactive SVG historical-price chart with 6M/1Y/2Y/3Y/5Y selector,
USD/QAR switch, month-on-month and year-on-year stats, high/low and monthly
volatility. Below the chart is a searchable/sortable market table, category
filters, sparklines, and locally stored watchlist. All instruments are
labelled with benchmark, publication month, FRED source and staleness.
English and Arabic navigation / core labels are supported.

A missing upstream response renders a clear unavailable state; nothing
is silently replaced with simulated market values. A future upgrade can
add a licensed agricultural futures market-data provider with explicit
exchange, contract-month, settlement and quote-delay metadata to support
actual intraday exchange monitoring.
