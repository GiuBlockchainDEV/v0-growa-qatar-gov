# Intelligence Systems

← [[03-Platform-Ontology]] · [[00-Index]] · [[05-Governance-Compliance]]

---

## Purpose

Growa transforms operational data into **institutional intelligence** — resource accountability, performance rankings, and executive briefings grounded in live platform metrics.

> [!blackbox] Metrics Pipeline
> Map objects → crop insights → national aggregates → workspace KPIs.  
> Scoring formulas and weighting logic: **protected**.

---

## Resource Intelligence

> [!card] Water Intelligence
> National water consumption · Intensity (m³/t) · Irrigation pressure · Producer rankings by efficiency

> [!card] Energy Intelligence
> Sector energy use · Intensity (kWh/t) · Per-site averages · Efficiency leaders and laggards

> [!card] Data Analytics
> Cross-resource view · Combined efficiency scores · Crop portfolio matrix · At-risk producer flags

> [!card] Weather Grid
> National environmental grid · Agronomic risk indicators · Evapotranspiration · Disease and thermal stress signals

Every analytical table links back to the map. Numbers always have a place on the ground.

---

## Metrics Contract (Abstract)

```typescript
// Published output shape — computation protected
interface NationalSnapshot {
  scope:            NationalScope
  headline:         HeadlineKPIs
  cropMatrix:       CropPerformanceRow[]
  producerRankings: ProducerRank[]
  atRiskFlags:      RiskSignal[]
  dataGaps:         CoverageAlert[]
}

interface HeadlineKPIs {
  totalProduction:  MetricValue
  totalWater:       MetricValue
  totalEnergy:      MetricValue
  averageScore:     ScoreValue
  // Module-specific extensions: protected
}
```

---

## Growa AI

A **grounded government briefing system** — not a general chatbot.

> [!blackbox] Growa AI Engine
> Pre-computes an operational digest before any language model invocation.  
> Prompt templates, scoring weights, and anti-hallucination rules: **protected**.

### Pipeline

```
Live workspace metrics
    → Operational digest assembled        [protected]
    → Module-specific analysis lens       [protected]
    → Structured briefing generated       [protected]
    → Five-section executive output
```

### Output Structure

| Section | Content |
|---------|---------|
| 1 · Executive Summary | Key findings in plain language |
| 2 · Evidence | Metrics cited from digest only |
| 3 · Risk Signals | Outliers, at-risk producers, anomalies |
| 4 · Recommended Actions | Concrete institutional interventions |
| 5 · KPIs & Data Gaps | Targets and missing coverage |

### Constraints

- Cites platform data only — never invents farms, crops, or metrics
- Server-side execution — provider keys never reach the browser
- English briefing output — human authority preserved
- Flags insufficient data explicitly

```typescript
// Abstract briefing contract — not production source
interface GrowaBriefingRequest {
  module:   AnalysisLens
  digest:   OperationalDigest    // pre-computed, protected
  prompt?:  PresetPrompt        // template library protected
}

interface GrowaBriefingResponse {
  sections: FixedBriefingSchema  // always five sections
  sources:  DigestCitation[]     // traceable to live data
}
```

---

## IP Significance

| Asset | Status |
|-------|--------|
| Operational digest architecture | Publishable (conceptual) |
| Cross-resource efficiency methodology | Publishable (conceptual) |
| Scoring and ranking algorithms | Trade secret |
| AI prompt library | Trade secret |
| Anti-hallucination rule set | Trade secret |
