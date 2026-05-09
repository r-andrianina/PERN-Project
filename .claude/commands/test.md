# /test — Lancer le smoke test end-to-end

Exécute le script de test qui couvre le flux complet de l'API.

## Pré-requis

Le backend doit tourner sur le port 3000.

## Commande

```bash
! cd backend && node scripts/smoke-test.js
```

## Ce qui est testé (28 cas)

- Health check + authentification admin
- Référentiels dictionnaire (taxonomies, types méthode, solutions, env, habitat)
- Flux complet : Projet → Mission → Localité (code AKZ) → Méthode (FK type) → Hôte (FK taxonomie) → Moustique (FK taxonomie)
- Règle CDC : rejet 400 si moustique sans `taxonomieId`
- Hiérarchie taxonomique : rejet 400 si genre créé sans parent
- Cycle activation/désactivation d'un référentiel
- Journal d'audit (CREATE/DEACTIVATE/ACTIVATE tracées)
- Cleanup de toutes les entités créées

## Interprétation

- **✓ vert** = test passé
- **✗ rouge** = test échoué — lire le message d'erreur pour diagnostiquer
- **ℹ cyan** = information (ids, labels)

Le script fait son propre cleanup — la base reste propre après.
