# Module Registry — Core IP Artifact

← [[03-Technology-Stack]] | [[00-Index]] | Next: [[05-Intelligence-Workspaces]]

---

## Overview

The **Module Registry** is a declarative, code-first catalog of every workspace module in the platform. It is a central intellectual property artifact: it encodes product intent, role-aware navigation, visibility rules, and UX blueprints in a single authoritative source.

Unlike ad-hoc route tables, the registry describes **what each module is for**, **who can see it**, and **what actions it supports** — before backend data is wired.

---

## Module Definition Schema

Each module entry contains:

| Field | Purpose |
|-------|---------|
| `id` | Stable module identifier (e.g., `national-overview`) |
| `label` | Display name, with optional role-specific overrides |
| `purpose` | One-line mission statement |
| `defaultContent` | Expected content when module loads |
| `allowedActions` | Permitted user actions in this module |
| `visibilityScope` | Org types, permissions, and data-layer requirements |
| `submenu` | Role-aware navigation items within the module |
| `icon` | Visual identifier for sidebar |

---

## Visibility Scope Model

Modules are shown only when all visibility conditions pass:

```typescript
interface ModuleVisibilityScope {
  allowedOrgTypes: OrgType[] | '*'        // Which organization types
  requiredPermissions: PermissionFlag[]   // Required capability flags
  requiredLayerVisibility?: {             // Shared data layer access
    regulatory?: VisibilityLevel[]
    commercial?: VisibilityLevel[]
    finance?: VisibilityLevel[]
    technical_support?: VisibilityLevel[]
  }
}
```

**Visibility levels:** `FULL`, `SUMMARY`, `APPROVAL`, `NO`

This enables fine-grained control: a module may require regulatory layer access at `SUMMARY` or above, while another requires commercial `FULL` access.

---

## Role-Aware Labels and Submenus

The registry supports **role-specific UX** without duplicating module definitions:

- **Labels:** `ministry_inspector` may see "Alerts & Incidents" where `ministry_admin` sees "Alerts & Risks"
- **Submenus:** Inspector role gets inspection-focused map views; admin gets national map views

This pattern reduces navigation sprawl while preserving role-appropriate language.

---

## Role Menu Blueprints

Predefined navigation layouts per ministry role profile:

### Ministry Admin Blueprint
- **Landing:** National Overview
- **Primary:** National Overview, Live Map, Monitoring, Alerts, Compliance, Production & Harvest
- **Secondary:** Inter-Agency Collaboration, Programs & Policy, Reports, Support, Settings

### Ministry Inspector Blueprint
- **Landing:** Inspection Dashboard
- **Primary:** Inspection Dashboard, Live Map, Compliance Cases, Non-Conformities, Corrective Actions, Alerts
- **Secondary:** Farms & Sites, Evidence & Attachments, Reports, Support, Settings

---

## Registered Modules (Catalog)

| Module ID | Purpose |
|-----------|---------|
| `national-overview` | Sovereign executive situational awareness |
| `inspection-dashboard` | Inspector workload and queue management |
| `live-map` | Primary spatial decision surface |
| `monitoring` | Environmental and data health signals |
| `alerts-center` | Risk triage, escalation, and closure |
| `compliance-inspections` | Regulatory posture and inspection planning |
| `production-harvest` | Production readiness and harvest risk |
| `inter-agency-collaboration` | Cross-agency case and data exchange |
| `programs-policy` | Public program and policy tracking |
| `reports-center` | Institutional reporting packages |
| `compliance-cases` | End-to-end compliance case lifecycle |
| `non-conformities` | Violation severity and recurrence tracking |
| `corrective-actions` | Corrective action execution monitoring |
| `farms-sites` | Institutional farm and site registry views |
| `evidence-attachments` | Inspection evidence lifecycle |
| `support` | Institutional help and service requests |
| `settings` | Workspace configuration |

---

## Navigation Resolution Algorithm

When a user signs in, navigation is resolved through a priority chain:

1. **Code registry** — Ministry role blueprints filtered by visibility
2. **Database menus** — Per-role JSON navigation stored in `role_navigation` table
3. **Fallback** — Default minimal menu for unassigned roles

Each candidate module passes:
- Organization type check
- Permission flag check
- Shared layer visibility check

---

## Route Pattern

Modules use query-parameter routing to avoid 404s for in-progress features:

```
/dashboard?module=national-overview
/dashboard?module=live-map
```

Dedicated routes exist for mature features:
```
/dashboard/farms
/dashboard/supply-overview
/dashboard/settings
```

See [[06-Map-Centric-UX]].

---

## IP Significance

The Module Registry represents a **product ontology** — a machine-readable description of government agricultural software capabilities. It enables:

- Consistent role-based UX across deployments
- Country-specific customization without rewriting navigation
- Auditability of who can access what capability
- Progressive implementation (shell UI before backend wiring)

---

## Related Notes

- [[05-Intelligence-Workspaces]]
- [[07-Compliance-Governance]]
- [[10-Auth-Access-Model]]
- [[15-IP-Claims-Summary]]
