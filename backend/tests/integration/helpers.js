// Outils partagés des tests d'intégration : remise à zéro des données,
// jeu de référence minimal, fabrication de fichiers Excel, authentification.

const bcrypt   = require('bcryptjs');
const ExcelJS  = require('exceljs');
const request  = require('supertest');
const prisma   = require('../../src/config/prisma');
const app      = require('../../src/app');
const { importLimiter } = require('../../src/middlewares/rateLimiter');

const MDP_TEST = 'TestIntegr8!';

/**
 * Vide les données transactionnelles ET le référentiel, dans l'ordre inverse
 * des dépendances.
 *
 * `TRUNCATE ... CASCADE` en une seule instruction : plus rapide qu'une cascade
 * de deleteMany, et surtout insensible à l'ordre exact des clés étrangères, qui
 * évoluera avec le schéma. `RESTART IDENTITY` remet les séquences à 1 pour que
 * les identifiants ne dépendent pas des tests déjà passés.
 *
 * Sûreté : cette fonction ne peut tourner que sur la base de test — la config
 * Vitest impose DATABASE_URL, et testDatabase.js refuse de démarrer si la base
 * de dev porte le nom de la base de test.
 */
async function resetBase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      moustiques, tiques, puces, autres_specimens,
      hotes, methodes_collecte, localites, localite_contacts,
      containers, missions, mission_agents, projets, membres_projet,
      audit_logs, notification_reads,
      manipulations_labo, pools, pathogenes_cibles,
      taxonomie_specimens, types_methode_collecte, solutions_conservation,
      users
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Jeu de référence minimal pour qu'un import puisse aboutir : un utilisateur
 * admin, un type de méthode, une solution de conservation, et une branche
 * taxonomique complète.
 *
 * La branche va jusqu'au SOUS-GENRE (Anopheles > Cellia > gambiae) parce que
 * c'est exactement la forme qui a fait échouer 94 % des espèces de moustiques
 * à l'import avant le correctif du 2026-08-20 : la résolution ne traversait pas
 * le sous-genre. Un jeu de test à branche plate laisserait ce bug repasser.
 */
async function seedReferentiel() {
  const admin = await prisma.user.create({
    data: {
      nom: 'Test', prenom: 'Admin',
      email: 'admin@test.local',
      passwordHash: await bcrypt.hash(MDP_TEST, 10),
      role: 'admin', actif: true,
    },
  });

  // Le compteur du limiteur d'imports vit en mémoire du processus, pas en
  // base : `resetBase()` ne l'efface donc pas, et sa clé est l'id de
  // l'utilisateur — identique à chaque test puisque TRUNCATE … RESTART
  // IDENTITY redonne toujours le même. Sans cette remise à zéro, le 21e import
  // du fichier reçoit un 429 « Trop d'imports lancés » : le test échoue pour
  // une raison qui n'a rien à voir avec ce qu'il vérifie, et son corps de
  // réponse n'a même pas de champ `errors` (constaté le 2026-09-24, en
  // ajoutant deux cas à un fichier qui frôlait déjà le plafond de 20).
  importLimiter.resetKey(String(admin.id));

  const [cdc] = await Promise.all([
    prisma.typeMethodeCollecte.create({ data: { code: 'CDC', nom: 'CDC_LIGHT_TRAP' } }),
    prisma.typeMethodeCollecte.create({ data: { code: 'BG',  nom: 'BIOGENTS_TRAP' } }),
    prisma.solutionConservation.create({ data: { nom: '95%_ETHANOL' } }),
  ]);

  const ordre   = await prisma.taxonomieSpecimen.create({
    data: { niveau: 'ordre', nom: 'Diptera', type: 'moustique' },
  });
  const famille = await prisma.taxonomieSpecimen.create({
    data: { niveau: 'famille', nom: 'Culicidae', parentId: ordre.id },
  });
  const genre   = await prisma.taxonomieSpecimen.create({
    data: { niveau: 'genre', nom: 'Anopheles', parentId: famille.id },
  });
  const sousGenre = await prisma.taxonomieSpecimen.create({
    data: { niveau: 'sous_genre', nom: 'Cellia', parentId: genre.id },
  });
  const espece = await prisma.taxonomieSpecimen.create({
    data: { niveau: 'espece', nom: 'gambiae', parentId: sousGenre.id },
  });

  return { admin, cdc, genre, sousGenre, espece };
}

