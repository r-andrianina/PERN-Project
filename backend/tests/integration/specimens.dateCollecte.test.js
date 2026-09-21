// Date de collecte d'un spécimen — de bout en bout : vraie route HTTP, vraie base.
//
// Modèle établi le 2026-09-16 : UNE MÉTHODE = UNE NUIT-PIÈGE.
//   dateReleve = matin de collecte = specimen.dateCollecte
//   datePose   = dateReleve - 1
//
// Ce que ces tests protègent, et pourquoi ils sont ici plutôt qu'en unitaire :
// l'invariant porte sur les DONNÉES (« aucun spécimen n'est daté autrement que
// sa méthode »), pas sur un appel de fonction. Un Prisma mocké ne peut pas le
// vérifier — il n'y a pas de données. Seule une base peut répondre.
//
// L'état qui a motivé tout ceci : 313 des 756 moustiques de la base de dev
// étaient datés autrement que leur méthode, dont 10 avec 336 jours d'écart
// qu'aucun contrôle n'avait vus. Le champ date du formulaire était libre et
// n'était relié à rien.

const {
  resetBase, seedReferentiel, connecter,
  fabriquerXlsx, importer,
  prisma, app, request,
} = require('./helpers');

let token;
let ref;

beforeEach(async () => {
  await resetBase();
  ref   = await seedReferentiel();
  token = await connecter();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const jour = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/** Importe une ligne et renvoie la méthode + le moustique créés. */
async function importerUneLigne(date, series = 'ZZZ_1') {
  const r = await importer(token, await fabriquerXlsx([{ series, date }]), 'x.xlsx');
  expect(r.status).toBe(200);
  const moustique = await prisma.moustique.findFirst({
    where: { idTerrain: series }, include: { methode: true },
  });
  return { moustique, methode: moustique.methode };
}

/** Identifiant du spécimen créé, quelle que soit la forme de la réponse. */
const idCree = (body) => body.moustique?.id ?? body.item?.id ?? body.id;

// ---------------------------------------------------------------------------
// La date du fichier IPM est le RELEVÉ, pas la pose
//
// Avant le 2026-09-16, DATE_OF_COLLECTION alimentait datePose et le relevé
// était déduit à J+1 — ce qui datait toute la base d'un jour trop tard.
// ---------------------------------------------------------------------------
describe('Import : la date du fichier alimente le relevé', () => {
  it('place la date en dateReleve et déduit la pose à J-1', async () => {
    const { methode } = await importerUneLigne('2026-03-15');

    expect(jour(methode.dateReleve)).toBe('2026-03-15');
    expect(jour(methode.datePose)).toBe('2026-03-14');
  });

  it('date le spécimen du matin de relevé de sa méthode', async () => {
    const { moustique, methode } = await importerUneLigne('2026-03-15');

    expect(jour(moustique.dateCollecte)).toBe('2026-03-15');
    expect(jour(moustique.dateCollecte)).toBe(jour(methode.dateReleve));
  });

  it('retrouve la méthode existante au second import, sans la dupliquer', async () => {
    // La recherche se fait par dateReleve. Si elle repassait par datePose
    // (qui vaut désormais J-1), aucune méthode ne serait retrouvée et chaque
    // import en créerait une nouvelle.
    await importerUneLigne('2026-03-15', 'ZZZ_1');
    const r = await importer(token, await fabriquerXlsx([{ series: 'ZZZ_2', date: '2026-03-15' }]), 'b.xlsx');
    expect(r.status).toBe(200);

    expect(await prisma.methodeCollecte.count()).toBe(1);
  });

  it('crée deux méthodes pour deux nuits du même piège', async () => {
    // Deux nuits = deux unités d'effort distinctes. Les rabattre sur une seule
    // méthode ferait compter UNE nuit là où il y en a eu deux, et surestimerait
    // d'autant toute densité « captures / piège / nuit ».
    await importerUneLigne('2026-03-15', 'ZZZ_1');
    await importer(token, await fabriquerXlsx([{ series: 'ZZZ_2', date: '2026-03-16' }]), 'b.xlsx');

    const methodes = await prisma.methodeCollecte.findMany({ orderBy: { dateReleve: 'asc' } });
    expect(methodes).toHaveLength(2);
    expect(methodes.map((m) => jour(m.dateReleve))).toEqual(['2026-03-15', '2026-03-16']);
  });
});

// ---------------------------------------------------------------------------
// Création par l'API : la date DÉRIVE, elle ne se saisit plus
// ---------------------------------------------------------------------------
describe('POST /moustiques : date dérivée de la nuit-piège', () => {
  const creer = (methodeId, corps = {}) =>
    request(app)
      .post('/api/v1/moustiques')
      .set('Authorization', `Bearer ${token}`)
      .send({ methodeId, taxonomieId: ref.espece.id, nombre: 1, sexe: 'F', ...corps });

  it('ignore une date de collecte contredisant la méthode', async () => {
    const { methode } = await importerUneLigne('2026-03-15');

    const r = await creer(methode.id, { dateCollecte: '2025-06-12' });
    expect(r.status).toBe(201);

    // 2025-06-12 est précisément le genre de valeur qui avait produit des
    // spécimens datés d'un an avant leur piège.
    const cree = await prisma.moustique.findUnique({ where: { id: idCree(r.body) } });
    expect(jour(cree.dateCollecte)).toBe('2026-03-15');
    expect(jour(cree.dateCollecte)).not.toBe('2025-06-12');
  });

  it('date le spécimen même quand le corps ne porte aucune date', async () => {
    const { methode } = await importerUneLigne('2026-03-15');

    const r = await creer(methode.id);
    expect(r.status).toBe(201);

    const cree = await prisma.moustique.findUnique({ where: { id: idCree(r.body) } });
    expect(jour(cree.dateCollecte)).toBe('2026-03-15');
  });

  it('retient la date transmise pour une méthode sans date de relevé', async () => {
    // Seul cas où la valeur du corps fait foi : la méthode ne sait pas dater
    // le spécimen, refuser la saisie perdrait l'information.
    const { methode } = await importerUneLigne('2026-03-15');
    await prisma.methodeCollecte.update({
      where: { id: methode.id }, data: { dateReleve: null },
    });

    const r = await creer(methode.id, { dateCollecte: '2026-03-15' });
    expect(r.status).toBe(201);

    const cree = await prisma.moustique.findUnique({ where: { id: idCree(r.body) } });
    expect(jour(cree.dateCollecte)).toBe('2026-03-15');
  });
});

// ---------------------------------------------------------------------------
// Mise à jour : une date contradictoire est REFUSÉE, pas ignorée
// ---------------------------------------------------------------------------
describe('PUT /moustiques/:id : date contradictoire refusée', () => {
  const modifier = (id, corps) =>
    request(app)
      .put(`/api/v1/moustiques/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(corps);

  it('refuse en 400 une date qui contredit la nuit-piège', async () => {
    const { moustique } = await importerUneLigne('2026-03-15');

    const r = await modifier(moustique.id, { dateCollecte: '2026-03-20' });
    expect(r.status).toBe(400);

    // Refusée explicitement, et surtout : rien n'a bougé en base. Une erreur
    // silencieuse aurait laissé croire à l'utilisateur que sa date était prise.
    const apres = await prisma.moustique.findUnique({ where: { id: moustique.id } });
    expect(jour(apres.dateCollecte)).toBe('2026-03-15');
  });

  it('accepte une date identique à la nuit-piège', async () => {
    const { moustique } = await importerUneLigne('2026-03-15');

    const r = await modifier(moustique.id, { dateCollecte: '2026-03-15', notes: 'inchangée' });
    expect(r.status).toBe(200);
  });

  it('laisse passer une modification qui ne touche pas à la date', async () => {
    const { moustique } = await importerUneLigne('2026-03-15');

    const r = await modifier(moustique.id, { notes: 'antenne abîmée' });
    expect(r.status).toBe(200);

    const apres = await prisma.moustique.findUnique({ where: { id: moustique.id } });
    expect(jour(apres.dateCollecte)).toBe('2026-03-15');
    expect(apres.notes).toBe('antenne abîmée');
  });
});

// ---------------------------------------------------------------------------
// L'invariant lui-même
//
// C'est la requête qui a révélé le problème sur la base de dev. Elle est rejouée
// ici après un parcours complet : import multi-nuits, créations par l'API,
// modifications. Si la dérivation régresse où que ce soit, ce test tombe.
// ---------------------------------------------------------------------------
describe('Invariant global', () => {
  it('aucun spécimen n’est daté autrement que sa méthode', async () => {
    await importer(token, await fabriquerXlsx([
      { series: 'ZZZ_1', date: '2026-03-15' },
      { series: 'ZZZ_2', date: '2026-03-16' },
      { series: 'ZZZ_3', date: '2026-03-17' },
      { series: 'ZZZ_4', date: '2026-03-17' },
    ]), 'multi.xlsx');

    const methodes = await prisma.methodeCollecte.findMany();
    for (const m of methodes) {
      await request(app)
        .post('/api/v1/moustiques')
        .set('Authorization', `Bearer ${token}`)
        .send({ methodeId: m.id, taxonomieId: ref.espece.id, nombre: 1, sexe: 'F', dateCollecte: '2020-01-01' });
    }

    const [{ hors_invariant: horsInvariant, total }] = await prisma.$queryRaw`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE m.date_collecte::date <> mc.date_releve::date)::int AS hors_invariant
      FROM moustiques m JOIN methodes_collecte mc ON mc.id = m.methode_id`;

    expect(total).toBeGreaterThan(4);
    expect(horsInvariant).toBe(0);
  });

  it('chaque méthode ne couvre qu’une seule nuit', async () => {
    await importer(token, await fabriquerXlsx([
      { series: 'ZZZ_1', date: '2026-03-15' },
      { series: 'ZZZ_2', date: '2026-03-16' },
      { series: 'ZZZ_3', date: '2026-03-16' },
    ]), 'multi.xlsx');

    const [{ n }] = await prisma.$queryRaw`
      SELECT count(*)::int AS n FROM (
        SELECT mc.id FROM methodes_collecte mc JOIN moustiques m ON m.methode_id = mc.id
        GROUP BY mc.id HAVING count(DISTINCT m.date_collecte::date) > 1) q`;

    expect(n).toBe(0);
  });

  it('pose et relevé encadrent exactement une nuit', async () => {
    await importerUneLigne('2026-03-15');

    const [{ n }] = await prisma.$queryRaw`
      SELECT count(*)::int AS n FROM methodes_collecte
      WHERE date_pose IS NOT NULL AND date_releve IS NOT NULL
        AND date_releve::date - date_pose::date <> 1`;

    expect(n).toBe(0);
  });
});
