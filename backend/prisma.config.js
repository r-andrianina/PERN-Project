// Configuration Prisma CLI — introduite par la montée en Prisma 7.
//
// Depuis la v7, `url` n'est plus accepté dans le bloc `datasource` du schéma.
// L'URL de connexion se déclare ici pour les commandes Migrate (migrate dev,
// migrate deploy, migrate status, db push…), et le CLIENT la reçoit séparément
// via un adaptateur de pilote (cf. src/config/prisma.js).
//
// En `.js` et non en `.ts` : ce projet est en CommonJS et n'embarque aucun
// TypeScript. Ajouter un compilateur pour un seul fichier de configuration
// coûterait plus que ça ne rapporterait.
//
// `dotenv` est chargé explicitement : le CLI Prisma 7 ne lit plus `.env` tout
// seul comme le faisait la v5.

const path   = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

module.exports = {
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),

  migrations: {
    // Remplace le bloc `"prisma": { "seed": ... }` de package.json, que la v7
    // n'utilise plus.
    seed: 'node prisma/seed.js',
  },

  datasource: {
    url: process.env.DATABASE_URL,
  },
};
