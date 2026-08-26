# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpécimenManager is a PERN-stack (PostgreSQL + Express + React + Node.js) web application for **Institut Pasteur Madagascar** to track entomological field specimens (mosquitoes, ticks, fleas) collected during research missions.

## Commands

### Database (Docker)
```bash
docker-compose up -d        # Start PostgreSQL on port 5435
docker-compose down         # Stop the database
```

### Backend (Express + Prisma)
```bash
cd backend
npm run dev                 # Development server with nodemon (port 3000)
npm start                   # Production start
npm run seed                # Seed reference data

npx prisma migrate dev      # Apply schema changes and generate client
npx prisma generate         # Regenerate Prisma client after schema edit
npx prisma studio           # Visual DB browser at http://localhost:5555
```

### Frontend (React + Vite)
```bash
cd frontend
npm run dev                 # Dev server at http://localhost:5173
npm run build               # Production build to dist/
npm run lint                # ESLint check
npm run preview             # Preview production build
```

## Architecture

### Data Hierarchy
The core domain follows a strict containment chain:

```
Projet → Mission → Localité → MethodeCollecte → Specimen (Moustique | Tique | Puce)
```

Specimens are always linked to a `MethodeCollecte`, never directly to a Localité or Mission. Hôtes (host animals) are linked to `MethodeCollecte` as well, and tiques/puces can optionally reference a Hôte.

### Backend (`backend/`)

- **Entry**: `server.js` → `src/app.js`
- **ORM**: Prisma with PostgreSQL. Schema lives in `prisma/schema.prisma`. The generated client is configured as a singleton in `src/config/prisma.js`.
- **Routes**: `src/routes/` — flat routes for projets/missions/localites/methodes, nested under `src/routes/specimens/` for specimen types.
- **Controllers**: `src/controllers/` — each controller handles CRUD + Excel import/export (via ExcelJS). The Excel import columns are positional (column 1 = genre, 2 = espece, etc.) with a mandatory header row that is skipped.
- **Auth**: JWT bearer tokens verified by `src/middlewares/auth.middleware.js`. Two guards: `requireRole(...roles)` for exact role matching, `requireMinRole(role)` for hierarchical checks.

**Role hierarchy** (highest to lowest, see `src/middlewares/auth.middleware.js`): `admin` (5) > `superviseur` (4) > `chercheur` (3) > `technicien` (2) > `lecteur` (1). New users are created with `actif: false` and must be activated by an admin. Per-specimen-type access (`checkSpecimenAccess`) is additionally gated by a `specimensAutorises` array on the user, cached in-memory for 60s per process (`_specimenCache` — not shared across multiple backend instances/PM2 cluster workers; invalidated via `invalidateSpecimenCache`).

**API prefix**: All routes are under `/api/v1/`. Health check at `GET /api/health`.

## Audit (2026-08-12 — met à jour depuis 2026-07-21)

### Structure & stack
- Backend: Express 4 + Prisma 5 (PostgreSQL 16 + PostGIS 3.4) + Zod v4 validation + JWT auth. 25 controllers, 6 service modules (`src/services/` — partial migration off the older "logic in controller" pattern, see Fragile areas), 29 route files, ~160 REST endpoints under `/api/v1` (count inflated by the 6-referentiel factory `_simple.routes.js` × 7 verbs each).
- Frontend: React 19 + Vite 5 + React Router v7 + TanStack Query v5 + Zustand + Tailwind v3 + Leaflet (vanilla — `react-leaflet` is a dependency but 0 occurrences in the code) + Recharts. 44 pages, all route-level lazy-loaded (`React.lazy()`/`Suspense`).
- A full **Labo module** (`ManipulationLabo` + sub-tables for extraction, PCR, qPCR, nested-PCR, séquençage, microscopie, dessication, broyage pool, plus `Pool`/`PoolMembre`/`PathogeneCible`) exists in the schema and backend (`labo.controller.js`, `pools.routes.js`) with a matching `frontend/src/pages/labo/`.
- CI/CD **now exists**: `.github/workflows/ci.yml` runs lint+test+build (frontend) and test+`prisma migrate deploy`+seed+smoke (backend) on every push/PR. The "no CI" claim from 2026-07-21 is resolved.

### Tests
- Vitest is configured and passing on **both** sides (the "no test framework" claim from 2026-07-21 is resolved): 13 backend test files / 176 tests (`backend/tests/unit/`), 7 frontend test files / 49 tests. Coverage is limited to pure functions (Zod schemas, RBAC, utils) — **zero controller, service, or page component is tested**, so refactors there still have no regression safety net beyond the manual smoke test and lint.
- `backend/scripts/smoke-test.js` (291 lines, 28 cases) unchanged, now wired into CI (not just the `/test` slash command).

### Dependencies
- `prisma`/`@prisma/client` are **2 major versions behind** (5.22 installed vs 7.9 latest) — the most concerning gap; plan a dedicated upgrade session before it compounds further. `express`, `multer`, `helmet`, `bcryptjs` are each 1 major behind. `vite` is 3 majors behind and `tailwindcss` 1 major behind — likely deliberate given Tailwind v4's breaking rewrite, but worth confirming.
- `npm audit` (backend, prod deps): 8 vulnerabilities (1 low, 4 moderate, 3 high — `tmp<0.2.6` path traversal is the high one and has a non-breaking fix via `npm audit fix`). Frontend: 0.
- `zod` v4 — the known `.omit().partial()` + `.default()` interaction bug is unchanged; see project memory when touching update schemas.

