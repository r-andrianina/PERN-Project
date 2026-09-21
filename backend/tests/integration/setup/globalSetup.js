// Prépare la base de test UNE FOIS avant toute la campagne : création si elle
// n'existe pas, puis application des migrations.
//
// Le schéma n'est pas reconstruit entre les fichiers de test — seules les
// données le sont (cf. helpers.js). Rejouer 27 migrations à chaque fichier
// coûterait plusieurs dizaines de secondes pour aucun gain : ce qu'on veut
// isoler, ce sont les lignes, pas les tables.

const { execSync }     = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg }     = require('@prisma/adapter-pg');
const { NOM_BASE_TEST, urlTest, urlMaintenance } = require('./testDatabase');

async function creerBaseSiAbsente() {
  // Client jeté, branché sur la base de maintenance : on ne peut pas se
  // connecter à une base qui n'existe pas encore pour la créer.
  //
  // Prisma 7 a supprimé l'option `datasources` du constructeur, qui servait
  // jusqu'ici à pointer une URL différente de celle du schéma. Le ciblage
  // passe désormais par l'adaptateur de pilote.
  const admin = new PrismaClient({
    adapter: new PrismaPg({ connectionString: urlMaintenance }),
  });
  try {
    const existe = await admin.$queryRawUnsafe(
      'SELECT 1 FROM pg_database WHERE datname = $1', NOM_BASE_TEST,
    );
    if (existe.length === 0) {
      // CREATE DATABASE n'accepte pas de paramètre lié et ne tourne pas dans
      // une transaction. Le nom est une constante du dépôt, jamais une entrée
      // utilisateur — pas de surface d'injection.
      await admin.$executeRawUnsafe(`CREATE DATABASE "${NOM_BASE_TEST}"`);
      console.log(`[test] base « ${NOM_BASE_TEST} » créée`);
    }
  } finally {
    await admin.$disconnect();
  }
}

module.exports = async function globalSetup() {
  try {
    await creerBaseSiAbsente();
  } catch (err) {
    throw new Error(
      `Base de test inaccessible : ${err.message}\n`
      + 'Les tests d\'intégration ont besoin de PostgreSQL — démarrez-le avec '
      + '`docker compose up -d` puis relancez.',
    );
  }

  // `migrate deploy` applique ce qui manque et ne fait rien si tout est à jour :
  // relancer la campagne reste donc rapide.
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env:   { ...process.env, DATABASE_URL: urlTest },
  });
};
