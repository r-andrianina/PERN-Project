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

**Role hierarchy** (highest to lowest): `admin` (4) > `chercheur` (3) > `terrain` (2) > `lecteur` (1). New users are created with `actif: false` and must be activated by an admin.

**API prefix**: All routes are under `/api/v1/`. Health check at `GET /api/health`.

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