/** Jeton d'un utilisateur, obtenu par la vraie route de connexion. */
async function connecter(email = 'admin@test.local', motDePasse = MDP_TEST) {
  const r = await request(app).post('/api/v1/auth/login').send({ email, password: motDePasse });
  if (!r.body.token) {
    throw new Error(`Connexion impossible (${r.status}) : ${JSON.stringify(r.body)}`);
  }
  return r.body.token;
}

// En-têtes du modèle d'import, dans l'ordre attendu.
const COLONNES = [
  'SERIES', 'MISSION_ORDER_NUMBER', 'PROJET', 'COLLECTION_LOCATION', 'WHAT_3_WORDS',
  'DECIMAL_LATITUDE', 'DECIMAL_LONGITUDE', 'ELEVATION', 'DATE_OF_COLLECTION',
  'COLLECTION_METHOD', 'OUTDOORS_INDOORS', 'TIME_OF_COLLECTION', 'SCIENTIFIC_NAME',
  'GENUS', 'SPECIES', 'NUMBER', 'SEX', 'LIFESTAGE', 'BLOOD_MEAL', 'PARITY',
  'ORGANISM_PART', 'PRESERVATIVE_SOLUTION', 'BOX_PLATE_ID', 'TUBE_OR_WELL_ID', 'REMARKS',
];

const LIGNE_TYPE = {
  series: 'ZZZ_1', mission: 'OM-TEST-001', projet: 'PROJ-TEST',
  lieu: 'Analamanga | Antananarivo | Test | Zone', w3w: 'ZZZ',
  lat: -18.9137, lon: 47.5361, alt: 1250,
  date: '2026-03-15', method: 'CDC', intExt: 'OUTDOORS', heure: '',
  taxo: 'Anopheles gambiae', genre: 'Anopheles', espece: 'gambiae',
  nombre: 1, sexe: 'FEMALE', stade: 'ADULT', sang: 'N', parite: 'Nullipare',
  organe: 'WHOLE_ORGANISM', preserv: '95%_ETHANOL', box: '', pos: '', notes: '',
};

/** Construit un .xlsx en mémoire. Chaque entrée complète LIGNE_TYPE. */
async function fabriquerXlsx(lignes) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Moustiques');
  ws.addRow(COLONNES);

  for (const brute of lignes) {
    const l = { ...LIGNE_TYPE, ...brute };
    ws.addRow([
      l.series, l.mission, l.projet, l.lieu, l.w3w,
      l.lat, l.lon, l.alt, l.date, l.method, l.intExt, l.heure,
      l.taxo, l.genre, l.espece, l.nombre, l.sexe, l.stade, l.sang, l.parite,
      l.organe, l.preserv, l.box, l.pos, l.notes,
    ]);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Envoie un classeur sur la route d'import et renvoie la réponse supertest. */
const importer = (token, buffer, nom = 'test.xlsx') =>
  request(app)
    .post('/api/v1/import/moustiques')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', buffer, nom);

/** Tubes enregistrés pour une mission, dans l'ordre de création. */
async function tubesDeLaMission(ordreMission) {
  const rows = await prisma.moustique.findMany({
    where:   { localite: { mission: { ordreMission } } },
    select:  { idTerrain: true },
    orderBy: { id: 'asc' },
  });
  return rows.map((r) => r.idTerrain);
}

module.exports = {
  MDP_TEST, COLONNES, LIGNE_TYPE,
  resetBase, seedReferentiel, connecter,
  fabriquerXlsx, importer, tubesDeLaMission,
  prisma, app, request,
};
