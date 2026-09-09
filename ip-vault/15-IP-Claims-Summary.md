# IP Claims Summary

← [[14-API-Design]] | [[00-Index]] | Next: [[16-Security-Redaction-Policy]]

---

## Purpose

This note summarizes the proprietary intellectual property embodied in the Growa platform, suitable for IP deposit, trade secret classification, or patent portfolio planning.

---

## Category 1: Platform Architecture

### Claim: Multi-Country Sovereign Deployment Model
A three-layer hierarchy (Platform → Country Deployment → Organization) enabling reusable codebase with sovereign data isolation per country instance.

**Novel elements:**
- Country-agnostic base with deployment-specific customization layer
- Isolated database per sovereign deployment
- Shared operational ontology across countries

---

## Category 2: Module Registry System

### Claim: Declarative Government Workspace Ontology
A code-first catalog defining workspace modules with role-aware labels, visibility scopes, shared data layer requirements, and navigation blueprints.

**Novel elements:**
- Role-specific label and submenu overrides within single module definitions
- Six-dimensional visibility scope (org type + permissions + shared layers)
- Progressive implementation pattern (shell UI before backend wiring)
- Ministry role menu blueprints with filtered resolution algorithm

---

## Category 3: Map-Centric UX

### Claim: Persistent Map Shell with Bidirectional Data-Map Linking
An analytical dashboard where the satellite map remains mounted while workspace panels slide over it, with every data table row linked to geographic coordinates.

**Novel elements:**
- Map-as-operating-surface (not map-as-widget)
- Role-aware map modes from single map instance
- Custom polygon overlays with embedded resource metrics and scores

---

## Category 4: Resource Intelligence Pipeline

### Claim: Cross-Resource Agricultural Performance Analytics
A metrics pipeline from map polygons through crop insights to national KPIs, producer rankings, and at-risk identification across water, energy, and production dimensions.

**Novel elements:**
- Water intensity (m³/t) and energy intensity (kWh/t) per crop and per producer
- Irrigation pressure as water share of total resources
- Unified efficiency scoring across resource dimensions
- National crop matrix with share percentages

---

## Category 5: Grounded Government AI

### Claim: Evidence-Based Government Briefing System
A structured AI pipeline that pre-computes an operational digest from live platform data before LLM invocation, with anti-hallucination guardrails and fixed executive output schema.

**Novel elements:**
- Operational digest as single source of truth for LLM
- Module-specific analytical frameworks and preset prompts
- Five-section fixed briefing format (Summary → Evidence → Risks → Actions → Gaps)
- Explicit data gap transparency as first-class output
- No autonomous decision-making; human authority preserved

---

## Category 6: Layered Permission Model

### Claim: Six-Layer Permission Resolution
Effective permissions computed from country instance, organization, department, geographic scope, object scope, and action permissions — never flattened to a single role string.

**Novel elements:**
- Shared data layer visibility (regulatory, commercial, finance, technical)
- Four visibility levels (FULL, SUMMARY, APPROVAL, NO)
- Database RPC functions for complex authorization resolution
- Dual navigation resolution (code registry + database menus)

---

## Category 7: Bilingual Sovereign Platform

### Claim: RTL/LTR Agricultural Government Platform
Full bilingual operation with automatic layout direction switching, bilingual data model fields, and country-specific locale configuration.

---

## Trade Secret vs. Publishable

| Asset | Classification |
|-------|----------------|
| Module registry definitions | Publishable (this vault) |
| Growa AI prompt templates | Trade secret |
| Operational digest algorithms | Publishable (conceptual) |
| RLS policy predicates | Confidential (excluded) |
| API keys and credentials | Confidential (excluded) |
| Role-permission exact mappings | Trade secret |
| Weather grid generation logic | Trade secret |

---

## Related Notes

- [[04-Module-Registry]]
- [[12-Growa-AI-Methodology]]
- [[10-Auth-Access-Model]]
- [[16-Security-Redaction-Policy]]
