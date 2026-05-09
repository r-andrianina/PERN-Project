# /migrate — Appliquer les changements de schéma Prisma

Pousse le schéma vers la base et régénère le client Prisma.

## Pré-requis

Le container Docker doit tourner sur le port 5435 :
```bash
! docker-compose up -d
```

## Commandes

**Si le backend est arrêté :**
```bash
! cd backend && npx prisma db push --accept-data-loss && npx prisma generate
```

**Si le backend tourne (DLL verrouillée sur Windows) :**
```bash
! cd backend/node_modules/.prisma/client && mv query_engine-windows.dll.node query_engine-windows.dll.node.bak
! cd backend && npx prisma db push --accept-data-loss && npx prisma generate
! rm -f backend/node_modules/.prisma/client/*.dll.node.bak
```

## Migrations formelles

Pour créer une migration versionnée propre (hors environnement non-interactif) :
```bash
! cd backend && npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --script > /tmp/migration.sql
```
Puis copier `/tmp/migration.sql` dans `backend/prisma/migrations/<timestamp>_<nom>/migration.sql` et marquer comme appliquée :
```bash
! cd backend && npx prisma migrate resolve --applied "<timestamp>_<nom>"
```

## État courant des migrations
- `20260506183552_init` — schéma initial
- `20260508_post_v2_features` — Container, idTerrain, code localité, porteur projet
