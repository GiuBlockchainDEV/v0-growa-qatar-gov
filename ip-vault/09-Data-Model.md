# Data Model — Conceptual Overview

← [[08-Supply-Chain]] | [[00-Index]] | Next: [[10-Auth-Access-Model]]

---

## Design Principles

1. **Organization-scoped tenancy** — All operational data belongs to an organization
2. **Bilingual by default** — Names and descriptions in English and Arabic
3. **Geographic linkage** — Entities connect to map coordinates and regions
4. **Audit readiness** — Significant actions logged for compliance
5. **Defensive evolution** — Schema migrations are idempotent for mixed deployment states

---

## Domain Map

```
┌─────────────────────────────────────────────────────────┐
│                    AUTH & ACCESS                        │
│  country_instances, organizations, departments,         │
│  profiles, memberships, role_templates, invitations,    │
│  access_policies, audit_logs, role_navigation           │
├─────────────────────────────────────────────────────────┤
│                    OPERATIONS                           │
│  farms, production_units, crop_types, growing_cycles,   │
│  input_inventory, farm_activities, custom_map_points,   │
│  custom_point_polygons, farm_crop_insights,             │
│  gcc_crop_types, gcc_crop_varieties                     │
├─────────────────────────────────────────────────────────┤
│                    SUPPLY CHAIN                         │
│  supply_overview_snapshots, supply_flows,               │
│  supply_action_queue                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Auth & Access Domain

| Entity | Purpose |
|--------|---------|
| `country_instances` | Country deployment container |
| `organizations` | Multi-tenant actors (government, farm company, etc.) |
| `departments` | Subdivisions within organizations |
| `regions` | Geographic hierarchy (municipalities) |
| `profiles` | Application user profile (1:1 with identity) |
| `user_organization_members` | Active membership with role assignment |
| `memberships` | Blueprint membership with scope assignments |
| `role_templates` | Predefined permission templates |
| `permission_templates` | Granular domain/action permissions |
| `invitations` | Invitation-only onboarding records |
| `access_policies` | Organization security policies |
| `role_navigation` | Per-role menu configuration (JSON) |
| `role_delegations` | Temporary role delegation |
| `audit_logs` | Security and compliance audit trail |

---

## Operations Domain

| Entity | Purpose |
|--------|---------|
| `farms` | Registered agricultural sites |
| `production_units` | Fields, pens, tanks within farms |
| `crop_types` | Reference crop taxonomy |
| `livestock_types` | Livestock reference data |
| `aquaculture_species` | Aquaculture reference data |
| `growing_cycles` | Crop production lifecycle |
| `livestock_batches` | Livestock production batches |
| `aquaculture_cycles` | Aquaculture production cycles |
| `input_inventory` | Agricultural input stock |
| `farm_activities` | Operational activity log |
| `custom_map_points` | User-drawn map markers |
| `custom_point_polygons` | Polygon overlays with metrics and scores |
| `custom_crop_types` | User-defined crop labels |
| `gcc_crop_types` | GCC regional crop catalog |
| `gcc_crop_varieties` | Crop variety catalog |
| `farm_crop_insights` | Per-point production/water/energy totals |

---

## Supply Chain Domain

| Entity | Purpose |
|--------|---------|
| `supply_overview_snapshots` | Daily supply KPI aggregates |
| `supply_flows` | Individual commodity flow records |
| `supply_action_queue` | Open sourcing actions |

---

## Key Relationships

```
Organization ──< Farms ──< Production Units
Organization ──< Custom Map Points ──< Polygons ──< Crop Insights
Organization ──< Supply Flows
User ──< Memberships >── Organization
Role Template ──< Permission Templates
```

---

## Enumeration Types

Core enums include:
- Organization types: `government_master`, `government`, `farm_company`, `private`, `public`
- Farm types: crop, livestock, aquaculture, mixed
- Farm status: active, inactive, pending, suspended
- Invitation status: pending, accepted, expired, revoked
- Supply flow status: in-transit, delivered, at-risk, delayed

---

## Shared Data Layers

Cross-cutting visibility domains applied to modules:

| Layer | Content Domain |
|-------|----------------|
| `regulatory` | Compliance, inspections, water/food security |
| `commercial` | Harvest, traceability, supplier eligibility |
| `finance` | Farm dossier, KPIs, credit |
| `technical_support` | Device health, diagnostics |

Visibility levels: `FULL`, `SUMMARY`, `APPROVAL`, `NO`

---

## Related Notes

- [[10-Auth-Access-Model]]
- [[11-Row-Level-Security]]
- [[05-Intelligence-Workspaces]]
