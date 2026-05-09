# /session-refactor-backend — Migrer les contrôleurs restants vers services + asyncHandler

## Contexte

`projets.controller.js` est le modèle : contrôleur = 5 lignes/action, toute la logique dans le service.
Les contrôleurs suivants utilisent encore l'ancien pattern (try/catch inline, logique dans le contrôleur) :

## Fichiers à migrer (par priorité)

| Contrôleur | Service à créer | Complexité |
|---|---|---|
| `missions.controller.js` | `missions.service.js` | Moyenne (agentIds, MissionAgent) |
| `localites.controller.js` | `localites.service.js` | Faible (+ lookup fokontany) |
| `methodes.controller.js` | `methodes.service.js` | Faible |
| `hotes.controller.js` | `hotes.service.js` | Faible |
| `containers.controller.js` | `containers.service.js` | Faible |
| `tiques.controller.js` | — | Moyen (conserver logique container) |
| `puces.controller.js` | — | Moyen |

## Schémas Zod à créer

```
backend/src/schemas/missions.schema.js
backend/src/schemas/localites.schema.js
backend/src/schemas/methodes.schema.js
backend/src/schemas/hotes.schema.js
```

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
