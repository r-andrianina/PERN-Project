// Cloisonnement par projet sur les trois chemins de LECTURE transverses —
// carte, recherche, tableau de bord.
//
// Contexte (2026-09-16) : ces trois-là ne filtraient que par TYPE de spécimen.
// Un chercheur affecté à un seul projet voyait les coordonnées GPS de tous les
// pièges de l'institut sur la carte, retrouvait et exportait n'importe quel
// spécimen par la recherche, et lisait des totaux à l'échelle de l'institut.
// Les douze autres modules avaient reçu le cloisonnement ; ces trois chemins ne
// l'avaient jamais eu.
//
// Chaque chemin a sa CONTRE-ÉPREUVE admin : un filtre qui cacherait tout à
// tout le monde passerait les assertions « le chercheur ne voit pas B » sans
// rien prouver.
//
// Le jeu de données est construit directement en base plutôt que par l'import
// Excel : `importLimiter` plafonne à 20 imports par 10 minutes sans dérogation
// en test, et deux imports par test épuisaient le quota en cours de fichier —
// les tests suivants échouaient alors sur des données absentes, pas sur le
// cloisonnement.

const bcrypt  = require('bcryptjs');
const ExcelJS = require('exceljs');
const {
  resetBase, seedReferentiel, connecter, MDP_TEST,
  prisma, app, request,
} = require('./helpers');

let jetonAdmin;
let jetonChercheur;

/** Un projet complet : mission, localité, piège géolocalisé, un moustique. */
async function creerProjet({ code, lat, lon, localite, idTerrain, taxonomieId, typeMethodeId }) {
  const projet = await prisma.projet.create({ data: { code, nom: code } });
  const mission = await prisma.mission.create({
    data: { ordreMission: `OM-${code}`, projetId: projet.id, dateDebut: new Date('2026-09-01') },
  });
  const loc = await prisma.localite.create({ data: { missionId: mission.id, nom: localite } });
  const methode = await prisma.methodeCollecte.create({
    data: {
      localiteId: loc.id, typeMethodeId, numero: 1,
      latitude: lat, longitude: lon,
      datePose: new Date('2026-09-01'), dateReleve: new Date('2026-09-02'),
    },
  });
  await prisma.moustique.create({
    data: {
      idTerrain, methodeId: methode.id, localiteId: loc.id,
      taxonomieId, nombre: 1, sexe: 'F',
      dateCollecte: new Date('2026-09-02'),
    },
  });
  return projet;
}

beforeEach(async () => {
  await resetBase();
  const ref = await seedReferentiel();
  jetonAdmin = await connecter();

  const commun = { taxonomieId: ref.espece.id, typeMethodeId: ref.cdc.id };
  const projetA = await creerProjet({ code: 'PROJ-A', lat: -18.1, lon: 47.1, localite: 'Alphaville', idTerrain: 'AAA_1', ...commun });
  await creerProjet({ code: 'PROJ-B', lat: -19.2, lon: 46.2, localite: 'Betaville', idTerrain: 'BBB_1', ...commun });

  const chercheur = await prisma.user.create({
    data: {
      nom: 'Test', prenom: 'Chercheur',
      email: 'chercheur@test.local',
      passwordHash: await bcrypt.hash(MDP_TEST, 10),
      role: 'chercheur', actif: true,
      specimensAutorises: ['moustique', 'tique', 'puce'],
    },
  });
  await prisma.membreProjet.create({ data: { projetId: projetA.id, userId: chercheur.id } });

  jetonChercheur = await connecter('chercheur@test.local');
});

afterAll(async () => {
  await prisma.$disconnect();
});

const lire = (url, jeton) => request(app).get(url).set('Authorization', `Bearer ${jeton}`);

