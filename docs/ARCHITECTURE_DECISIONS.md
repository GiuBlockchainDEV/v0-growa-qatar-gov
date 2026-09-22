# Architecture Decisions — Watchtower Program

Concise decision log for major technical choices.

---

## ADR-001: Calculated vs Persisted Signals

**Decision:** Intelligence signals are **calculated on demand** in the Watchtower API, not persisted to database.

**Rationale:** Signals derive from existing operational data. Persistence adds schema complexity and stale-state risk. Caching via HTTP `Cache-Control` (60s) is sufficient for v1.

**Revisit when:** Alert lifecycle requires historical signal audit trail.

---

## ADR-002: Watchtower Aggregation Architecture

**Decision:** Single BFF endpoint `GET /api/watchtower/summary` aggregates all domains server-side with `Promise.all`.

**Rationale:** Avoids browser making 10+ parallel calls. Partial degradation per source (weather down ≠ full crash).

---

## ADR-003: national-overview Backward Compatibility

**Decision:** `?module=national-overview` resolves to `watchtower` in `resolveDashboardPageModule()`. Registry href for `national-overview` points to `?module=watchtower`.

**Rationale:** Preserves existing deep links and role_navigation DB rows without duplicate UI.

---

## ADR-004: Operational Context via URL

**Decision:** Important investigative state remains URL-addressable (`farmId`, `signalId`, `timeframe`, `mapLayer`). No hidden React-only state for navigation context.

**Rationale:** Shareable investigation URLs, browser back/forward, reload resilience.

---

## ADR-005: Demo Data Transparency

**Decision:** All Watchtower objects carry `sourceMode: live | partial | demo | unavailable`. Demo harvest data never presented without explicit labeling.

**Rationale:** National intelligence must not present demo metrics as sovereign truth.

---

## ADR-006: Weather Sampling for Watchtower

**Decision:** Watchtower samples 5 representative Qatar coordinates instead of full 510-cell grid.

**Rationale:** Full grid = 510 upstream API calls. Watchtower needs climate risk indicator, not per-cell detail (Weather module handles that).

---

## ADR-007: Signal vs Alert Hierarchy

**Decision:** `IntelligenceSignal` ≠ formal `Alert`. Signals are auto-generated observations. Alerts require explicit lifecycle (future phase).

**Rationale:** Avoid alert fatigue from minor anomalies.

---

## ADR-008: Server-Safe Normalization

**Decision:** Extract `normalizeInsightRows` / `normalizePolygonRows` to `lib/operations/intelligence-normalize.ts` (no `'use client'`).

**Rationale:** Watchtower BFF and intelligence workspaces must share identical normalization logic.

---

## ADR-009: Ministry Sidebar Sections

**Decision:** Group navigation by conceptual layer (Watchtower, Operations, Intelligence, etc.) only for `isMinistryWorkspace` users.

**Rationale:** Other roles keep flat navigation. Avoid breaking farm_company UX.

---

## ADR-010: AI Context Architecture (Planned)

**Decision:** Growa AI will consume compact structured digests built from Watchtower summary + domain context, not raw DB responses.

**Status:** Phase 13 — not yet implemented for Watchtower module.
