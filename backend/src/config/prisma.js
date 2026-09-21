// backend/src/config/prisma.js
// Instance unique de Prisma Client — à importer dans tous les controllers.
//
// Depuis Prisma 7, le client ne lit plus `url` dans le schéma : il reçoit un
// ADAPTATEUR DE PILOTE. Les requêtes passent désormais par `pg`
// (node-postgres), déjà présent dans le projet pour l'import du shapefile
// PostGIS, au lieu du pool interne du moteur Rust.
//
// Conséquence à connaître : c'est `pg` qui gère maintenant le pool de
// connexions. Les réglages ci-dessous remplacent ceux que Prisma appliquait
// implicitement, et ils comptent pour l'import Excel, dont la transaction
// unique retient une connexion pendant toute sa durée (cf. import.controller.js).

const path             = require('node:path');
const dotenv           = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg }     = require('@prisma/adapter-pg');

// `.env` est chargé ICI, et pas seulement dans server.js : jusqu'à la v6,
// Prisma le lisait implicitement, si bien que tout script important ce
// singleton héritait de DATABASE_URL sans rien faire. La v7 ne le fait plus —
// les scripts de maintenance et les sondes ponctuelles échouaient donc dès le
// require, avec une erreur d'adaptateur sans rapport apparent avec sa cause.
//
// `dotenv` n'écrase JAMAIS une variable déjà définie : la configuration Vitest
// des tests d'intégration, qui impose sa propre base, garde donc la main.
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

if (!process.env.DATABASE_URL) {
  // Échouer ici, bruyamment, plutôt que sur la première requête : une URL
  // absente produisait sinon une erreur d'adaptateur illisible, loin de sa
  // cause.
  throw new Error(
    'DATABASE_URL absente — le client Prisma ne peut pas être construit. '
    + 'Vérifiez backend/.env.',
  );
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  // Un import de 20 000 lignes tient une connexion du début à la fin de sa
  // transaction ; le reste de l'application doit continuer d'être servi.
  max: 10,
  idleTimeoutMillis: 30_000,
});

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

// Vérification connexion au démarrage
prisma.$connect()
  .then(() => console.log('✅ Prisma connecté à PostgreSQL'))
  .catch((err) => console.error('❌ Erreur Prisma :', err.message));

module.exports = prisma;
