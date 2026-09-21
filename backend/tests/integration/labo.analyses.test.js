// Historique d'analyses d'un spécimen — GET /api/v1/labo/specimen/:type/:id
//
// Ce que cet endpoint apporte, et qui n'existait nulle part ailleurs : une
// manipulation cible SOIT un spécimen individuel, SOIT un pool. Un moustique
// broyé dans un pool est donc analysé sans qu'aucune ligne ne porte son
// `specimenId` — le filtre `?specimenId=` de listManipulations ne le voit pas.
// Ne chercher que les manipulations directes afficherait « aucune analyse » sur
// un spécimen pourtant passé en PCR.
//
// Le second enjeu est une question d'interprétation scientifique : un résultat
// de pool vaut pour le POOL, pas pour l'individu (un pool positif dit « au
// moins un des N »). Chaque entrée porte donc son `origine`, et ces tests
// vérifient que l'étiquette ne se perd pas — présenter les deux comme
// équivalents serait une erreur de lecture, pas un défaut d'affichage.

const {
  resetBase, seedReferentiel, connecter,
  fabriquerXlsx, importer,
  prisma, app, request,
} = require('./helpers');

let token;
let ref;
let moustique;

beforeEach(async () => {
  await resetBase();
  ref   = await seedReferentiel();
  token = await connecter();

  await importer(token, await fabriquerXlsx([
    { series: 'ZZZ_1', date: '2026-03-15' },
    { series: 'ZZZ_2', date: '2026-03-15' },
  ]), 'x.xlsx');
  moustique = await prisma.moustique.findFirst({ where: { idTerrain: 'ZZZ_1' } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const lire = (type, id) =>
  request(app).get(`/api/v1/labo/specimen/${type}/${id}`).set('Authorization', `Bearer ${token}`);

/** Manipulation visant directement un spécimen. */
const manipDirecte = (specimenId, extra = {}) =>
  prisma.manipulationLabo.create({
    data: {
      specimenType: 'moustique', specimenId,
      typeManipulation: 'extraction',
      operateurId: ref.admin.id,
      ...extra,
    },
  });

/** Pool contenant les spécimens donnés, et une manipulation qui le vise. */
async function manipDePool(specimenIds, extra = {}) {
  const pool = await prisma.pool.create({
    data: {
      code: `POOL-${Math.random().toString(36).slice(2, 8)}`,
      nombreIndividus: specimenIds.length,
      membres: { create: specimenIds.map((id) => ({ specimenType: 'moustique', specimenId: id })) },
    },
  });
  const manip = await prisma.manipulationLabo.create({
    data: {
      poolId: pool.id,
      typeManipulation: 'amplification_pcr',
      operateurId: ref.admin.id,
      ...extra,
    },
  });
  return { pool, manip };
}

// ---------------------------------------------------------------------------
describe('Spécimen sans aucune analyse', () => {
  it('répond une liste vide plutôt qu\'une erreur', async () => {
    const r = await lire('moustique', moustique.id);

    expect(r.status).toBe(200);
    expect(r.body.analyses).toEqual([]);
    expect(r.body.resume.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('Manipulation visant directement le spécimen', () => {
  it('la remonte, étiquetée « directe »', async () => {
    await manipDirecte(moustique.id);

    const r = await lire('moustique', moustique.id);

    expect(r.body.analyses).toHaveLength(1);
    expect(r.body.analyses[0].origine).toBe('directe');
    expect(r.body.analyses[0].typeManipulation).toBe('extraction');
    expect(r.body.resume).toMatchObject({ total: 1, directes: 1, viaPools: 0 });
  });

  it('ne remonte pas les analyses d\'un autre spécimen', async () => {
    const autre = await prisma.moustique.findFirst({ where: { idTerrain: 'ZZZ_2' } });
    await manipDirecte(autre.id);

    const r = await lire('moustique', moustique.id);

    expect(r.body.analyses).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Le cœur de l'endpoint
// ---------------------------------------------------------------------------
describe('Manipulation visant un pool dont le spécimen est membre', () => {
  it('la remonte alors qu\'aucune ligne ne porte le specimenId', async () => {
    const { manip } = await manipDePool([moustique.id]);

    // Contre-épreuve : la manipulation ne porte VRAIMENT pas le specimenId.
    // C'est ce qui rend le filtre ?specimenI= de listManipulations aveugle.
    expect(manip.specimenId).toBeNull();

    const r = await lire('moustique', moustique.id);

    expect(r.body.analyses).toHaveLength(1);
    expect(r.body.analyses[0].origine).toBe('pool');
    expect(r.body.resume).toMatchObject({ total: 1, directes: 0, viaPools: 1 });
  });

  it('expose le pool et son effectif, pour que la portée reste lisible', async () => {
    // Un pool positif dit « au moins un des N » : sans N, l'interface ne peut
    // pas distinguer un résultat d'individu d'un résultat de groupe.
    const autre = await prisma.moustique.findFirst({ where: { idTerrain: 'ZZZ_2' } });
    const { pool } = await manipDePool([moustique.id, autre.id]);

    const r = await lire('moustique', moustique.id);

    expect(r.body.analyses[0].pool.code).toBe(pool.code);
    expect(r.body.analyses[0].pool.nombreIndividus).toBe(2);
  });

  it('ne remonte pas un pool auquel le spécimen n\'appartient pas', async () => {
    const autre = await prisma.moustique.findFirst({ where: { idTerrain: 'ZZZ_2' } });
    await manipDePool([autre.id]);

    const r = await lire('moustique', moustique.id);

    expect(r.body.analyses).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('Les deux chemins mélangés', () => {
  it('réunit direct et pool, du plus récent au plus ancien', async () => {
    await manipDirecte(moustique.id, { dateDebut: new Date('2026-04-01T08:00:00Z') });
    await manipDePool([moustique.id],  { dateDebut: new Date('2026-05-01T08:00:00Z') });
    await manipDirecte(moustique.id, { dateDebut: new Date('2026-03-01T08:00:00Z') });

    const r = await lire('moustique', moustique.id);

    expect(r.body.analyses).toHaveLength(3);
    expect(r.body.analyses.map((m) => m.origine)).toEqual(['pool', 'directe', 'directe']);
    expect(r.body.resume).toMatchObject({ total: 3, directes: 2, viaPools: 1 });
  });
});

// ---------------------------------------------------------------------------
describe('Résumé', () => {
  it('compte les résultats en attente de validation', async () => {
    // `brut` = saisi mais pas encore validé par un chercheur. C'est le compteur
    // qui signale qu'une fiche affiche des résultats non confirmés.
    await manipDirecte(moustique.id, { statut: 'brut' });
    await manipDirecte(moustique.id, { statut: 'valide' });
    await manipDePool([moustique.id],  { statut: 'brut' });

    const r = await lire('moustique', moustique.id);

    expect(r.body.resume.enAttenteValidation).toBe(2);
  });

  it('liste les pathogènes recherchés, sans doublon', async () => {
    const borrelia = await prisma.pathogeneCible.create({
      data: { code: 'BORR', nom: 'Borrelia spp.' },
    });
    const { manip } = await manipDePool([moustique.id]);
    await prisma.manipulationPcr.create({
      data: { manipulationId: manip.id, pathogeneCibleId: borrelia.id, statutBandeGel: 'positif' },
    });

    // Une seconde PCR sur le MÊME pathogène ne doit pas le lister deux fois.
    const { manip: manip2 } = await manipDePool([moustique.id]);
    await prisma.manipulationPcr.create({
      data: { manipulationId: manip2.id, pathogeneCibleId: borrelia.id, statutBandeGel: 'negatif' },
    });

    const r = await lire('moustique', moustique.id);

    expect(r.body.resume.pathogenesRecherches).toHaveLength(1);
    expect(r.body.resume.pathogenesRecherches[0]).toMatchObject({ code: 'BORR', nom: 'Borrelia spp.' });
  });
});

// ---------------------------------------------------------------------------
describe('Entrées invalides', () => {
  it('refuse un type de spécimen inconnu', async () => {
    const r = await lire('libellule', moustique.id);
    expect(r.status).toBe(400);
  });

  it('répond 404 pour un spécimen inexistant', async () => {
    const r = await lire('moustique', 999999);
    expect(r.status).toBe(404);
  });

  it('refuse un appel sans jeton', async () => {
    const r = await request(app).get(`/api/v1/labo/specimen/moustique/${moustique.id}`);
    expect(r.status).toBe(401);
  });
});
