# /import-geo — Importer le shapefile Fokontany dans PostGIS

Crée (ou recrée) la table `fokontany_geo` avec les 17 416 polygones.

## Pré-requis

- Le container Docker doit tourner sur le port 5435
- Le fichier `fokontany/Fokontany.shp` doit exister à la racine du projet

## Commande

```bash
! cd backend && node scripts/import-fokontany.js
```

## Durée estimée

~15–30 secondes selon la RAM disponible (batchs de 500).

## Ce qui est créé

```sql
CREATE TABLE fokontany_geo (
  id           SERIAL PRIMARY KEY,
  fokontany    VARCHAR(200),
  commune      VARCHAR(200),
  district     VARCHAR(200),
  region       VARCHAR(200),
  lat_centroid DOUBLE PRECISION,
  lng_centroid DOUBLE PRECISION,
  geom         geometry(Polygon, 4326)
);
CREATE INDEX fokontany_geo_geom_idx ON fokontany_geo USING GIST (geom);
```

## Utilisation

L'endpoint de lookup est `GET /api/v1/localites/lookup-fokontany?lat=X&lng=Y`
- **match=true** → point dans le polygone → retourne région/district/commune/fokontany
- **match=false** → point hors polygone → retourne le fokontany le plus proche (fallback KNN)

## Idempotent

Le script fait `DROP TABLE IF EXISTS fokontany_geo CASCADE` avant de recréer.
Peut être relancé sans risque (mais efface les données existantes de la table).
