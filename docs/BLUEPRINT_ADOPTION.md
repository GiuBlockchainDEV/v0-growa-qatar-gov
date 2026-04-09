# Growa Qatar Blueprint Adoption

**Date:** 2026-04-09  
**Document:** Growa Qatar Master Implementation Blueprint for Vercel v0, Stitch, and Supabase  
**Status:** ADOPTED AS SOURCE OF TRUTH

## Governing Principle

This project is governed by the **Growa Qatar Master Implementation Blueprint** (`Growa_Qatar_v0_Supabase_Implementation_Blueprint.pdf`). 

- The blueprint is the default source of truth for product scope, architecture, sequencing, Supabase usage, Vercel deployment boundaries, security rules, when to use Stitch, and how to validate output.
- When future prompts conflict with the blueprint, resolution order is: **direct user instruction for the current step → blueprint → v0's own assumptions**.
- v0 is not allowed to invent product direction on its own.

## Operating Rules

1. **Work strictly one approved step at a time.** Never implement future steps without explicit instruction.
2. **Never anticipate later features, data structures, screens, or flows** unless technically required by the active step.
3. **Before each step**, briefly restate the step objective and list the constraints from the blueprint that apply.
4. **After each step**, self-audit the output against the blueprint and confirm alignment.
5. **If visual exploration is needed**, use Stitch first only where the blueprint permits it; then return to v0 for implementation.
6. **Never use Stitch as the source of truth** for security, schema, RLS, access control, or backend logic.
7. **Keep the app bilingual-ready** for English and Arabic with RTL/LTR support.
8. **Keep the product country-customized**, Qatar-first, and extensible to future GCC deployments.
9. **Do not merge unrelated work** into the current step.
10. **Keep all artifacts, prompts, Stitch outputs, and implementation notes** in version control for auditability.

## v0 Response Format for Every Step

Every response after a step assignment follows this structure:

- **Step objective:** One short paragraph restating the active task.
- **Document constraints applied:** A compact bullet list of rules taken from the blueprint.
- **Assumptions:** Only minimal assumptions that are explicitly stated.
- **Stitch decision:** Whether Stitch is required, optional, or forbidden for this step.
- **Supabase impact:** Whether the step changes schema, policies, seed data, auth behavior, or none.
- **Output:** Only the deliverable requested for this step.
- **Self-check:** A brief note on how the output aligns with the blueprint.
- **Stop line:** 'Step complete. Waiting for next step.'

## Key Modules (Phased Roadmap)

The canonical sequence is not to be reordered without explicit user instruction:

1. **Phase 0** — Operating contract and repository baseline
2. **Phase 1** — Deployment, organization, and access architecture
3. **Phase 2** — Authentication and access UX
4. **Phase 3** — Design system and reusable application shell
5. **Phase 4** — Operational ontology and data contracts
6. **Phase 5** — Map-centric desktop shell
7. **Phase 6** — Core workflows and operational modules
8. **Phase 7** — Reporting and executive visibility
9. **Phase 8** — Mobile experiences
10. **Phase 9** — Hardening, tests, and release readiness

## Non-Negotiable Product Principles

- **No public self-signup.** Invitation-only or organization-provisioned onboarding.
- **Not ministry-only.** Multi-organization inside one sovereign Qatar deployment.
- **Map is not decorative.** It is the central operational surface.
- **Precision agriculture DNA.** Real-time data evaluation, irrigation, fertigation, alerts, compliance.
- **Dark enterprise aesthetic.** Quietly premium, operational, dense, clean.
- **Country-customized.** Qatar-first, extensible to future GCC deployments.

## Audit Trail

All implementation decisions, Stitch outputs, approved visual direction, and prompts will be documented in `docs/` to keep the workflow auditable and reproducible.

---

**Step 0.1 Complete.** Awaiting Step 0.2 assignment.
