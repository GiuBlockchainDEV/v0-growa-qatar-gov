# Glossary

← [[16-Security-Redaction-Policy]] | [[00-Index]]

---

## Platform Terms

| Term | Definition |
|------|------------|
| **Growa** | Multi-country agricultural operations platform (base) |
| **Growa Qatar** | First sovereign country deployment for the State of Qatar |
| **Country Instance** | Top-level deployment container for a sovereign nation |
| **Country Deployment** | Customized platform instance for a specific country |
| **Sovereign Platform** | National system where data belongs to the deploying state |

---

## Organizational Terms

| Term | Definition |
|------|------------|
| **Organization** | Authorized entity operating within a country deployment |
| **Organization Type** | Classification: government_master, government, farm_company, private, public |
| **Department** | Subdivision within an organization |
| **Membership** | Link between a user and an organization with role assignment |
| **Tenant** | Organization-scoped data boundary |

---

## Access Control Terms

| Term | Definition |
|------|------------|
| **Role Template** | Predefined permission set assigned to users |
| **Permission Flag** | Application-level capability (canView, canEdit, etc.) |
| **Scope Assignment** | Geographic or object-level access boundary |
| **Shared Data Layer** | Cross-cutting visibility domain (regulatory, commercial, finance, technical) |
| **Visibility Level** | Data access granularity: FULL, SUMMARY, APPROVAL, NO |
| **RLS** | Row Level Security — database-enforced data isolation |
| **BFF** | Backend-for-Frontend — server-side API proxy pattern |

---

## Product Terms

| Term | Definition |
|------|------------|
| **Module** | A workspace capability in the platform (e.g., Live Map, Water Intelligence) |
| **Module Registry** | Declarative catalog of all platform modules |
| **Workspace** | Analytical panel that slides over the map shell |
| **Map Shell** | Persistent satellite map underlying all workspaces |
| **Map Point** | User-placed marker on the operational map |
| **Polygon** | Drawn operational area with linked metrics |
| **Crop Insight** | Per-point analytical record (production, water, energy) |

---

## Intelligence Terms

| Term | Definition |
|------|------------|
| **Water Intensity** | Cubic metres of water per ton of crop production (m³/t) |
| **Energy Intensity** | Kilowatt-hours per ton of production (kWh/t) |
| **Irrigation Pressure** | Water's share of total resource consumption |
| **Efficiency Score** | Composite performance metric for producers/areas |
| **At-Risk Producer** | Farm flagged for low efficiency or high resource pressure |
| **Operational Digest** | Pre-computed data summary fed to Growa AI |
| **Growa AI** | Grounded government briefing system |

---

## Technical Terms

| Term | Definition |
|------|------------|
| **i18n** | Internationalization — multi-language support |
| **RTL** | Right-to-left text direction (Arabic) |
| **LTR** | Left-to-right text direction (English) |
| **SSR** | Server-Side Rendering |
| **App Router** | Next.js file-based routing system |
| **Migration** | Versioned database schema change file |
| **RPC** | Remote Procedure Call — database function invoked from application |

---

## Compliance Terms

| Term | Definition |
|------|------------|
| **Non-Conformity** | Documented violation of agricultural standards |
| **Corrective Action** | Required remediation following a non-conformity |
| **Compliance Case** | End-to-end regulatory case with evidence trail |
| **Inspection** | Field verification of agricultural compliance |
| **Evidence** | Documentary proof attached to inspections or cases |

---

← Back to [[00-Index]]
