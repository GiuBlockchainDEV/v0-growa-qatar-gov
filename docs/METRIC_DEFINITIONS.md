# Metric Definitions — Growa Qatar

Standardized KPI definitions to prevent drift across modules and the National Watchtower.

---

## Production

### Total Production Estimate
- **Meaning:** Sum of estimated crop production across all farm crop insight records
- **Formula:** `Σ estimated_production_tons` from `farm_crop_insights`
- **Unit:** metric tons (t)
- **Source:** `operations.farm_crop_insights`
- **Aggregation:** National sum, per-crop sum, per-producer sum
- **Comparison:** Previous equivalent timeframe (when historical data available)
- **Missing data:** Display `—` / "Insufficient data"

### At-Risk Production Entities
- **Meaning:** Count of farms/points/parcels with active crop_health or production signals
- **Formula:** Count of unique entities in priority signals of type `crop_health` or `production`
- **Unit:** entities
- **Source:** `watchtower.signals`

---

## Water

### Total Water Demand
- **Meaning:** Aggregate irrigation/water consumption across operational insights
- **Formula:** `Σ water_consumption_m3` from `farm_crop_insights`
- **Unit:** m³
- **Source:** `operations.farm_crop_insights`

### Water Intensity (m³/ton)
- **Meaning:** Water consumed per ton of estimated production
- **Formula:** `total_water_m3 / total_production_tons`
- **Unit:** m³/t
- **Comparison:** Cohort median × 1.2 threshold for anomaly detection
- **Signal rule:** `lib/watchtower/config/signal-rules.ts` → `WATER_INTENSITY_RULE`

---

## Energy

### Total Energy Consumption
- **Formula:** `Σ energy_consumption_kwh` from `farm_crop_insights`
- **Unit:** kWh

### Energy Intensity (kWh/ton)
- **Formula:** `total_energy_kwh / total_production_tons`
- **Unit:** kWh/t
- **Signal threshold:** Cohort median × 1.25

---

## Crop Health

### Polygon Health Score
- **Meaning:** Operational health indicator per mapped polygon
- **Range:** 0–100
- **Source:** `custom_point_polygons.score`
- **Signal threshold:** Below 40 = attention signal
- **Note:** Not NDVI — operational score until satellite health indices are integrated

### Harvest BWP (Biomass Water Productivity)
- **Source:** Harvest API field metrics
- **Signal threshold:** > 1.35
- **Demo mode:** Clearly labeled when `X-Harvest-Demo: true`

---

## Climate

### Peak Temperature (Sampled)
- **Meaning:** Maximum air temperature across 5 representative Qatar zones
- **Unit:** °C
- **Source:** Weather API via BFF
- **Signal threshold:** > 42°C

### Peak VPD
- **Meaning:** Maximum vapor pressure deficit across sampled zones
- **Unit:** kPa
- **Signal threshold:** > 2.0 kPa

---

## Supply

### Available Contract Volume
- **Source:** `supply_overview_snapshots.available_contract_volume_tons`
- **Unit:** t

### At-Risk Deliveries
- **Source:** `supply_overview_snapshots.at_risk_deliveries_count`
- **Unit:** lots

---

## Data Quality

### Farm GPS Coverage
- **Formula:** `(farms_with_gps / total_farms) × 100`
- **Unit:** percent
- **Signal:** Any farm without `gps_latitude`/`gps_longitude`

### Source Health States
- `healthy` — data loaded successfully
- `degraded` — demo mode or partial coverage
- `stale` — no recent snapshot
- `offline` — API unreachable or not configured
- `unknown` — not yet checked

---

## National Status Classification

| Level | Criteria |
|-------|----------|
| `normal` | No elevated signals in domain |
| `attention` | Info/attention severity signal present |
| `high` | High severity signal present |
| `critical` | Critical severity signal present |
| `unknown` | Insufficient underlying data |

**Mandatory:** `unknown` ≠ `normal`. Never show green when data is missing.
