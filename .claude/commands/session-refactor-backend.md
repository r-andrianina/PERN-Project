# /session-refactor-backend — Migrer les contrôleurs restants vers services + asyncHandler

## Contexte

`projets.controller.js` est le modèle : contrôleur = 5 lignes/action, toute la logique dans le service.

**Mise à jour 2026-08-12 — cette table était désuète, corrigée :**
- `missions`, `localites`, `methodes`, `hotes`, `containers` ont **déjà** leur service dédié
  (`backend/src/services/*.service.js`) — ne pas les remettre en chantier, ils sont migrés.
- L'affirmation "`tiques`/`puces` utilisent encore try/catch inline" était **fausse** : les deux
  s'appuient déjà sur `asyncHandler` au niveau des routes (`routes/specimens/tiques.routes.js`,
  `puces.routes.js`) ; le seul try/catch résiduel dans chacun est un one-liner de nettoyage de
  fichier temporaire après import, sans rapport avec la migration services/asyncHandler.
- `asyncHandler` lui-même est déjà appliqué à quasi toutes les routes (22/29 fichiers ; les 7
  restants passent par la fabrique `_simple.routes.js`, qui l'utilise déjà, ou sont une route
  unique) — ce n'est plus l'axe de migration pertinent, seule la couche **service** manque encore.

## Fichiers à migrer (par priorité)

Le vrai reste à faire : les 4 contrôleurs spécimens, qui contiennent encore toute leur logique
métier inline (CRUD, mode split de positionnement, génération d'idTerrain, import/export Excel)
et sont fortement dupliqués entre eux (voir audit dette technique 2026-08-12 — candidats à une
factorisation commune plutôt qu'à 4 services séparés quasi identiques, à évaluer avant de foncer).

| Contrôleur | Service à créer | Complexité |
|---|---|---|
| `moustiques.controller.js` | `moustiques.service.js` | Élevée (481 lignes — import/export Excel, mode split) |
| `tiques.controller.js` | `tiques.service.js` | Élevée (import/export Excel, mode split) |
| `puces.controller.js` | `puces.service.js` | Élevée (import/export Excel, mode split) |
| `autresSpecimens.controller.js` | `autresSpecimens.service.js` | Moyenne (pas d'import/export dédié) |

Hors périmètre de cette migration mais à traiter séparément (gap différent — validation
manquante, pas juste logique non extraite) : `labo.controller.js` (`schemas/labo.schema.js`
existe mais n'est jamais câblé sur les routes) et `pools.routes.js` (pas de contrôleur dédié du
tout, logique CRUD inline dans le fichier de routes, pas de schéma Zod).

## Schémas Zod

Déjà en place pour les 4 spécimens (`backend/src/schemas/specimens.schema.js`,
`autresSpecimens.schema.js`) — pas de nouveau schéma à créer pour cette migration, seulement le
brancher via `validate()` dans les services extraits si ce n'est pas déjà fait au niveau route.

## Pattern à suivre

### Service (modèle : `backend/src/services/projets.service.js`)
- Importe `prisma` + `AppError`
- Fonctions pures : `list/getById/create/update/remove`
- Lance `AppError.notFound()`, `AppError.conflict()` etc.
- Prisma P2025/P2002 capté automatiquement par errorHandler

### Contrôleur (modèle : `backend/src/controllers/projets.controller.js`)
- 3–5 lignes par action
- `const service = require('../services/xxx.service')`
- Pas de try/catch → asyncHandler s'en charge

### Route (modèle : `backend/src/routes/projets.routes.js`)
```js
const asyncHandler = require('../middlewares/asyncHandler');
const { validate }  = require('../middlewares/validate');
const schema        = require('../schemas/xxx.schema');

router.post('/', requireMinRole('terrain'), validate(schema.createXxx), asyncHandler(ctrl.create));
```

## Commande de vérification

```bash
! cd backend && timeout 5 node -e "require('./src/app.js'); console.log('OK')"
! cd backend && node scripts/smoke-test.js
```
