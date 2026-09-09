# API Design — Backend-for-Frontend Pattern

← [[13-Internationalization]] | [[00-Index]] | Next: [[15-IP-Claims-Summary]]

---

## Overview

Growa uses Next.js API routes as a **Backend-for-Frontend (BFF)** layer. All external service calls and privileged operations execute server-side. The browser never receives provider API keys.

---

## API Categories

### Operations APIs
| Endpoint Pattern | Methods | Purpose |
|------------------|---------|---------|
| `/api/operations/farms` | GET, POST | Farm registry management |
| `/api/operations/custom-map-points` | GET, POST | Map marker CRUD |
| `/api/operations/custom-point-polygons` | GET, POST | Polygon overlay management |
| `/api/operations/farm-crop-insights` | GET, POST | Per-point crop analytics |
| `/api/operations/crop-types` | GET, POST | Custom crop type catalog |

### Weather APIs (Proxied)
| Endpoint Pattern | Methods | Purpose |
|------------------|---------|---------|
| `/api/weather/by-coordinates` | GET | Current weather for lat/lng |
| `/api/weather/history/by-coordinates` | GET | Historical weather data |
| `/api/weather/grid` | GET | National grid weather cells |

### AI APIs
| Endpoint Pattern | Methods | Purpose |
|------------------|---------|---------|
| `/api/ai/growa/analyze` | POST | Server-side Growa AI briefing |

---

## Authentication Pattern

All API routes:
1. Validate session from secure cookies
2. Reject unauthenticated requests (401)
3. Rely on database RLS for data scoping
4. Return only authorized data

---

## Request/Response Conventions

- JSON request and response bodies
- Standard HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Error responses include safe error messages (no stack traces in production)
- Input validation via Zod schemas where applicable

---

## Server-Side Responsibilities

| Responsibility | Layer |
|----------------|-------|
| Session validation | API route middleware |
| Permission checks | API route + application hooks |
| Data scoping | Database RLS |
| External API calls | API route (keys in env only) |
| AI prompt assembly | Server-only AI module |
| Audit logging | Server-side on sensitive operations |

---

## Security Boundaries

```
┌─────────────────────────────────────┐
│  CLIENT (Browser)                   │
│  - Public env vars only             │
│  - Session cookies (HTTP-only)      │
│  - No API keys                      │
├─────────────────────────────────────┤
│  SERVER (Next.js API Routes)        │
│  - All provider API keys            │
│  - AI prompt construction           │
│  - Privileged database operations   │
├─────────────────────────────────────┤
│  DATABASE (PostgreSQL + RLS)        │
│  - Final data access enforcement    │
└─────────────────────────────────────┘
```

---

## Related Notes

- [[12-Growa-AI-Methodology]]
- [[11-Row-Level-Security]]
- [[16-Security-Redaction-Policy]]
