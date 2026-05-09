# /session-detail-specimens — Pages de détail des spécimens

Briefing pour créer les pages `/specimens/moustiques/:id`, `/tiques/:id`, `/puces/:id`.

## Contexte

Les routes existent dans le router (`navigate(\`/specimens/moustiques/${m.id}\`)`) mais les pages de destination n'existent pas encore — un clic redirige nulle part.

## À créer

### 3 pages de détail (modèle commun)
```
frontend/src/pages/specimens/MoustiqueDetail.jsx
frontend/src/pages/specimens/TiqueDetail.jsx
frontend/src/pages/specimens/PuceDetail.jsx
```

### Structure de chaque page

```jsx
// Données : GET /api/v1/moustiques/:id
// Include : methode.localite.mission, taxonomie.parent, solution, container
const { data, loading } = useApiQuery(`/moustiques/${id}`);

// Sections :
// 1. Header : ID terrain (badge primary) + #id + taxonomie italique + type badge
// 2. Carte Identification : taxonomie hiérarchique, sexe, stade, parité, repas sang
// 3. Carte Localisation : mission → localité → méthode → GPS
// 4. Carte Conservation : solution, container (code + position), date collecte
// 5. Notes (si présentes)
// 6. Actions : Modifier (modal inline) + Supprimer (admin)
```

### Ajout dans le router (`frontend/src/router/index.jsx`)
```jsx
{ path: 'specimens/moustiques/:id', element: <MoustiqueDetail /> },
{ path: 'specimens/tiques/:id',     element: <TiqueDetail /> },
{ path: 'specimens/puces/:id',      element: <PuceDetail /> },
```

## Endpoints API utilisés

- `GET /api/v1/moustiques/:id` — déjà implémenté, inclut taxonomie, solution, container
- `PUT /api/v1/moustiques/:id` — pour l'édition inline
- `DELETE /api/v1/moustiques/:id` — suppression (admin)

## Composants UI disponibles

`Card`, `Badge`, `Button`, `PageHeader`, `Spinner`, `EmptyState` — tous dans `../../components/ui`

## Palette de couleurs

- Moustique : `text-specimen-moustique bg-specimen-moustique/10`
- Tique : `text-specimen-tique bg-specimen-tique/10`
- Puce : `text-specimen-puce bg-specimen-puce/10`