// ---------------------------------------------------------------------------
describe('Carte', () => {
  it('ne montre au chercheur que les pièges de son projet', async () => {
    const r = await lire('/api/v1/carte/specimens', jetonChercheur);

    expect(r.status).toBe(200);
    expect(r.body.points).toHaveLength(1);
    expect(r.body.points[0].localite.nom).toBe('Alphaville');
  });

  it('ne laisse fuir aucune coordonnée de l’autre projet', async () => {
    // Le point sensible : une position de piège désigne un lieu physique qu'on
    // peut aller visiter. L'assertion porte sur la valeur, pas sur le compte.
    const r = await lire('/api/v1/carte/specimens', jetonChercheur);

    expect(r.body.points.map((p) => p.longitude)).not.toContain(46.2);
  });

  it('CONTRE-ÉPREUVE : l’admin voit les deux projets', async () => {
    const r = await lire('/api/v1/carte/specimens', jetonAdmin);

    expect(r.body.points).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
describe('Recherche', () => {
  it('ne renvoie au chercheur que les spécimens de son projet', async () => {
    const r = await lire('/api/v1/recherche/specimens', jetonChercheur);

    expect(r.status).toBe(200);
    expect(r.body.items.map((s) => s.idTerrain)).toEqual(['AAA_1']);
  });

  it('cloisonne aussi l’export Excel', async () => {
    // L’export passe par le même fetchAllSpecimens. S’il avait gardé sa propre
    // requête, le filtre aurait pu être posé sur la liste et oublié ici — la
    // fuite la plus discrète, puisqu’elle sort en fichier.
    //
    // Le classeur est RÉELLEMENT ouvert : une première version comparait le
    // corps de la réponse à une chaîne, mais supertest ne remplit pas `text`
    // pour une réponse binaire — l’assertion passait donc même sans
    // cloisonnement, et ne prouvait rien. Vérifié par mutation.
    const r = await request(app)
      .get('/api/v1/recherche/specimens/export')
      .set('Authorization', `Bearer ${jetonChercheur}`)
      .buffer(true)
      .parse((res, cb) => { const m = []; res.on('data', (c) => m.push(c)); res.on('end', () => cb(null, Buffer.concat(m))); });

    expect(r.status).toBe(200);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(r.body);
    const cellules = [];
    wb.worksheets[0].eachRow((row) => row.eachCell((c) => cellules.push(String(c.value ?? ''))));

    expect(cellules).toContain('AAA_1');
    expect(cellules).not.toContain('BBB_1');
  });

  it('CONTRE-ÉPREUVE : l’admin retrouve les deux', async () => {
    const r = await lire('/api/v1/recherche/specimens', jetonAdmin);

    expect(r.body.items.map((s) => s.idTerrain).sort()).toEqual(['AAA_1', 'BBB_1']);
  });
});

// ---------------------------------------------------------------------------
describe('Tableau de bord', () => {
  it('ne compte que les projets et missions du chercheur', async () => {
    const r = await lire('/api/v1/dashboard/stats', jetonChercheur);

    expect(r.status).toBe(200);
    expect(r.body.totaux.projets).toBe(1);
    expect(r.body.totaux.missions).toBe(1);
  });

  it('ne compte que les spécimens de son projet', async () => {
    const r = await lire('/api/v1/dashboard/stats', jetonChercheur);

    expect(r.body.totaux.moustiques).toBe(1);
  });

  it('ne liste pas les missions de l’autre projet', async () => {
    const r = await lire('/api/v1/dashboard/stats', jetonChercheur);

    expect(r.body.missionsRecentes.map((m) => m.ordreMission)).toEqual(['OM-PROJ-A']);
  });

  it('cloisonne les courbes mensuelles, écrites en SQL brut', async () => {
    // Ce chemin n'est pas du Prisma : le filtre y est un fragment SQL assemblé
    // à part, il pouvait donc être oublié alors que tout le reste était juste.
    const r = await lire('/api/v1/dashboard/stats', jetonChercheur);

    const total = r.body.parMois.reduce((s, m) => s + (m.moustique ?? 0), 0);
    expect(total).toBe(1);
  });

  it('CONTRE-ÉPREUVE : l’admin voit les deux projets', async () => {
    const r = await lire('/api/v1/dashboard/stats', jetonAdmin);

    expect(r.body.totaux.projets).toBe(2);
    expect(r.body.totaux.moustiques).toBe(2);
    expect(r.body.parMois.reduce((s, m) => s + (m.moustique ?? 0), 0)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
describe('Chercheur sans aucun projet', () => {
  it('ne voit rien, plutôt que tout', async () => {
    // Le cas qui se retourne le plus facilement : une liste VIDE de projets
    // accessibles ne doit jamais être lue comme « aucun filtre ». C'est aussi
    // le cas qui casse le SQL brut — un IN () vide est une erreur de syntaxe.
    await prisma.user.create({
      data: {
        nom: 'Test', prenom: 'Orphelin',
        email: 'orphelin@test.local',
        passwordHash: await bcrypt.hash(MDP_TEST, 10),
        role: 'chercheur', actif: true,
        specimensAutorises: ['moustique', 'tique', 'puce'],
      },
    });
    const jeton = await connecter('orphelin@test.local');

    const carte = await lire('/api/v1/carte/specimens', jeton);
    expect(carte.status).toBe(200);
    expect(carte.body.points).toHaveLength(0);

    const recherche = await lire('/api/v1/recherche/specimens', jeton);
    expect(recherche.body.items).toHaveLength(0);

    const stats = await lire('/api/v1/dashboard/stats', jeton);
    expect(stats.status).toBe(200);
    expect(stats.body.totaux.projets).toBe(0);
    expect(stats.body.totaux.moustiques).toBe(0);
    expect(stats.body.parMois.reduce((s, m) => s + (m.moustique ?? 0), 0)).toBe(0);
  });
});
