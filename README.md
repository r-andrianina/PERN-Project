# SpécimenManager — Institut Pasteur Madagascar

> Application web de gestion des spécimens entomologiques de terrain (moustiques, tiques, puces) pour l'Unité Entomologie Médicale (UEM).

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-4.4-3068B7)

---

## À propos

SpécimenManager couvre le flux complet de collecte entomologique de l'Institut Pasteur Madagascar :

```
Projet → Mission → Localité → Méthode de collecte → Spécimen (Moustique | Tique | Puce)
```

**Fonctionnalités clés**

- Saisie et gestion CRUD de 3 types de spécimens avec taxonomie hiérarchique (5 000+ espèces)
- Import Excel (format IPM) et export Excel formaté
- Carte interactive Leaflet des sites de collecte avec filtrage RBAC
- Dashboard analytique avec graphiques (collectes par mois, répartition par espèce)
- RBAC à 2 niveaux : rôle global + permissions par type de spécimen
- Recherche globale multi-entités (Ctrl+K)
- Journal d'audit complet (création / modification / suppression)
- Interface bilingue FR / EN

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Base de données | PostgreSQL 16 + PostGIS (port **5435**) |
| ORM | Prisma 5.22 |
| API | Express 4.19 + Node.js 22 |
| Validation | Zod 4.4 |
| Authentification | JWT (jsonwebtoken 9) + bcryptjs |
| Frontend | React 19 + Vite 5 |
| Routing | React Router 7 |
| Style | Tailwind CSS 3.4 + dark mode |
| État global | Zustand 5 |
| Cartographie | Leaflet 1.9 + React-Leaflet 5 |
| Graphiques | Recharts 3 |
| HTTP client | Axios 1.16 |

---

## Prérequis

- **Node.js ≥ 20** (`node --version`)
- **Docker Desktop** (pour PostgreSQL)
- **Git**

---

## Installation rapide

```bash
# 1. Cloner le dépôt
git clone <url-du-repo> && cd SpecimenManager

# 2. Démarrer PostgreSQL (port 5435)
docker-compose up -d

# 3. Installer les dépendances et appliquer le schéma
cd backend && npm install && npx prisma migrate deploy && npx prisma generate

# 4. Peupler les référentiels + créer le compte admin
npm run seed

# 5. Installer le frontend
cd ../frontend && npm install
```

L'application est prête. Voir [Commandes disponibles](#commandes-disponibles) pour démarrer les serveurs.

---

## Configuration

### Backend — `backend/.env`

```env
PORT=3000
DATABASE_URL="postgresql://postgres:<mdp>@127.0.0.1:5435/specimenmanager?schema=public"
JWT_SECRET=<secret-fort-en-production>
CLIENT_URL=http://localhost:5173
```

> Utiliser `127.0.0.1` et non `localhost` dans `DATABASE_URL` : sous Windows,
> `localhost` est résolu en `::1` en premier, et le proxy IPv6 de Docker Desktop
> accepte le handshake TCP sans relayer la connexion. Prisma échoue alors avec
> `P1001 — Can't reach database server`, alors que le conteneur tourne normalement.

### Frontend — `frontend/.env`

```env
VITE_API_URL=http://localhost:3000/api/v1
```

> En production, remplacer `VITE_API_URL` par l'URL publique de l'API.

---

## Commandes disponibles

### Base de données (Docker)

```bash
docker-compose up -d        # Démarrer PostgreSQL sur le port 5435
docker-compose down         # Arrêter
```

### Backend

```bash
cd backend
npm run dev                 # Serveur de développement (nodemon, port 3000)
npm start                   # Démarrage production
npm run seed                # Peupler les référentiels + compte admin

npx prisma migrate dev      # Créer une migration après modification du schéma
npx prisma migrate deploy   # Appliquer les migrations (production)
npx prisma db push          # Synchroniser sans migration (développement rapide)
npx prisma generate         # Régénérer le client Prisma
npx prisma studio           # Interface visuelle DB → http://localhost:5555

node scripts/smoke-test.js          # Smoke test end-to-end (28 cas)
node scripts/import-taxo.js         # Import dictionnaire taxonomique depuis Excel
node scripts/import-fokontany.js    # Import shapefile fokontany dans PostGIS
```

