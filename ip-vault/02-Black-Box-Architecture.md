# Black-Box Architecture

← [[01-Corporate-Overview]] · [[00-Index]] · [[03-Platform-Ontology]]

---

## Approach

Growa is documented as a system of **protected components**. Each box exposes a clean interface and a clear value proposition. Internal logic, algorithms, and security predicates remain trade-secret.

> [!blackbox] Black-Box Rule
> Interfaces are published. Implementations are not.

---

## System Topology

```
┌─────────────────────────────────────────────────────────────┐
│  EXPERIENCE LAYER                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Map Shell   │  │  Workspaces  │  │  Role Navigation  │  │
│  │  [protected]│  │  [protected] │  │    [protected]    │  │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬─────────┘  │
├─────────┴────────────────┴───────────────────┴──────────────┤
│  APPLICATION GATEWAY                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Secure API Perimeter          [protected]          │   │
│  └──────────────────────────┬──────────────────────────┘   │
├─────────────────────────────┴───────────────────────────────┤
│  INTELLIGENCE LAYER                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Metrics     │  │  Growa AI    │  │  Weather Proxy   │   │
│  │  Pipeline    │  │  Briefings   │  │                  │   │
│  │  [protected] │  │  [protected] │  │    [protected]   │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  TRUST LAYER                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Identity    │  │  Permission  │  │  Data Isolation  │   │
│  │  Service     │  │  Resolver    │  │  Engine          │   │
│  │  [protected] │  │  [protected] │  │    [protected]   │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Sovereign Data Store          [protected]          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer Contracts (Abstract)

### Experience Layer

```typescript
// Published interface — implementation protected
interface WorkspaceSurface {
  moduleId: ModuleIdentifier
  render(context: AuthorizedContext): ViewModel
  linkToMap(entities: GeoEntity[]): void
}
```

**Delivers:** Map-first UX, role-aware navigation, bilingual presentation.

---

### Application Gateway

```typescript
// Published interface — implementation protected
interface SecureGateway {
  authenticate(request: IncomingRequest): Session | Denied
  proxy(service: ExternalProvider, params: SafeParams): SanitizedResponse
}
```

**Delivers:** Server-side-only external calls. Zero credential exposure to clients.

---

### Intelligence Layer

```typescript
// Published interface — implementation protected
interface IntelligencePipeline {
  aggregate(scope: NationalScope): OperationalDigest
  brief(digest: OperationalDigest, lens: AnalysisLens): ExecutiveBriefing
}
```

**Delivers:** Resource KPIs, producer rankings, grounded government briefings.  
Algorithm internals: **protected**. See [[04-Intelligence-Systems]].

---

### Trust Layer

```typescript
// Published interface — implementation protected
interface PermissionResolver {
  resolve(user: Identity, resource: ResourceRef): AccessDecision
}
// AccessDecision: GRANTED | DENIED | SUMMARY_ONLY | APPROVAL_REQUIRED
```

**Delivers:** Six-layer permission model, database-enforced isolation.  
Policy predicates: **protected**. See [[06-Trust-Boundary]].

---

## Country Deployment Pattern

> [!card] Platform → Country → Organization
> One codebase. Many sovereign instances. Zero cross-country data leakage.

| Layer | Customizable | Shared |
|-------|-------------|--------|
| Branding & legal labels | ✅ | |
| Geography & map data | ✅ | |
| Organization presets | ✅ | |
| Core architecture | | ✅ |
| Module ontology | | ✅ |
| Intelligence frameworks | | ✅ |

---

## Technology Surface (Non-Secret)

| Domain | Choice |
|--------|--------|
| Application framework | Modern SSR web framework |
| Language | Strongly-typed application language |
| Data store | Relational database with row-level security |
| Identity | Managed authentication service |
| AI provider | Server-side LLM integration |
| UI system | Accessible component library |

Specific versions and configurations: deployment-specific, not published.
