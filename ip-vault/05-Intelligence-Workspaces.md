# Intelligence Workspaces

← [[04-Module-Registry]] | [[00-Index]] | Next: [[06-Map-Centric-UX]]

---

## Overview

Growa provides dedicated analytical workspaces that measure agricultural performance across water, energy, production, and weather dimensions. These workspaces share a common metrics pipeline and connect to the [[12-Growa-AI-Methodology|Growa AI]] briefing layer.

---

## Metrics Pipeline

```
Map polygons (custom_point_polygons)
        ↓
Farm crop insights (per-point production/water/energy)
        ↓
Workspace aggregates (national KPIs, rankings)
        ↓
Growa analysis context (structured digest)
        ↓
AI briefing (optional)
```

---

## Data Analytics Workspace

**Purpose:** Cross-resource performance view combining production, water, and energy.

### Analytical Outputs

| Metric | Description |
|--------|-------------|
| Total production | Estimated tons across monitored network |
| Resource intensity | Combined water + energy per ton of output |
| Efficiency scores | Per-area and per-producer performance |
| Crop matrix | Farms, output, resources, and scores by crop |
| Producer rankings | Efficiency, volume, and intensity leaders |
| Data gaps | Crops or areas with incomplete monitoring |

### User Actions
- Compare crop portfolio performance
- Identify top and at-risk producers
- Navigate from table rows to map locations
- Request executive briefings via Growa AI

---

## Water Intelligence Workspace

**Purpose:** Measure water consumption relative to agricultural output.

### Analytical Outputs

| Metric | Description |
|--------|-------------|
| Total water consumption | Cubic metres across monitored areas |
| Water intensity | m³ per ton of crop production |
| Irrigation pressure | Water share of total resource use |
| Crop breakdown | Water use and intensity by crop type |
| Producer rankings | Farms ranked by water efficiency |
| Quality scores | Linked to monitored production polygons |

### Policy Questions Answered
- Which crops consume disproportionate water for their output?
- Which producers need conservation support or inspection?
- Where is national water use concentrated?

---

## Energy Intelligence Workspace

**Purpose:** Track energy consumption across agricultural operations.

### Analytical Outputs

| Metric | Description |
|--------|-------------|
| Total energy consumption | kWh across monitored operations |
| Energy intensity | kWh per ton of production |
| Average per site | Energy use per farm or facility |
| Crop breakdown | Energy demand by crop type |
| Producer rankings | Efficiency leaders and laggards |

### Policy Questions Answered
- Which operations have unusually high energy demand?
- How does energy input relate to food output nationally?
- Where should efficiency programmes focus?

---

## Weather Workspace

**Purpose:** National grid weather with agronomic risk indicators.

### Coverage
- Entire national territory via configurable grid
- Current conditions and historical trends per grid cell

### Analytical Domains

| Domain | Insight |
|--------|---------|
| Light & solar radiation | Greenhouse and growth planning |
| Temperature & humidity | Heat stress and moisture |
| Wind | Spraying safety, structural risk |
| Rainfall | Recent precipitation windows |
| Irrigation indicators | Evapotranspiration, water stress |
| Agronomic risk | Disease risk, thermal stress indices |

### User Actions
- Select any grid cell for environmental profile
- Compare weather trends over time
- Plan irrigation and field operations proactively

---

## RSS Information Feed

Curated external news and information alongside the operational map — agricultural news, market signals, and policy context without leaving the workspace.

---

## Shared UI Patterns

All intelligence workspaces share:
- Slide-from-left panel over the persistent map
- Consistent KPI cards and data tables
- Map navigation from data rows to geographic locations
- Optional Growa AI briefing panel with preset prompts

---

## Related Notes

- [[06-Map-Centric-UX]]
- [[12-Growa-AI-Methodology]]
- [[09-Data-Model]]
- [[08-Supply-Chain]]
