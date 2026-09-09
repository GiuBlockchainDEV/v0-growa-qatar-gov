# Technology Stack

← [[02-Platform-Architecture]] | [[00-Index]] | Next: [[04-Module-Registry]]

---

## Frontend

| Component | Technology | Role |
|-----------|------------|------|
| Framework | Next.js 16 (App Router) | Server and client rendering, routing, API routes |
| UI Library | React 19 | Component model |
| Language | TypeScript (strict) | Type safety across codebase |
| Styling | Tailwind CSS 4 | Utility-first responsive design |
| Components | shadcn/ui + Radix UI | Accessible, composable UI primitives |
| Maps | Leaflet | Interactive satellite and operational map |
| Charts | Recharts | Analytics visualizations |
| Forms | React Hook Form + Zod | Validated form handling |
| Themes | next-themes | Light/dark mode support |

---

## Backend & Data

| Component | Technology | Role |
|-----------|------------|------|
| Database | PostgreSQL | Relational data store |
| Backend service | Managed auth + database platform | Identity, realtime, storage |
| Auth | SSR-compatible auth client | Session cookies, JWT refresh |
| Migrations | SQL migration files | Versioned schema evolution |
| Security | Row Level Security (RLS) | Database-enforced tenant isolation |

---

## AI & External Services

| Component | Technology | Role |
|-----------|------------|------|
| LLM | Google Gemini (server-side) | Government briefing generation |
| Weather | External weather API (proxied) | Grid-based agronomic data |
| Analytics | Vercel Analytics | Usage telemetry (optional) |

**Security pattern:** All external API keys are held server-side only. Client never receives provider credentials.

---

## Internationalization

| Component | Implementation |
|-----------|----------------|
| Locales | English (`en`), Arabic (`ar`) |
| Direction | Automatic RTL for Arabic |
| Storage | Browser localStorage persistence |
| Dictionaries | Flat key-value translation maps |

See [[13-Internationalization]].

---

## Development Tooling

- Package manager: pnpm
- Linting: ESLint with Next.js config
- Type generation: Database types synced from schema

---

## Architectural Conventions

1. **Server Components first** — Initial data fetched server-side where possible
2. **BFF API routes** — External services called only from server
3. **Context providers** — Theme → Auth → i18n composition at app root
4. **Feature flags** — MFA, SSO, realtime toggled via environment
5. **Idempotent migrations** — Defensive schema evolution for mixed DB states

---

## Related Notes

- [[14-API-Design]]
- [[11-Row-Level-Security]]
- [[12-Growa-AI-Methodology]]