### Fragile / incomplete areas
1. **IDOR — project scoping only applies at Projet/Missions level** (found 2026-08-12, highest priority). `missions.service.js` (`getById`/`update`/`remove`) and `projets.controller.js` (`getProjetStats`) skip the membership check that `list()` does; localités, méthodes, hôtes, containers, spécimens (4 types) and manipulations labo have **no** project-membership filtering anywhere — only specimen *type* is access-controlled (`checkSpecimenAccess`). A `chercheur` on a single project can read/export data belonging to every project in the institute.
2. **Bulk Excel import is unbatched**: `import.controller.js`'s main loop does up to 8 sequential Prisma calls per row with no transaction/`createMany` — 2000-6000+ DB round-trips for a realistic 500-1000-row import. The per-method import paths (`moustiques/tiques/puces.controller.js`) already use `createMany` but lack a taxonomy-resolution cache.
3. **`schemas/labo.schema.js` is dead at runtime**: complete, unit-tested Zod schema for the Labo module (PCR/séquençage/pathogènes data), never imported by `labo.routes.js`/`labo.controller.js` — no real validation applied. `pools.routes.js` also has no dedicated controller or schema, inconsistent with the routes→controller→service pattern used elsewhere.
4. **Partial services/asyncHandler migration** — `asyncHandler` is applied at the *route* level: 22/29 route files use it directly, the rest go through the `_simple.routes.js` factory (which already wraps it) or are single-route files (`rbac.routes.js`). Only 6/25 controllers have a dedicated service; the remaining ones (notably `moustiques/tiques/puces/autresSpecimens.controller.js`) still hold their business logic inline and are near-duplicates of each other. **The `session-refactor-backend` skill's own migration table is out of date** — it omits `moustiques.controller.js` and wrongly claims `tiques`/`puces` controllers have unmigrated try/catch (verified 2026-08-12: not true, both already rely on `asyncHandler`); don't trust that skill's checklist without re-verifying.
5. **In-memory specimen-access cache is per-process** (`_specimenCache` in `auth.middleware.js`) — unchanged: a specimen-access change won't propagate across instances for up to 60s if the backend is ever scaled horizontally. Same limitation applies to `sseManager.js`'s connection registry.
6. `presentation/*.pptx|docx` still pollutes the repo (362 files, 8.2MB, outside `.gitignore`) — unchanged since 2026-07-21, still worth deciding if it belongs here. (`backend/prisma.config.ts.bak` from the previous audit no longer exists — resolved.)
7. **Deployment docs have drifted from the real infra**: `configs.md` describes a different Dockerfile (no `entrypoint.sh`), a different frontend build strategy (in-Docker vs the actual pre-compiled `Dockerfile.dist`), and a different transfer method/SSH account than what's actually used — trust `.claude/commands/deploy-nas.md`/`transfer-nas.md` instead, they're verified against the live setup. `deploy-update.ps1`'s hardcoded Prisma migration blocks stop at 2026-06-16; 15 migrations created since then are missing from it — don't run it without adding those blocks first, or use the `deploy-nas` skill instead.
8. Missing DB indexes on `taxonomieId`/`dateCollecte` (the 3 specimen tables) and `Localite.missionId`/`MethodeCollecte.localiteId`/`typeMethodeId` — candidates for table scans as data volume grows; the spatial GIST index on `fokontany_geo.geom` is present and correct.
9. Strong, unfactored duplication across the 4 specimen controllers (moustiques/tiques/puces/autres) and their 12 matching frontend pages (~4000 lines) — no shared factory, unlike the referentiel pattern (`_referentielFactory.js` / `ReferentielSimplePage.jsx`).

### Frontend (`frontend/`)

- **Bundler**: Vite + React 19
- **Styling**: Tailwind CSS v3 with `@tailwindcss/forms`. Custom color tokens use `primary-*` class names.
- **State**: Zustand store in `src/store/authStore.js` — persists `token` and `user` to `localStorage`. On 401 responses, the Axios interceptor (`src/api/axios.js`) auto-redirects to `/login`.
- **Routing**: React Router v7 with a `ProtectedRoute` (redirects to `/login` if no token) and `PublicRoute` (redirects to `/dashboard` if already authenticated) wrapping all pages.
- **Layout**: `MainLayout` renders a fixed sidebar with nav links and a scrollable `<Outlet />` for page content.

**Key shared components**:
- `MapPicker` — Leaflet map for picking GPS coordinates on locality/method forms
- `BoiteTubes` — tube box UI for assigning `positionPlaque` (well-plate position)
- `PlaquePuits` — plate-well position selector
- `FormField` — labeled input wrapper

### Environment
Backend reads from `backend/.env`:
- `DATABASE_URL` — Prisma connection string (PostgreSQL on port 5435)
- `JWT_SECRET` — used to sign/verify tokens
- `CLIENT_URL` — CORS allowed origin (default: `http://localhost:5173`)
- `PORT` — server port (default: 3000)
