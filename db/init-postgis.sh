#!/bin/bash
# db/init-postgis.sh
# Exécuté UNE SEULE FOIS lors du premier démarrage du conteneur PostgreSQL
# (quand le volume pgdata est vide). Active PostGIS dans la base.
set -e

psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname   "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS postgis_topology;
EOSQL

echo "✓ PostGIS activé dans la base specimenmanager"
