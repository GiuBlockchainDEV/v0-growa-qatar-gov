# Growa Qatar — Piattaforma Operativa Agricola Nazionale

**Growa Qatar** è il centro di comando digitale sovrano per il monitoraggio e la gestione delle operazioni agricole dello Stato del Qatar. La piattaforma integra mappa satellitare, meteo, analisi idrica ed energetica, previsioni di raccolto, intelligence operativa, feed RSS e un assistente AI governativo — tutto in un unico workspace sicuro, multilingue e multi-organizzazione.

> **Versione:** 0.1.0 · **Stato:** sviluppo attivo · **Licenza:** proprietaria — Ministry of Social Development & Family, Qatar

---

## Indice

1. [Panoramica](#panoramica)
2. [Architettura](#architettura)
3. [Stack tecnologico](#stack-tecnologico)
4. [Moduli della dashboard](#moduli-della-dashboard)
5. [Assistente Growa AI](#assistente-growa-ai)
6. [Autenticazione, ruoli e permessi](#autenticazione-ruoli-e-permessi)
7. [API e integrazioni esterne](#api-e-integrazioni-esterne)
8. [Database e migrazioni](#database-e-migrazioni)
9. [Struttura del progetto](#struttura-del-progetto)
10. [Avvio locale](#avvio-locale)
11. [Variabili d'ambiente](#variabili-dambiente)
12. [Deploy](#deploy)
13. [Documentazione aggiuntiva](#documentazione-aggiuntiva)

---

## Panoramica

Growa è una **piattaforma foundation** condivisa; **Growa Qatar** è la sua prima implementazione sovrana per paese (codice `QA`), con database Supabase isolato per produzione.

### Obiettivi principali

- Fornire a ministeri, ispettori, operatori alimentari statali, istituzioni finanziarie e aziende agricole un workspace unico e sicuro
- Offrire consapevolezza situazionale geografica (map-first) su tutto il territorio del Qatar
- Garantire isolamento dei dati per organizzazione tramite Row Level Security (RLS)
- Supportare operazioni bilingue (inglese + arabo, layout LTR/RTL)
- Integrare servizi esterni (Harvest satellite API, Weather API, Gemini AI) tramite route BFF server-side, senza esporre credenziali al browser

### Utenti target

| Profilo | Caso d'uso |
|---------|------------|
| **Ministry Admin** | Panoramica nazionale, policy, programmi, collaborazione inter-agenzia |
| **Ministry Inspector** | Ispezioni, conformità, casi, evidenze |
| **Hassad / Supply** | Overview della supply chain alimentare |
| **Farm Company** | Gestione aziende agricole, campi, metriche |
| **Utente normale (@growa.ai)** | Vista ridotta per demo e test |

---

## Architettura

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React 19)                        │
│  Dashboard shell · Sidebar · Header · Workspace modules          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                   Next.js 16 App Router (BFF)                    │
│  /api/operations/*  /api/harvest/*  /api/weather/*  /api/ai/*   │
│  /api/rss/feeds                                                 │
└──────┬──────────────────┬──────────────────┬────────────────────┘
       │                  │                  │
┌──────▼──────┐  ┌────────▼────────┐  ┌──────▼──────┐
│  Supabase   │  │  Harvest API    │  │ Weather API │
│ PostgreSQL  │  │ harvest.growa.ai│  │  (Vercel)   │
│  + Auth     │  │  (FastAPI)      │  │             │
└─────────────┘  └─────────────────┘  └─────────────┘
       │
┌──────▼──────┐
│  Gemini AI  │
│  (Google)   │
└─────────────┘
```

### Pattern architetturali chiave

| Pattern | Descrizione |
|---------|-------------|
| **Map-centric dashboard** | La maggior parte dei moduli si apre come pannello laterale sopra `SatelliteMap`, guidato dal parametro URL `?module=` |
| **BFF proxy** | Harvest, Weather e Gemini sono chiamati solo da route server-side; le credenziali non arrivano mai al client |
| **Navigazione per ruolo** | `lib/navigation/module-registry.ts` + `hooks/use-role-navigation.ts` + tabella Supabase `role_navigation` |
| **Deep-linking URL** | `farmId`, `pointId`, `crop`, `zoom`, `focus`, `parcelId`, `weatherLat`/`Lng` per navigazione diretta sulla mappa |
| **Demo fallback** | Harvest serve dati demo realistici quando le credenziali API non sono configurate |

### Routing moduli

La dashboard principale è su `/dashboard`. Il modulo attivo è determinato da `?module=<chiave>`:

- **Moduli mappa** (schermo intero): `live-map`, `map`, `national-map`, `inspection-map`
- **Moduli workspace** (pannello 75% + mappa 25%): `weather`, `harvest`, `data-analytics`, `water-intelligence`, `energy-intelligence`, `rss-feed`
- **Moduli registry** (placeholder strutturato): `national-overview`, `inspection-dashboard`, `alerts-center`, ecc.

La logica di routing è centralizzata in `lib/dashboard/map-navigation.ts` e `app/dashboard/page.tsx`.

---

## Stack tecnologico

| Layer | Tecnologia |
|-------|------------|
| **Framework** | Next.js 16.2 (App Router), React 19.2, TypeScript 5.7 |
| **Stile / UI** | Tailwind CSS 4, shadcn/ui (Radix UI), Lucide icons, next-themes (dark default) |
| **Database** | PostgreSQL via Supabase |
| **Autenticazione** | Supabase Auth (email + password, verifica email, OAuth callback) |
| **Sessione** | `@supabase/ssr` — cookie server/client; `proxy.ts` per refresh sessione |
| **Mappe** | Leaflet + basemap satellitare ArcGIS World Imagery |
| **Grafici** | Recharts |
| **AI** | Google Generative AI (`@google/generative-ai`) — modello default `gemini-3.5-flash` |
| **Harvest** | API FastAPI esterna su `https://harvest.growa.ai` |
| **Meteo** | API esterna su `https://weather-api-delta-tawny.vercel.app` |
| **RSS** | Fetch server-side + parser XML di feed curati Golfo/Qatar |
| **Analytics** | Vercel Analytics (solo produzione) |
| **Validazione** | Zod, react-hook-form |
| **i18n** | Context custom (`lib/i18n`) con locale `en` e `ar` |
| **Deploy** | Vercel (primario); qualsiasi host Node.js 18+ |

---

## Moduli della dashboard

### Live Map (`?module=live-map`)

Il modulo principale e la superficie operativa predefinita.

- Basemap satellitare centrata sul Qatar (25.3548°N, 51.1839°E)
- Visualizzazione farms Supabase, punti custom sulla mappa, poligoni operativi
- Ricerca nell'header su farms e punti → fly-to automatico
- Deep-link: `farmId`, `pointId`, `crop`, `zoom`, `focus`
- Modalità disegno poligoni (vertice / rettangolo / cerchio) per admin Growa
- Filtro per coltura sui poligoni
- Insights per punto: produzione, energia, acqua, score

### Weather (`?module=weather`)

Intelligence meteo-agronomica su griglia nazionale.

- **Griglia Qatar a 5 km** — 510 celle (`lib/weather/qatar-grid.ts`)
- Metriche: luce/solare, temperatura/umidità/VPD, vento, pioggia, irrigazione (ET0, stress idrico, spray drift), rischio agronomico (funghi, stress termico)
- Click su cella della griglia sulla mappa → aggiorna `weatherLat`, `weatherLng`, `weatherGridId` nell'URL
- Grafici storici nel pannello laterale
- API: `/api/weather/by-coordinates`, `/api/weather/history/by-coordinates`, `/api/weather/grid`

### Harvest Prediction (`?module=harvest`)

Previsioni di raccolto e analisi satellitare a livello nazionale e per campo.

- Metriche: **AETI** (acqua), **NPP**, **TBP** (biomassa), **BWP**, **RWD**, **WCU**, costo irrigazione (QAR)
- Overlay mappa: poligoni campo, raster satellitari, tile URL
- Dettaglio campo: statistiche CSV, serie temporali, trigger stima resa, selezione stagione
- **Creazione campo:** disegno poligono/cerchio sulla mappa → `POST /api/harvest/entity`
- Modalità demo con campi realistici quando le credenziali API mancano
- Pannello Growa AI con contesto harvest-specifico

### Data Analytics (`?module=data-analytics`)

Vista unificata di performance colture, risorse e produttori.

- Aggrega `farm_crop_insights` + `custom_point_polygons` + etichette punti mappa
- KPI: produzione totale, acqua, energia, score di efficienza
- Matrice per coltura e ranking produttori (più/meno efficienti)
- Click su riga → navigazione mappa con focus su coltura/produttore
- Layout a tre colonne: dati principali · insights · assistente Growa

### Water Intelligence (`?module=water-intelligence`)

Analisi consumo idrico e pressione irrigua.

- Consumo totale m³, intensità m³/ton, pressione irrigua per coltura
- Card produttori con efficienza idrica
- Navigazione mappa dalle tabelle
- Growa AI: briefing policy acqua, conservazione, resilienza siccità

### Energy Intelligence (`?module=energy-intelligence`)

Analisi consumo energetico agricolo.

- Consumo kWh totale, intensità kWh/ton, medie per farm
- Ranking colture e produttori per efficienza energetica
- Growa AI: briefing efficienza energetica e policy

### RSS Feed (`?module=rss-feed`)

Notizie agricole e agritech live da fonti Golfo e Qatar.

**Fonti collegate:**

| Fonte | Regione |
|-------|---------|
| AgriTech Middle East & Africa | GCC |
| AgFunder News | Global |
| Google News — Qatar Agriculture | Qatar |
| Google News — GCC Food & Agriculture | GCC |
| Qatar Tribune | Qatar |
| Gulf Times | GCC |
| Gulf Times — Qatar | Qatar |
| Arab News | GCC |

- Categorie: policy, market, water, weather, technology
- Filtro per categoria + ricerca testuale
- Cache server 5 minuti (`GET /api/rss/feeds`)
- Refresh manuale dall'UI

### Moduli ministry (registry)

Definiti in `lib/navigation/module-registry.ts`, renderizzati tramite `ModuleWorkspace` con KPI e code di lavoro strutturate. Backend completo in fase di integrazione per la maggior parte:

| Modulo | Descrizione |
|--------|-------------|
| `national-overview` | Panoramica esecutiva nazionale |
| `inspection-dashboard` | Dashboard ispettori |
| `monitoring` | Monitoraggio ambientale e telemetria |
| `alerts-center` | Centro allerte e rischi |
| `compliance-inspections` | Ispezioni e conformità |
| `inter-agency-collaboration` | Collaborazione inter-agenzia |
| `programs-policy` | Programmi e policy |
| `reports-center` | Report e analytics istituzionali |
| `compliance-cases` | Casi di conformità |
| `non-conformities` | Non conformità |
| `corrective-actions` | Azioni correttive |
| `farms-sites` | Registro farms e siti |
| `evidence-attachments` | Evidenze e allegati |

### Pagine dedicate

| Route | Stato |
|-------|-------|
| `/dashboard/farms` | Funzionale — lista farms da API |
| `/dashboard/supply-overview` | Funzionale — metriche supply Hassad |
| `/dashboard/settings` | Impostazioni workspace |
| `/dashboard/settings/organizations` | Gestione organizzazioni |
| `/dashboard/settings/data-sharing` | Governance condivisione dati |
| `/dashboard/cycles` | Placeholder |
| `/dashboard/inventory` | Placeholder |
| `/dashboard/analytics` | Placeholder |
| `/dashboard/team` | Placeholder |
| `/dashboard/support` | Supporto |

---

## Assistente Growa AI

Assistente governativo integrato nei workspace di intelligence, powered by **Google Gemini**.

### Moduli supportati

- `data-analytics`
- `water-intelligence`
- `energy-intelligence`
- `harvest`

### Funzionalità

- Briefing esecutivi, segnali di rischio, azioni raccomandate, gap nei dati
- Prompt predefiniti per scenario + messaggi custom
- Conversazione multi-turn con storico
- Output strutturato in markdown
- **Grounded** esclusivamente sul digest operativo — non inventa dati

### API

```
POST /api/ai/growa/analyze
```

Body: `{ module, prompt, context, messages? }`

Richiede autenticazione Supabase. Il contesto operativo viene costruito da `lib/ai/build-growa-context.ts` con dati reali del workspace attivo.

---

## Autenticazione, ruoli e permessi

### Flusso autenticazione

1. Registrazione su `/auth/sign-up` → verifica email obbligatoria
2. Link email → `/auth/callback?code=...` → sessione stabilita
3. Login su `/auth/login` → redirect a `/dashboard`
4. Layout dashboard verifica `useAuth()` — utenti non autenticati → login
5. Refresh sessione gestito da `proxy.ts`

### Tipi di organizzazione

`government_master`, `government`, `farm_company`, `private`, `public`

### Ruoli principali

| Ruolo | Profilo |
|-------|---------|
| `ministry_admin` / `ministry_super_admin` | Workspace ministero completo |
| `ministry_officer` / `ministry_inspector` | Workspace ispettivo |
| `sourcing_manager` / `hassad_admin` | Supply overview Hassad |
| `finance_officer` / `credit_analyst` | Vista finanza |
| `farm_manager` / `farm_company_admin` | Gestione azienda agricola |

### Permessi (flag)

`canView`, `canEdit`, `canManageUsers`, `canDeleteOrganization`, `canShareData`, `canViewRegulatory`, `canViewCommercial`, `canViewFinance`, `canViewTechnical`

### Layer dati condivisi

`regulatory`, `commercial`, `finance`, `technical_support` — livelli: `FULL`, `SUMMARY`, `APPROVAL`, `NO`

### Risoluzione navigazione

1. Admin **@growa.ai** (modalità normale): menu minimo (live-map, harvest, rss-feed, data-analytics)
2. Admin **@growa.ai** in impersonation: ruolo da RPC `get_effective_role`
3. Ruoli ministry: profili `ministry_admin` / `ministry_inspector` → registry moduli
4. Altri ruoli: tabella Supabase `role_navigation`
5. Utenti non assegnati: fallback minimo

### Landing page per ruolo

| Ruolo | Landing |
|-------|---------|
| Ministry Admin | `/dashboard?module=national-overview` |
| Ministry Inspector | `/dashboard?module=inspection-dashboard` |
| Hassad Supply | `/dashboard/supply-overview` |
| Default | `/dashboard?module=live-map` |

### Impersonation

`ViewAsSelector` + `use-impersonation.ts` permettono agli admin `@growa.ai` di impersonare combinazioni org/ruolo per test.

---

## API e integrazioni esterne

### Operations (Supabase, auth richiesta)

| Route | Metodi | Descrizione |
|-------|--------|-------------|
| `/api/operations/farms` | GET, POST | Lista/ricerca farms (`?q=`, `?id=`); creazione farm |
| `/api/operations/custom-map-points` | GET, POST, PATCH, DELETE | Marker mappa (lat/lng, label, tipo, URL esterno) |
| `/api/operations/custom-point-polygons` | GET, POST, PATCH, DELETE | Poligoni operativi collegati ai punti |
| `/api/operations/farm-crop-insights` | GET, POST | Metriche produzione/acqua/energia per punto |
| `/api/operations/crop-types` | GET, POST, PATCH | Catalogo tipi coltura custom |

### Weather (proxy API esterna)

| Route | Descrizione |
|-------|-------------|
| `GET /api/weather/by-coordinates` | Meteo/agronomia corrente per lat/lng |
| `GET /api/weather/grid` | Meteo batch per celle griglia Qatar |
| `GET /api/weather/history/by-coordinates` | Timeline storica |

### Harvest (proxy API FastAPI, auth richiesta)

| Route | Descrizione |
|-------|-------------|
| `GET /api/harvest/fields` | Lista campi analytics |
| `GET /api/harvest/map/fields` | GeoJSON campi per mappa |
| `GET /api/harvest/map/tile-url` | URL tile satellitare |
| `GET /api/harvest/analytics` | Aggregati nazionali |
| `GET /api/harvest/timeseries` | Serie temporali metriche |
| `GET /api/harvest/parcel/[parcelId]` | GeoJSON parcel |
| `POST /api/harvest/entity` | Crea nuovo campo |
| `GET /api/harvest/field/[parcelId]/stats` | Statistiche CSV campo |
| `GET /api/harvest/field/[parcelId]/raster` | Metadata raster |
| `GET /api/harvest/field/[parcelId]/raster/image` | Immagine raster georeferenziata |
| `GET /api/harvest/yield/[mode]/[parcelId]/[seasonId]` | Trigger stima resa |
| `GET /api/harvest/task/[taskId]` | Polling task asincrono |

Header `X-Harvest-Demo: true` quando vengono serviti dati demo.

### AI

| Route | Descrizione |
|-------|-------------|
| `POST /api/ai/growa/analyze` | Analisi Gemini per moduli intelligence |

### RSS

| Route | Descrizione |
|-------|-------------|
| `GET /api/rss/feeds` | Aggrega feed RSS curati (`?limit=1-100`); cache 300s |

---

## Database e migrazioni

**Engine:** PostgreSQL (Supabase) con RLS su tutte le tabelle applicative.

### Tabelle principali

| Area | Tabelle |
|------|---------|
| **Auth/access** | `profiles`, `organizations`, `user_organization_members`, `role_navigation`, `role_delegations`, `user_impersonation_state`, `audit_logs` |
| **Operations** | `farms`, `production_units`, `growing_cycles`, `input_inventory`, `farm_activities` |
| **Mappa/analytics** | `custom_map_points`, `custom_point_polygons`, `farm_crop_insights`, `custom_crop_types`, `gcc_crop_types` |
| **Supply** | `supply_overview_snapshots`, `supply_flows`, `supply_action_queue` |

### Migrazioni

Le migrazioni sono in `supabase/migrations/` (27+ file SQL). Vengono applicate automaticamente con Supabase CLI o tramite integrazione v0.

```bash
# Setup locale con Supabase CLI
npm install -g supabase
supabase init
supabase start
supabase db reset    # Applica migrazioni + seed.sql
```

Tipi TypeScript generati: `supabase/types/database.ts`

---

## Struttura del progetto

```
growa-qatar/
├── app/
│   ├── auth/                         # login, sign-up, callback, error
│   ├── dashboard/                    # Shell dashboard + sub-route
│   │   ├── layout.tsx                # Sidebar, header, auth guard
│   │   ├── page.tsx                  # Router moduli map-centric
│   │   ├── farms/, supply-overview/, settings/, ...
│   └── api/
│       ├── operations/               # Farms, map points, polygons, insights
│       ├── harvest/                  # Proxy Harvest API
│       ├── weather/                  # Proxy Weather API
│       ├── ai/growa/                 # Assistente Gemini
│       └── rss/                      # Aggregatore feed RSS
├── components/
│   ├── dashboard/                    # Workspace, mappa, assistente, UI moduli
│   └── ui/                           # shadcn component library
├── contexts/
│   ├── role-navigation-context.tsx   # Navigazione ruolo condivisa
│   └── harvest-dashboard-context.tsx # Stato harvest (selezione campo, metriche)
├── features/auth-access/             # AuthProvider
├── hooks/                            # auth, org, permissions, role nav, impersonation
├── lib/
│   ├── ai/                           # Growa assistant (prompts, context, digest)
│   ├── dashboard/                    # map-navigation, weather-url
│   ├── harvest/                      # Client API, demo, geojson, raster
│   ├── i18n/                         # Locale en/ar
│   ├── navigation/                   # module-registry.ts
│   ├── rss/                          # Feed sources, fetch, parse, classify
│   ├── supabase/                     # Client server/browser
│   └── weather/                      # Griglia Qatar 5km
├── supabase/
│   ├── migrations/                   # SQL migrations
│   ├── seed.sql
│   └── types/database.ts
├── docs/                             # Documentazione architetturale
└── proxy.ts                          # Middleware refresh sessione
```

---

## Avvio locale

### Prerequisiti

- Node.js 18+
- npm, pnpm o yarn
- Progetto Supabase (hosted o locale via CLI)

### Installazione

```bash
git clone <repository-url>
cd growa-qatar

# Installa dipendenze
npm install

# Configura variabili d'ambiente
cp .env.example .env.local
# Compila Supabase URL/keys e, opzionalmente, Harvest/Weather/Gemini
```

### Sviluppo

```bash
npm run dev
# Apri http://localhost:3000
```

### Build produzione

```bash
npm run build
npm start
npm run lint
```

### Primo utilizzo

1. Vai su `http://localhost:3000` → registrati o accedi
2. Verifica email (controlla inbox o dashboard Supabase)
3. Crea/unisciti a una organizzazione in `/dashboard/settings`
4. Esplora i moduli dalla sidebar:
   - Live Map: `/dashboard?module=live-map`
   - Weather: `/dashboard?module=weather`
   - Harvest: `/dashboard?module=harvest`
   - Data Analytics: `/dashboard?module=data-analytics`
   - RSS Feed: `/dashboard?module=rss-feed`

---

## Variabili d'ambiente

Copia `.env.example` → `.env.local`. **Non committare mai secret reali.**

### Deployment / app (client)

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `NEXT_PUBLIC_DEPLOYMENT_ENV` | `local` | `local` \| `preview` \| `staging` \| `production` |
| `NEXT_PUBLIC_COUNTRY_CODE` | `QA` | Codice paese |
| `NEXT_PUBLIC_COUNTRY_NAME` | `Qatar` | Nome paese |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `en` | Locale default |
| `NEXT_PUBLIC_SUPPORTED_LOCALES` | `en,ar` | Locali supportati |

### Supabase

| Variabile | Scope | Descrizione |
|-----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client | URL progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Chiave anon/publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server** | Client admin per ricerca farms |

### Harvest API (solo server)

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `HARVEST_API_URL` | `https://harvest.growa.ai` | Base URL Harvest FastAPI |
| `HARVEST_SERVICE_USERNAME` | — | Account servizio BFF |
| `HARVEST_SERVICE_PASSWORD` | — | Password account servizio |
| `HARVEST_DEMO_MODE` | auto | `true` = forza demo; `false` = solo live |

### Growa AI (solo server)

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `GEMINI_API_KEY` | — | Chiave Google Generative AI |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Override modello |

### Weather API (solo server)

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `WEATHER_API_BASE_URL` | `https://weather-api-delta-tawny.vercel.app` | URL upstream |
| `WEATHER_API_KEY` | — | Chiave API (accetta anche alias `QATAR_WEATHER_API_KEY`, ecc.) |

---

## Deploy

### Vercel (raccomandato)

1. Push del codice su GitHub
2. Importa il progetto in Vercel
3. Configura le variabili d'ambiente (Supabase, Harvest, Weather, Gemini)
4. Deploy

### Altri host

L'app gira su qualsiasi piattaforma Node.js 18+ (Netlify, AWS, DigitalOcean, ecc.). Assicurati che tutte le variabili d'ambiente server-side siano configurate.

---

## Internazionalizzazione

- **Inglese** e **Arabo** con switch LTR/RTL
- Toggle lingua nel menu utente
- Etichette sidebar in arabo per i moduli principali
- Nomi farm bilingue (`name_en`, `name_ar`)

---

## Sicurezza

- Row Level Security (RLS) su tutte le tabelle
- Isolamento dati per organizzazione
- Verifica email obbligatoria prima dell'accesso
- Sessioni gestite da Supabase Auth con cookie httpOnly
- Credenziali API esterne solo server-side (pattern BFF)
- Nessuna credenziale hardcoded nel codice

---

## Documentazione aggiuntiva

Documentazione architetturale dettagliata in `/docs/`:

| Documento | Contenuto |
|-----------|-----------|
| [PLATFORM_FUNCTIONS.md](./docs/PLATFORM_FUNCTIONS.md) | Funzioni piattaforma |
| [PLATFORM_MODEL.md](./docs/PLATFORM_MODEL.md) | Modello piattaforma |
| [AUTH_STRATEGY.md](./docs/AUTH_STRATEGY.md) | Strategia autenticazione |
| [RLS_STRATEGY.md](./docs/RLS_STRATEGY.md) | Row Level Security |
| [ROLE_PERMISSIONS.md](./docs/ROLE_PERMISSIONS.md) | Ruoli e permessi |
| [ENVIRONMENT_STRATEGY.md](./docs/ENVIRONMENT_STRATEGY.md) | Strategia ambienti |
| [DATA_MODEL_AUTH_ACCESS.md](./docs/DATA_MODEL_AUTH_ACCESS.md) | Modello dati auth |
| [DATA_MODEL_OPERATIONS.md](./docs/DATA_MODEL_OPERATIONS.md) | Modello dati operations |
| [IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md) | Stato implementazione |
| [SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md) | Setup Supabase |

---

## Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| Variabili Supabase mancanti | Verifica `.env.local`, riavvia il dev server |
| Verifica email richiesta | Controlla inbox o dashboard Supabase Auth |
| Organizzazione non visibile | Verifica `user_organization_members` e policy RLS |
| Harvest in modalità demo | Configura `HARVEST_SERVICE_USERNAME`/`PASSWORD` o imposta `HARVEST_DEMO_MODE=true` |
| Growa AI non risponde | Verifica `GEMINI_API_KEY` |
| Feed RSS vuoti | Alcune fonti possono essere temporaneamente down; premi Refresh |
| Mappa non fa fly-to su farm | Il farm deve avere coordinate GPS nel database |

---

## Licenza

Proprietaria — Ministry of Social Development & Family, Qatar

---

**Ultimo aggiornamento:** Settembre 2026 · **Versione:** 0.1.0 · **Stato:** Sviluppo attivo
