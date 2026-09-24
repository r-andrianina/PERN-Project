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
- ~~`prisma`/`@prisma/client` are **2 major versions behind**~~ — **résolu le 2026-09-21** : montée en **7.10**, déployée en production le même jour. La v7 impose trois changements : `url` n'est plus accepté dans le bloc `datasource` (il passe par `backend/prisma.config.js`), le client reçoit sa connexion via un adaptateur de pilote (`@prisma/adapter-pg`, cf. `src/config/prisma.js`), et le CLI ne charge plus `.env` tout seul. `express`, `multer`, `helmet`, `bcryptjs` sont chacun 1 majeure en retard. `vite` est 3 majeures en retard et `tailwindcss` 1 — probablement délibéré vu la réécriture cassante de Tailwind v4, mais à confirmer.
- `npm audit` (backend) : 8 vulnérabilités au 2026-09-21, **aucune atteignable**. Les 4 « hautes » viennent toutes du CLI Prisma (`mysql2` — jamais chargé avec une source PostgreSQL ; `deepmerge-ts`/`@prisma/config` — ne s'exécute qu'au chargement de notre propre fichier de config) ; `uuid` via `exceljs` exige un `buf` fourni par l'appelant, ce qu'ExcelJS ne fait pas. La seule qui était réellement sur le chemin des requêtes — `qs`, via `express.urlencoded` — a été corrigée le 2026-09-21 par un `overrides: { qs: ^6.16.0 }` dans `package.json`, `body-parser@1.20.6` épinglant `~6.15.1` et interdisant donc la version corrigée. Frontend : 0.
- ⚠️ `npm audit fix --omit=dev` est un piège ici : le drapeau ne filtre pas l'audit, il RECONSTRUIT l'arbre sans les dépendances de dev — il propose donc de désinstaller `vitest` et `vite`. Auditer avec `npm audit`, corriger par un bump explicite ou un `overrides`.
- `zod` v4 — the known `.omit().partial()` + `.default()` interaction bug is unchanged; see project memory when touching update schemas.

### Fragile / incomplete areas

> ⚠️ **À lire avant d'ouvrir un chantier sur cette liste.** Quatre de ces entrées
> (1, 3, 8, et la seconde moitié de 4) décrivaient un état du code corrigé depuis
> des semaines : elles avaient été rédigées comme constats d'audit et jamais
> barrées ensuite. **Vérifier l'affirmation dans le code avant de planifier quoi
> que ce soit dessus**, et barrer l'entrée le jour où elle est traitée — une
> ligne périmée ici coûte une session entière.

