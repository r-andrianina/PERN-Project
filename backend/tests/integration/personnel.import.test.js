// Import de l'annuaire du personnel : rapprochement des noms incomplets, et
// décompte des missions par fiche.
//
// Le cas d'origine (base de dev, 2026-10-09) : la migration avait repris le
// compte « Henintsoa Andrianina » en fiche Personnel, chef de deux missions ;
// l'annuaire l'écrit « RAZANAKOTO Henintsoa Andrianina ». L'import a créé une
// seconde fiche, et les missions sont restées sur la première. Le même
// doublon se serait reproduit en production pour chaque compte dont le nom
// diffère de l'annuaire.

const ExcelJS = require('exceljs');
const { resetBase, seedReferentiel, connecter, prisma, app, request } = require('./helpers');

let jeton;

beforeEach(async () => {
  await resetBase();
  await seedReferentiel();
  jeton = await connecter();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Annuaire minimal : Nom complet · Fonction · Équipe · Actif. */
async function annuaire(lignes) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Personnel');
  ws.addRow(['Nom complet', 'Fonction', 'Équipe', 'Actif']);
  for (const l of lignes) ws.addRow(l);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const importer = (buffer) =>
  request(app)
    .post('/api/v1/dictionnaire/personnel/import')
    .set('Authorization', `Bearer ${jeton}`)
    .attach('file', buffer, 'annuaire.xlsx');

const nomsEnBase = async () =>
  (await prisma.personnel.findMany({ orderBy: { nom: 'asc' }, select: { nom: true } })).map((p) => p.nom);

/** Une mission dont `chefId` est chef et `agentIds` les agents. */
async function mission(ordre, chefId, agentIds = []) {
  const projet = await prisma.projet.upsert({
    where: { code: 'PRJ' }, update: {}, create: { code: 'PRJ', nom: 'Projet test' },
  });
  return prisma.mission.create({
    data: {
      ordreMission: ordre, projetId: projet.id, dateDebut: new Date('2026-06-10'),
      chefMissionId: chefId,
      agents: { create: agentIds.map((personnelId) => ({ personnelId })) },
    },
  });
}

// ---------------------------------------------------------------------------
describe("Import de l'annuaire — rapprochement des noms incomplets", () => {
  it('renomme la fiche reprise au lieu de créer un doublon, et garde ses missions', async () => {
    const reprise = await prisma.personnel.create({ data: { nom: 'Henintsoa Andrianina' } });
    await mission('OM-1', reprise.id, [reprise.id]);

    const r = await importer(await annuaire([
      ['RAZANAKOTO Henintsoa Andrianina', 'Développeur base de données', 'Équipe support', 'oui'],
    ]));

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ creees: 0, rapprochees: 1 });
    expect(r.body.renommages).toEqual([
      { ancien: 'Henintsoa Andrianina', nouveau: 'RAZANAKOTO Henintsoa Andrianina' },
    ]);
    expect(r.body.absentes).toEqual([]);

    // Même fiche (même id), complétée — et la mission pointe toujours dessus.
    const fiche = await prisma.personnel.findUnique({ where: { id: reprise.id } });
    expect(fiche).toMatchObject({
      nom: 'RAZANAKOTO Henintsoa Andrianina', fonction: 'Développeur base de données', equipe: 'Équipe support',
    });
    expect(await nomsEnBase()).toEqual(['RAZANAKOTO Henintsoa Andrianina']);
    const m = await prisma.mission.findUnique({ where: { ordreMission: 'OM-1' } });
    expect(m.chefMissionId).toBe(reprise.id);
  });

  it("ne devine pas quand deux lignes de l'annuaire conviennent à la même fiche", async () => {
    await prisma.personnel.create({ data: { nom: 'Jean RAKOTO' } });

    const r = await importer(await annuaire([
      ['Jean Paul RAKOTO', '', '', ''],
      ['Jean Marc RAKOTO', '', '', ''],
    ]));

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ creees: 2, rapprochees: 0 });
    // La fiche ambiguë reste telle quelle, et elle est signalée.
    expect(r.body.absentes).toEqual(['Jean RAKOTO']);
    expect(await nomsEnBase()).toEqual(['Jean Marc RAKOTO', 'Jean Paul RAKOTO', 'Jean RAKOTO']);
  });

  it('ne rapproche pas une fiche que le fichier nomme déjà exactement', async () => {
    // « Michaël TANTELY » a sa propre ligne : la ligne plus longue est une
    // autre personne, pas la même écrite plus complètement.
    await prisma.personnel.create({ data: { nom: 'Michaël TANTELY' } });

    const r = await importer(await annuaire([
      ['TANTELY Michaël', 'Chauffeur', '', ''],
      ['Michaël Luciano TANTELY', 'Technicien', '', ''],
    ]));

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ creees: 1, rapprochees: 0, misesAJour: 1 });
    expect(await nomsEnBase()).toEqual(['Michaël Luciano TANTELY', 'Michaël TANTELY']);
  });
});

// ---------------------------------------------------------------------------
describe('Liste du personnel — nombre de missions', () => {
  it('compte une seule fois la mission dont la personne est chef ET agent', async () => {
    const a = await prisma.personnel.create({ data: { nom: 'Henintsoa Andrianina' } });
    const b = await prisma.personnel.create({ data: { nom: 'Sarobidy RIVO' } });
    await mission('OM-1', a.id, [a.id, b.id]);   // a : chef et agent
    await mission('OM-2', b.id, [a.id]);         // a : agent ; b : chef

    const r = await request(app)
      .get('/api/v1/dictionnaire/personnel')
      .set('Authorization', `Bearer ${jeton}`);

    expect(r.status).toBe(200);
    const parNom = Object.fromEntries(r.body.items.map((p) => [p.nom, p.nbMissions]));
    expect(parNom).toEqual({ 'Henintsoa Andrianina': 2, 'Sarobidy RIVO': 2 });
  });
});
