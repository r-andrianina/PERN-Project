// backend/scripts/import-fokontany.js
// Importe le shapefile fokontany/Fokontany.shp dans la table PostGIS fokontany_geo.
// Idempotent : recrée la table à chaque exécution.
//
// Usage: node scripts/import-fokontany.js [chemin/vers/Fokontany.shp]

const path = require('path');
const shp  = require('shapefile');
const { Client } = require('pg');
require('dotenv').config();

const SHP_PATH = process.argv[2] || path.join(__dirname, '..', '..', 'fokontany', 'Fokontany.shp');

const COLORS = { g: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', c: '\x1b[36m', reset: '\x1b[0m' };
const log = (m) => console.log(`${COLORS.c}ℹ${COLORS.reset} ${m}`);
const ok  = (m) => console.log(`${COLORS.g}✓${COLORS.reset} ${m}`);
const warn= (m) => console.log(`${COLORS.y}!${COLORS.reset} ${m}`);

async function main() {
  log(`Lecture de ${SHP_PATH}`);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL manquant');

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  ok('Connecté à PostgreSQL');

  // 1. Activer PostGIS si pas déjà fait
  await client.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);
  ok('Extension PostGIS prête');

  // 2. Recréer la table proprement
  await client.query(`DROP TABLE IF EXISTS fokontany_geo CASCADE;`);
  await client.query(`
    CREATE TABLE fokontany_geo (
      id        SERIAL PRIMARY KEY,
      fokontany VARCHAR(200),
      commune   VARCHAR(200),
      district  VARCHAR(200),
      region    VARCHAR(200),
      lat_centroid DOUBLE PRECISION,
      lng_centroid DOUBLE PRECISION,
      geom      geometry(Polygon, 4326)
    );
  `);
  ok('Table fokontany_geo créée');

  // 3. Lecture du shapefile + insertion par batchs
  const src = await shp.open(SHP_PATH);
  const BATCH_SIZE = 500;
  let batch = [];
  let total = 0;

  const flushBatch = async () => {
    if (batch.length === 0) return;
    // Construit une requête multi-VALUES
    const values = [];
    const params = [];
    let p = 1;
    for (const row of batch) {
      values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, ST_SetSRID(ST_GeomFromGeoJSON($${p++}), 4326))`);
      params.push(
        row.fokontany, row.commune, row.district, row.region,
        row.lat_centroid, row.lng_centroid, row.geom_json,
      );
    }
    await client.query(
      `INSERT INTO fokontany_geo (fokontany, commune, district, region, lat_centroid, lng_centroid, geom)
       VALUES ${values.join(',\n  ')};`,
      params,
    );
    total += batch.length;
    process.stdout.write(`\r  → ${total} fokontany importés`);
    batch = [];
  };

  let r = await src.read();
  while (!r.done) {
    const f = r.value;
    if (f.geometry?.type === 'Polygon') {
      batch.push({
        fokontany: f.properties.FOKONTANY ?? null,
        commune:   f.properties.COMMUNE   ?? null,
        district:  f.properties.DISTRICT  ?? null,
        region:    f.properties.REGION    ?? null,
        lat_centroid: f.properties.Latitude  ?? null,
        lng_centroid: f.properties.Longitude ?? null,
        geom_json: JSON.stringify(f.geometry),
      });
      if (batch.length >= BATCH_SIZE) await flushBatch();
    }
    r = await src.read();
  }
  await flushBatch();
  process.stdout.write('\n');
  ok(`${total} fokontany importés`);

  // 4. Index spatial GIST + index attributs courants
  log('Création des index…');
  await client.query(`CREATE INDEX fokontany_geo_geom_idx ON fokontany_geo USING GIST (geom);`);
  await client.query(`CREATE INDEX fokontany_geo_region_idx   ON fokontany_geo (region);`);
  await client.query(`CREATE INDEX fokontany_geo_district_idx ON fokontany_geo (district);`);
  ok('Index créés');

  await client.end();
  ok('Import terminé');
}

main().catch((err) => {
  console.error(`${COLORS.r}Erreur :${COLORS.reset}`, err.message);
  process.exit(1);
});