### Frontend

```bash
cd frontend
npm run dev     # Serveur de développement → http://localhost:5173
npm run build   # Build production vers dist/
npm run preview # Prévisualiser le build production
npm run lint    # ESLint
```

---

## Compte par défaut

| Champ | Valeur |
|-------|--------|
| Email | `andrianinar@pasteur.mg` |
| Mot de passe | `Admin1234!` |
| Rôle | `admin` |

> ⚠️ Changer le mot de passe et le `JWT_SECRET` avant tout déploiement.

---

## Architecture du projet

```
SpecimenManager/
├── docker-compose.yml              # PostgreSQL 16 + PostGIS (port 5435)
├── fokontany/                      # Shapefile Fokontany (17 416 polygones)
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # Modèle de données (source de vérité)
│   │   ├── migrations/             # Migrations versionnées
│   │   └── seed.js                 # Données initiales (référentiels + admin)
│   ├── scripts/
│   │   ├── smoke-test.js           # Test end-to-end API (28 cas)
│   │   ├── import-taxo.js          # Import dictionnaire taxonomique Excel
│   │   └── import-fokontany.js     # Import shapefile → PostGIS
│   └── src/
│       ├── app.js                  # Configuration Express + routes
│       ├── config/prisma.js        # Singleton Prisma client
│       ├── controllers/            # HTTP : lit req, délègue au service, sérialise res
│       ├── services/               # Logique métier pure (AppError, pas de res/req)
│       ├── routes/
│       │   ├── specimens/          # moustiques | tiques | puces
│       │   └── dictionnaire/       # taxonomies, types, solutions…
│       ├── middlewares/
│       │   ├── auth.middleware.js  # verifyToken, requireRole, checkSpecimenAccess
│       │   ├── rateLimiter.js      # Protection brute-force (login : 5/15min)
│       │   ├── validate.js         # Middleware Zod
│       │   └── asyncHandler.js     # Propagation d'erreurs sans try/catch
│       ├── schemas/                # Schémas Zod par domaine
│       └── utils/
│           ├── AppError.js         # Erreur métier typée (statusCode + details)
│           ├── audit.js            # Historisation générique (audit_logs)
│           ├── idTerrain.js        # Génération ID terrain <CODE>_n
│           └── container.js        # Gestion positions boîtes/plaques
│
└── frontend/
    └── src/
        ├── api/axios.js            # Instance Axios + intercepteurs JWT/erreurs
        ├── store/
        │   ├── authStore.js        # Zustand : token + user (persisté localStorage)
        │   └── languageStore.js    # Zustand : langue FR/EN (persisté localStorage)
        ├── lib/
        │   ├── toast.js            # Émetteur pub/sub global (hors React)
        │   └── i18n.js             # Dictionnaire FR/EN + hook useT()
        ├── hooks/
        │   ├── useApiQuery.js      # Fetch + loading + error + refetch
        │   ├── useApiQueries.js    # Fetch parallèle multiple
        │   └── useFormSubmit.js    # Formulaire : validate + submit + reset
        ├── components/
        │   ├── ui/                 # Card, Badge, Button, Pagination, Toast…
        │   ├── layout/
        │   │   ├── MainLayout.jsx  # Sidebar + Topbar + Footer
        │   │   └── Footer.jsx      # Copyright + toggle langue
        │   ├── GlobalSearch.jsx    # Recherche globale Ctrl+K
        │   ├── MapPicker.jsx       # Carte Leaflet pour GPS (formulaires)
        │   ├── ContainerSelector.jsx # Sélection boîte/plaque + positions
        │   └── SpecimenIcon.jsx    # PNG moustique | tique | puce
        └── pages/
            ├── dashboard/          # Statistiques + graphiques Recharts
            ├── carte/              # Carte interactive des collectes
            ├── projets/            # CRUD projets
            ├── missions/           # CRUD missions + localités
            ├── methodes/           # CRUD méthodes de collecte
            ├── specimens/          # Listes + détails + formulaires
            ├── dictionnaire/       # Référentiels + audit logs
            ├── utilisateurs/       # Gestion utilisateurs + RBAC
            ├── recherche/          # Recherche transversale multi-spécimens
            └── import/             # Import Excel par méthode de collecte
```

