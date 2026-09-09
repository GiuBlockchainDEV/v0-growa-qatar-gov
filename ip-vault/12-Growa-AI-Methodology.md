# Growa AI Methodology

← [[11-Row-Level-Security]] | [[00-Index]] | Next: [[13-Internationalization]]

---

## Overview

**Growa AI** is a grounded government briefing system — not a general-purpose chatbot. It reads live operational data from the platform and produces structured, evidence-based briefings for authorized government users.

---

## Design Constraints

| Constraint | Rationale |
|------------|-----------|
| Grounded in platform data only | Prevents hallucinated farms, crops, or metrics |
| Server-side execution only | API keys never exposed to browser |
| Structured output format | Consistent executive briefing structure |
| English output only | Government briefing standard language |
| No autonomous decisions | AI accelerates understanding; humans retain authority |
| Data gap transparency | Explicitly flags missing or incomplete data |

---

## Pipeline Architecture

```
Dashboard Metrics (live workspace data)
        ↓
buildGrowaContext() — structured analysis context
        ↓
buildGrowaDigest() — human-readable operational digest
        ↓
Module-specific preset prompts
        ↓
Server API endpoint → LLM (Gemini)
        ↓
Structured markdown briefing
```

---

## Supported Modules

| Module | Briefing Focus |
|--------|----------------|
| `data-analytics` | Executive briefing, intervention priorities, food security outlook |
| `water-intelligence` | Water policy, conservation priorities, drought resilience |
| `energy-intelligence` | Efficiency assessment, grid pressure, decarbonization roadmap |

---

## Operational Digest Structure

The digest is the **single source of truth** passed to the LLM:

### National Headline
- Tracked crops, producers, and polygons
- Total production, water, and energy
- Average performance scores
- Top and lowest efficiency producers
- Module-specific focus metrics (water intensity, energy intensity, etc.)

### Crop Matrix
Per-crop breakdown: production share, water share, energy share, scores, farm count, intensity metrics

### Producer Rankings
Top producers by efficiency with production, resource use, and crop portfolio

### At-Risk Producers
Low efficiency / high resource pressure flags

### Data Alerts
Explicit gaps and anomalies in monitoring coverage

---

## Analysis Context Schema

Structured context object includes:
- `module` — Active workspace identifier
- `headline` — National KPI aggregates
- `crops[]` — Per-crop analytical rows
- `topProducers[]` — Efficiency leaders
- `atRiskProducers[]` — Flagged underperformers
- `alerts[]` — Data quality and coverage warnings
- `generatedAt` — Snapshot timestamp

---

## Output Format (5 Sections)

Every briefing follows a fixed structure:

1. **Executive Summary** — Key findings in plain language
2. **Evidence** — Metrics cited from the operational digest
3. **Risk Signals** — Outliers, at-risk producers, anomalies
4. **Recommended Actions** — Concrete government interventions
5. **KPIs & Data Gaps** — Measurable targets and missing data

---

## Anti-Hallucination Rules

Embedded in system prompts:
- Must cite digest metrics by name and value
- Must not invent farms, crops, or producers not in digest
- Must flag insufficient data via alerts section
- Must distinguish observation from recommendation
- Must not claim regulatory authority or make binding decisions

---

## Module-Specific Analysis Frameworks

Each workspace module defines an analytical methodology:

- **Water:** Intensity benchmarking, irrigation pressure, crop-level water accounting
- **Energy:** kWh/t efficiency, producer rankings, decarbonization pathways
- **Analytics:** Cross-resource efficiency, portfolio concentration, intervention prioritization

---

## UI Integration

`GrowaIntelligencePanel` component in intelligence workspaces provides:
- Preset prompt buttons (one-click briefings)
- Custom prompt input (within module scope)
- Markdown-rendered response display
- Loading and error states

---

## IP Significance

The Growa AI methodology represents a novel approach to **government-grade grounded AI**:

1. Pre-computed structured digest before LLM invocation
2. Module-specific analytical frameworks
3. Fixed output schema for executive consumption
4. Explicit anti-hallucination guardrails
5. Data gap transparency as first-class output

---

## Related Notes

- [[05-Intelligence-Workspaces]]
- [[14-API-Design]]
- [[15-IP-Claims-Summary]]
