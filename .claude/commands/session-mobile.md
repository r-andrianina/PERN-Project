# /session-mobile — Phase 4 : Audit et corrections mobile

Briefing complet pour la session d'optimisation responsive.

## Objectif

Rendre l'application pleinement utilisable sur smartphone (agents de terrain saisissant des données sur le terrain).

## Problèmes connus à corriger

### 1. Tables horizontales sans défilement
Toutes les tables `<table>` doivent être dans un `<div className="overflow-x-auto">`.
Pages concernées : `TiquesPage`, `PucesPage` (vérifier `MoustiquesPage` aussi).

### 2. Modaux trop hauts
Les modaux (`fixed inset-0 ... flex items-center`) doivent avoir :
```jsx
className="max-h-[90vh] overflow-y-auto"
```
Pages concernées : `LocaliteModal` (MissionDetail), `UserModal/ResetPasswordModal` (UtilisateursPage), `CreateContainerModal`, modaux du Dictionnaire.

### 3. Boutons trop petits pour les doigts
Tous les boutons d'action inline (Edit2, Trash2, ToggleRight) doivent avoir `min-h-[44px] min-w-[44px]` ou être regroupés.

### 4. Sidebar mobile
La sidebar est déjà responsive (`-translate-x-full lg:translate-x-0`). Vérifier que le backdrop couvre bien et que le scroll interne fonctionne.

### 5. Formulaires sur mobile
- `NouvelleMethode` : la carte doit passer en dessous des champs sur mobile (grid-cols-2 → grid-cols-1)
- `MissionDetail LocaliteModal` : déjà en 2-col lg → OK

## Fichiers à modifier

```
frontend/src/pages/specimens/TiquesPage.jsx
frontend/src/pages/specimens/PucesPage.jsx
frontend/src/pages/missions/MissionDetail.jsx    (LocaliteModal)
frontend/src/pages/utilisateurs/UtilisateursPage.jsx  (modaux)
frontend/src/components/ContainerSelector.jsx    (CreateContainerModal)
frontend/src/pages/dictionnaire/TaxonomieSpecimensPage.jsx  (modal)
frontend/src/pages/methodes/NouvelleMethode.jsx
```

## Commande de vérification après

```bash
! cd frontend && npx vite build
```

Tester ensuite dans les DevTools Chrome (F12 → device toolbar → iPhone 12 Pro = 390px).