---

## Hiérarchie des données

```
Projet
  └── Mission
        └── Localité  (code 3 lettres = préfixe ID terrain)
              └── Méthode de collecte  (GPS, type, habitat, environnement)
                    ├── Moustique  (taxonomie FK, sexe, stade, parité, repas sang)
                    ├── Tique      (taxonomie FK, hôte FK, gorgée, partie corps)
                    └── Puce       (taxonomie FK, hôte FK)
```

Les spécimens ne sont jamais liés directement à une localité ou mission — toujours via une méthode de collecte.

---

## RBAC — Contrôle d'accès

### Rôles (hiérarchie)

| Rôle | Niveau | Accès |
|------|--------|-------|
| `admin` | 4 | Tout — gestion utilisateurs, référentiels, données |
| `chercheur` | 3 | Création et modification de toutes les données scientifiques |
| `technicien` | 2 | Saisie de spécimens et méthodes de collecte |
| `lecteur` | 1 | Consultation uniquement |

### Permissions par type de spécimen

En plus du rôle, chaque utilisateur possède un tableau `specimensAutorises` (`moustique | tique | puce`) qui filtre :
- L'affichage dans la sidebar et le dashboard
- Les endpoints API (`checkSpecimenAccess` middleware)
- Les résultats de la recherche transversale et de la carte

Les permissions sont embarquées dans le JWT à la connexion. Un changement prend effet à la prochaine reconnexion.

---

## API — Endpoints principaux

| Méthode | Route | Description | Rôle min. |
|---------|-------|-------------|-----------|
| POST | `/api/v1/auth/login` | Connexion (rate-limit 5/15min) | public |
| POST | `/api/v1/auth/register` | Inscription (compte inactif) | public |
| GET | `/api/v1/auth/users` | Liste des utilisateurs | admin |
| PATCH | `/api/v1/auth/users/:id/specimens` | Permissions spécimens | admin |
| GET | `/api/v1/projets` | Liste des projets | lecteur |
| GET | `/api/v1/missions` | Liste des missions | lecteur |
| GET | `/api/v1/moustiques` | Liste paginée (`?page&limit&search`) | + checkSpecimenAccess |
| GET | `/api/v1/moustiques/export` | Export Excel | + checkSpecimenAccess |
| POST | `/api/v1/moustiques/import` | Import Excel (multipart) | technicien |
| GET | `/api/v1/recherche/specimens` | Recherche multi-spécimens filtrée | lecteur |
| GET | `/api/v1/carte/specimens` | Sites géolocalisés (RBAC) | lecteur |
| GET | `/api/v1/dashboard/stats` | Agrégats pour graphiques | lecteur |
| GET | `/api/v1/localites/lookup-fokontany` | Point → fokontany (PostGIS) | lecteur |
| GET | `/api/v1/dictionnaire/audit-logs` | Journal d'audit | admin |

> Tous les endpoints protégés requièrent `Authorization: Bearer <token>`.
> Le schéma complet est dans `backend/src/routes/`.

---

## Module Dictionnaire

Les données scientifiques suivent des référentiels stricts (CDC §2) — aucune saisie de texte libre pour les noms d'espèces ou les types de méthodes.