1. ~~**IDOR — project scoping only applies at Projet/Missions level**~~ — **résolu le 2026-08-12 même**, mais l'entrée n'avait jamais été barrée : elle est restée listée « highest priority » six semaines, et a failli déclencher un chantier entier le 2026-09-24. Le cloisonnement passe par `src/utils/access.js` (`getAccessibleProjetIds` / `projetScopeWhere` / `assertProjetAccessible`, testés) et il est appliqué dans `missions.service.js` (getById/update/remove), `projets.service.js` (`getStats`), `localites/methodes/hotes/containers.service.js`, `specimenFactory.js` (les 4 types, liste + écriture) et `labo.controller.js`. **Complété le 2026-09-24** : `pools.service.js` était le dernier angle mort (`GET /pools`, `GET /pools/:id`, `POST /pools` sans aucun contrôle, alors que `labo.controller.js` refusait les mêmes pools) ; la règle fail-closed vit désormais dans `src/utils/poolAccess.js`, partagée par les deux. **C'est le troisième constat de section périmée** — voir la leçon au point 3.
2. ~~**Bulk Excel import is unbatched**~~ — **résolu le 2026-09-09**. `import.controller.js` s'exécute désormais dans **une transaction unique** (`prisma.$transaction`, délais réglables via `IMPORT_TX_TIMEOUT_MS`/`IMPORT_TX_MAXWAIT_MS`) et insère par lots de 500 via `createMany` ; le rapport d'erreur ligne par ligne est conservé (la validation reste par ligne, seule l'ÉCRITURE est groupée). Gardes d'entrée mutualisées dans `src/utils/excelGuards.js` (signature ZIP, plafond de décompression, plafond de lignes, parsing encapsulé en 400), appliquées aussi aux imports par méthode (`moustiques/tiques/puces.controller.js`). Limites connues restantes : une transaction longue retient une connexion du pool Prisma (import ≫ 20 000 lignes à découper en plusieurs fichiers) ; un import concurrent écrivant les mêmes `idTerrain` provoque un rollback complet avec un 409 explicite plutôt qu'une perte silencieuse.
3. ~~**`schemas/labo.schema.js` is dead at runtime**~~ — **faux depuis au moins le 2026-09-21** (l'affirmation datait du 2026-08-12 et n'avait pas été revérifiée). `labo.routes.js` importe bien le schéma et applique `validate()` sur `createManipulation`, `updateManipulation` et `validerManipulation`. `pools.routes.js` a lui aussi son contrôleur (`pools.controller.js`) ET son schéma (`pools.schema.js`), conformément au motif routes→contrôleur→service. **Leçon de méthode : vérifier une affirmation de cette section contre le code avant de planifier du travail dessus** — c'est le deuxième constat de ce type, après la table de migration périmée du point 4.
4. **Partial services/asyncHandler migration** — `asyncHandler` is applied at the *route* level: 22/29 route files use it directly, the rest go through the `_simple.routes.js` factory (which already wraps it) or are single-route files (`rbac.routes.js`). 8/25 controllers have a dedicated service (`containers`, `hotes`, `localites`, `methodes`, `missions`, `pools`, `projets`, plus `specimenFactory`). La suite de cette phrase — « les 4 contrôleurs spécimens gardent leur logique en ligne et sont des quasi-doublons » — **est fausse depuis le 2026-08-18** : ils passent tous par `specimenFactory` + `specimenControllerFactory` (cf. point 9). **The `session-refactor-backend` skill's own migration table is out of date** — it omits `moustiques.controller.js` and wrongly claims `tiques`/`puces` controllers have unmigrated try/catch (verified 2026-08-12: not true, both already rely on `asyncHandler`); don't trust that skill's checklist without re-verifying.
5. **In-memory specimen-access cache is per-process** (`_specimenCache` in `auth.middleware.js`) — unchanged: a specimen-access change won't propagate across instances for up to 60s if the backend is ever scaled horizontally. Same limitation applies to `sseManager.js`'s connection registry.
6. `presentation/*.pptx|docx` still pollutes the repo (362 files, 8.2MB, outside `.gitignore`) — unchanged since 2026-07-21, still worth deciding if it belongs here. (`backend/prisma.config.ts.bak` from the previous audit no longer exists — resolved.)
7. **Deployment docs — largely realigned on 2026-09-15**, two items remain. `.claude/commands/deploy-nas.md`/`transfer-nas.md` are the verified procedures and now carry the migration-exclusion guards (`init` and the deferred taxonomy migration, plus a *check the NAS before rebuilding* step — `tar` adds without erasing, and `entrypoint.sh` applies migrations on every container start). `configs.md` had its §3.1/§3.2 rewritten to match the real `backend/Dockerfile` (byte-identical now) and `frontend/Dockerfile.dist`, and its §6.2/§9.2 no longer duplicate the transfer/update commands — they point to the command files instead, since duplication is precisely what let them drift (the old `rsync` excluded `frontend/dist/`, which `Dockerfile.dist` needs, and used the wrong SSH account). **Still open**: `configs.md` §3.4 still differs from the real `docker-compose.prod.yml` (it carries a note listing the gaps), and chapters 1/5/8 (hardware, DSM, HTTPS) have never been re-verified against the live setup. (`deploy-update.ps1` **was deleted on 2026-09-15**: it recreated the deferred `20260806101736_taxonomie_specimens_unique_indexes` on the NAS — the migration behind the 2-hour outage of 2026-08-26 — transferred only 17 of 102 backend source files, and was missing 5 migrations. Its design, one hardcoded block per migration and one line per file, guaranteed it would go stale again. Recoverable from git history if ever needed.)
8. ~~Missing DB indexes on `taxonomieId`/`dateCollecte` …~~ — **résolu le 2026-08-12** par la migration `20260812141128_add_missing_query_indexes` (13 index : `taxonomie_id`/`date_collecte` sur les 3 tables de spécimens, `hote_id` sur tiques/puces, `localites.mission_id`, `methodes_collecte.localite_id`/`type_methode_id`, `hotes.methode_id`/`taxonomie_hote_id`). Entrée jamais barrée, comme le point 1. L'index GIST sur `fokontany_geo.geom` était déjà correct.
9. Duplication des 4 contrôleurs spécimens — **backend fait le 2026-08-18** (`services/specimenFactory.js` + `controllers/specimenControllerFactory.js` ; les 4 contrôleurs sont désormais de la configuration). **Reste ouvert : les 12 pages frontend** (~4 000 lignes), sans équivalent du motif `ReferentielSimplePage.jsx` — phase explicitement différée.

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
