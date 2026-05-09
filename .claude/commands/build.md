# /build — Compiler le frontend pour la production

## Commande

```bash
! cd frontend && npx vite build
```

## Résultats attendus

```
✓ 1843+ modules transformed.
dist/assets/index-*.css   ~51 kB  │ gzip: ~13 kB
dist/assets/index-*.js   ~630 kB  │ gzip: ~177 kB
✓ built in ~3s
```

Le warning "chunk > 500 kB" est cosmétique — il vient de Leaflet + ExcelJS. À corriger via code-splitting si la performance mobile devient un problème.

## Vérification rapide après build

```bash
! cd frontend && npx vite preview
```
→ Ouvre http://localhost:4173

## En cas d'erreur

Si le build échoue :
- `error: ...` → lire le message complet, souvent un import manquant ou une classe Tailwind non safelistée
- Pour les classes dynamiques Tailwind non reconnues, vérifier la `safelist` dans `tailwind.config.js`