| Référentiel | Route | Description |
|-------------|-------|-------------|
| Taxonomie spécimens | `/dictionnaire/taxonomie-specimens` | Hiérarchie ordre→famille→genre→espèce (5 000+ entrées) |
| Taxonomie hôtes | `/dictionnaire/taxonomie-hotes` | Hiérarchie des hôtes animaux |
| Types de méthode | `/dictionnaire/types-methode` | CDC-LT, BG-Sentinel, HLC… |
| Solutions de conservation | `/dictionnaire/solutions-conservation` | Éthanol 70%, RNAlater… |
| Types d'environnement | `/dictionnaire/types-environnement` | Urbain, rural, forêt… |
| Types d'habitat | `/dictionnaire/types-habitat` | Intra-domiciliaire, rizière… |
| Journal d'audit | `/dictionnaire/audit-logs` | Historisation CREATE/UPDATE/DELETE |

---

## Données géospatiales Fokontany

```bash
# Prérequis : PostGIS activé dans PostgreSQL
# Fichier requis : fokontany/Fokontany.shp (non versionné, à obtenir auprès de l'UEM)

node backend/scripts/import-fokontany.js
```

Crée la table `fokontany_geo` avec 17 416 polygones. Utilisée par l'endpoint `GET /api/v1/localites/lookup-fokontany?lat=X&lng=Y` pour pré-remplir automatiquement région / district / commune / fokontany lors de la création de localité.

---

## Conventions de code

### Backend

- **Controllers** : cible = 3-5 lignes par action (lit `req`, délègue au **service**, sérialise `res`) — migration en cours, seuls 6/25 contrôleurs ont aujourd'hui un service dédié (`containers`, `hotes`, `localites`, `methodes`, `missions`, `projets`) ; les autres ont encore leur logique métier inline
- **Services** : logique métier pure — lancent `AppError`, jamais de `res`/`req`
- **asyncHandler** : appliqué au niveau des routes (`router.get('/', asyncHandler(ctrl.list))`) — plus de `try/catch` répété ; 22/29 fichiers de routes l'utilisent
- **Zod** : validation via middleware `validate(schema.xxx)` avant chaque controller
- **AppError** : `AppError.notFound()`, `.conflict()`, `.badRequest()` — capturé par `errorHandler`

### Frontend

- **`useApiQuery(url, opts)`** : fetch avec loading/error/refetch
- **`useFormSubmit({ initial, validate, onSubmit, onSuccess })`** : gestion complète de formulaire
- **`toast.success/error/warning/info(message)`** : notifications (importable partout)
- **`useT()`** : traduction `t('nav.dashboard')` → FR ou EN selon le store
- **Design tokens** : classes Tailwind sémantiques — `text-primary`, `bg-surface-2`, `text-fg-subtle`
- **Dark mode** : classe `.dark` sur `<html>` — géré par `ThemeToggle`

---

## Déploiement

### Variables d'environnement requises

**Backend**
```env
DATABASE_URL=postgresql://user:password@host:5435/specimenmanager
JWT_SECRET=<minimum 32 caractères aléatoires>
CLIENT_URL=https://app.mon-domaine.mg
PORT=3000
```

**Frontend**
```env
VITE_API_URL=https://api.mon-domaine.mg/api/v1
```

### Build frontend

```bash
cd frontend && npm run build
# Servir le dossier dist/ avec Nginx ou un CDN
```

### Migrations en production

```bash
cd backend && npx prisma migrate deploy
```

> Ne jamais utiliser `prisma db push` en production — utiliser uniquement `migrate deploy`.

---

## Contribution

1. Créer une branche depuis `master` : `git checkout -b feat/nom-feature`
2. Suivre les conventions de commit : `feat:`, `fix:`, `ui:`, `refactor:`, `chore:`
3. Tester avec le smoke test avant PR : `node backend/scripts/smoke-test.js`
4. Build frontend sans erreur : `cd frontend && npm run build`

---

## Équipe

**Développement** — Henintsoa Andrianina  
**Institution** — Institut Pasteur de Madagascar, Unité Entomologie Médicale (UEM)

---

*SpécimenManager v2.0.0 — © 2026 Henintsoa Andrianina — Tous droits réservés*
