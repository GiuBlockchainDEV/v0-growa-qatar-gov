# Platform Ontology

← [[02-Black-Box-Architecture]] · [[00-Index]] · [[04-Intelligence-Systems]]

---

## Module Registry

The **Module Registry** is a core IP artifact — a declarative catalog of every workspace capability in the platform.

> [!blackbox] Module Registry Engine
> Defines what each module is, who sees it, and what actions it permits.  
> Resolution algorithm and exact visibility predicates: **protected**.

```typescript
// Abstract module contract — not production source
interface PlatformModule {
  id:           ModuleIdentifier
  purpose:      string
  visibility:   VisibilityGate
  navigation:   RoleAwareMenu
  actions:      ActionDescriptor[]
}

interface VisibilityGate {
  orgTypes:     OrganizationClass[]
  permissions:  CapabilityFlag[]
  dataLayers:   LayerAccessMap        // implementation protected
}
```

---

## Registered Capabilities

> [!card] Executive & National
> National Overview · Monitoring · Production & Harvest · Programs & Policy

> [!card] Spatial Operations
> Live Map · Farms & Sites · Custom Map Objects · Polygon Overlays

> [!card] Regulatory
> Inspection Dashboard · Compliance Cases · Non-Conformities · Corrective Actions · Evidence

> [!card] Risk & Response
> Alerts & Risks · Inter-Agency Collaboration

> [!card] Analytics & Reporting
> Data Analytics · Water Intelligence · Energy Intelligence · Weather · Reports Center

> [!card] Institutional
> Supply Overview · Support · Settings

Each module ships with role-aware labels and submenus. Inspectors and directors see the same capability through different operational lenses.

---

## Navigation Resolution

```
User signs in
    → Identity resolved
    → Organization + role loaded
    → Visibility gates evaluated        [protected]
    → Authorized module surface rendered
```

Three resolution sources (priority order): code registry → database menus → safe fallback.

---

## Data Domains

> [!card] Access & Identity
> Organizations · Memberships · Roles · Invitations · Audit trail

> [!card] Operations
> Farms · Production units · Growing cycles · Map points · Polygons · Crop insights

> [!card] Supply
> Flow snapshots · Commodity movements · Action queue

> [!card] Reference
> Crop catalogs · Regional taxonomies · Bilingual label sets

```typescript
// Abstract tenancy contract — not production source
interface TenantScopedRecord {
  organizationRef: OrganizationId
  locale:          BilingualContent
  geoRef?:         GeoCoordinate
}
// All operational records inherit tenant scope.
// Enforcement mechanism: protected.
```

---

## Shared Data Layers

Cross-cutting visibility domains applied to modules and data:

| Layer | Domain |
|-------|--------|
| `regulatory` | Compliance, inspections, food security |
| `commercial` | Production, harvest, traceability |
| `finance` | Programme KPIs, dossiers |
| `technical` | Device health, diagnostics |

Visibility levels: `FULL` · `SUMMARY` · `APPROVAL_REQUIRED` · `NONE`

Exact assignment rules: **protected**.
