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

## Audit (2026-07-21)

### Structure & stack
- Backend: Express 4 + Prisma 5 (PostgreSQL/PostGIS) + Zod v4 validation + JWT auth. 25 controllers, 6 service modules (`src/services/` — only a partial migration off the older "logic in controller" pattern, see Fragile areas), 28 route files, 35 Prisma models across ~11 migrations.
- Frontend: React 19 + Vite 5 + React Router v7 + TanStack Query v5 + Zustand + Tailwind v3 + Leaflet/react-leaflet + Recharts. 45 pages.
- A full **Labo module** (`ManipulationLabo` + sub-tables for extraction, PCR, qPCR, nested-PCR, séquençage, microscopie, dessication, broyage pool, plus `Pool`/`PoolMembre`/`PathogeneCible`) exists in the schema and backend (`labo.controller.js`, `pools.routes.js`) with a matching `frontend/src/pages/labo/` — this is a substantial, relatively new subsystem not previously described here.
- No CI/CD configured (`.github/` is empty) — tests and lint are not automated on push/PR.

### Tests
- **No unit/integration test framework** on either side: `backend/package.json` test script is a stub (`echo "Tests à venir"`); no Jest/Vitest config or `*.test.js`/`*.spec.js` files exist anywhere in the repo.
- There **is** a manual smoke test: `backend/scripts/smoke-test.js` (291 lines, 28 cases) exercises the full API flow (auth, referentials, Projet→Mission→Localité→Méthode→Hôte→Moustique, CDC validation rules, audit log) against a running server, self-cleaning. Invoked via `/test` slash command. This is the only automated-ish safety net and it's not wired into CI.
- Frontend has no test setup at all (no React Testing Library, no component tests) — only `eslint` via `npm run lint`.

### Dependencies
- Reasonably current (React 19, Prisma 5, Zod 4, Express 4). No obvious abandoned/deprecated packages.
- `zod` v4 — note the known `.omit().partial()` + `.default()` interaction bug (re-injects defaults on update schemas); see project memory when touching update schemas.

### Fragile / incomplete areas
1. **Zero automated tests** — refactors (like the in-progress services/asyncHandler migration below) have no regression safety net beyond manual smoke testing and lint.
2. **Partial services/asyncHandler migration** — only 6 of 25 controllers have a matching `src/services/*.js`, and only 11 of 25 controllers use `asyncHandler` (others presumably still use manual try/catch). Mixed error-handling patterns across controllers until this migration (tracked by the `session-refactor-backend` skill) completes.
3. **In-memory specimen-access cache is per-process** (`_specimenCache` in `auth.middleware.js`) — if the backend ever runs as more than one process/instance, a specimen-access change by an admin won't propagate to other workers for up to 60s.
4. **Stray/uncommitted files in the working tree**: `backend/prisma.config.ts.bak` (backup file, not gitignored), several new `presentation/*.pptx|docx` files (~8MB) and a duplicate deleted pptx — repo is accumulating binary presentation assets outside `.gitignore` scope; worth deciding whether `presentation/` belongs in this repo at all.
5. **~~`docker-compose.yml` had a hardcoded local Postgres password committed in plain text~~ — RESOLVED**: the dev password now comes from `${POSTGRES_PASSWORD}` in the gitignored root `.env` (see `.env.example`), no literal in the committed compose file. Note the dev password is distinct from the prod `DB_PASSWORD` (docker-compose.prod.yml).
6. **This CLAUDE.md was stale** — role hierarchy (missing `superviseur`/`technicien`, wrong count) and the entire Labo/Pool subsystem were undocumented before this audit; re-check this file periodically against `schema.prisma` and `auth.middleware.js` as the source of truth.
7. **No CI** — lint, smoke test, and `prisma migrate` drift checks are all manual today.

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
