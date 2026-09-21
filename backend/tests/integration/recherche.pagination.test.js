// Pagination de la recherche.
//
// Avant le 2026-09-17, `offset`/`limit` étaient appliqués EN MÉMOIRE : les trois
// tables étaient chargées en entier avec leurs jointures, triées en JS, puis
// découpées. Mesuré sur la base de dev : 247 ms et 1,5 Mo pour 746 moustiques,
// sur UN type — la recherche en interroge trois.
//
// Deux propriétés sont testées ici, et la seconde est un CORRECTIF :
//
//   1. La page renvoyée est la bonne, agrégats compris — ceux-ci portent sur
//      tout le résultat filtré, pas sur la page.
//
//   2. Deux pages consécutives ne se recouvrent pas et ne sautent personne.
//      Le tri n'avait AUCUN départage : la base de dev compte 746 moustiques
//      pour 17 dates distinctes, donc l'ordre entre ex aequo dépendait de
//      l'ordre de lignes rendu par PostgreSQL — que rien ne garantit d'une
//      requête à l'autre. Un spécimen pouvait apparaître sur deux pages et un
//      autre sur aucune.

const { resetBase, seedReferentiel, connecter, prisma, app, request } = require('./helpers');

let jeton;
let ref;

// 30 moustiques sur 3 dates seulement : les ex aequo sont la règle, pas
// l'exception — c'est exactement la situation qui rendait la pagination
// instable.
const TOTAL = 30;
const DATES = ['2026-09-01', '2026-09-02', '2026-09-03'];

beforeEach(async () => {
  await resetBase();
  ref = await seedReferentiel();
  jeton = await connecter();

  const projet  = await prisma.projet.create({ data: { code: 'PROJ-P', nom: 'PROJ-P' } });
  const mission = await prisma.mission.create({
    data: { ordreMission: 'OM-P', projetId: projet.id, dateDebut: new Date('2026-09-01') },
  });
  const loc = await prisma.localite.create({ data: { missionId: mission.id, nom: 'Pagiville' } });

  for (let i = 0; i < TOTAL; i++) {
    const jour = DATES[i % DATES.length];
    const methode = await prisma.methodeCollecte.create({
      data: {
        localiteId: loc.id, typeMethodeId: ref.cdc.id, numero: i + 1,
        datePose: new Date(`${jour}T00:00:00Z`), dateReleve: new Date(`${jour}T00:00:00Z`),
      },
    });
    await prisma.moustique.create({
      data: {
        idTerrain: `PAG_${String(i + 1).padStart(2, '0')}`,
        methodeId: methode.id, localiteId: loc.id, taxonomieId: ref.espece.id,
        nombre: 2, sexe: i % 2 === 0 ? 'F' : 'M',
        dateCollecte: new Date(`${jour}T00:00:00Z`),
      },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

const chercher = (params = '') =>
  request(app).get(`/api/v1/recherche/specimens${params}`).set('Authorization', `Bearer ${jeton}`);

// ---------------------------------------------------------------------------
describe('Découpage', () => {
  it('renvoie le nombre demandé, et le total du jeu complet', async () => {
    const r = await chercher('?limit=10&offset=0');

    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(10);
    expect(r.body.count).toBe(10);
    expect(r.body.total).toBe(TOTAL);   // le total ignore la page
  });

  it('renvoie le reste sur la dernière page', async () => {
    const r = await chercher('?limit=10&offset=25');

    expect(r.body.items).toHaveLength(5);
    expect(r.body.total).toBe(TOTAL);
  });

  it('renvoie une page vide au-delà du dernier résultat', async () => {
    const r = await chercher('?limit=10&offset=999');

    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(0);
    expect(r.body.total).toBe(TOTAL);
  });
});

// ---------------------------------------------------------------------------
describe('Stabilité entre pages', () => {
  it('trois pages consécutives couvrent tout, sans doublon ni oubli', async () => {
    // C'est la propriété qu'on veut — mais ce test seul ne suffit PAS à la
    // garantir : en retirant le départage par identifiant, il continue de
    // passer. PostgreSQL rend alors le même ordre aux trois appels, par chance
    // et non par contrat. Le test qui détecte réellement la régression est
    // « découpe de la même façon quelle que soit la taille de page » ci-dessous,
    // parce que faire varier `take` change l'ordre rendu. Vérifié par mutation.
    const pages = await Promise.all([0, 10, 20].map((o) => chercher(`?limit=10&offset=${o}`)));
    const ids = pages.flatMap((p) => p.body.items.map((s) => `${s._type}-${s.id}`));

    expect(ids).toHaveLength(TOTAL);
    expect(new Set(ids).size).toBe(TOTAL);
  });

  it('donne le même ordre à deux appels identiques', async () => {
    const [a, b] = await Promise.all([chercher('?limit=30'), chercher('?limit=30')]);

    expect(a.body.items.map((s) => s.id)).toEqual(b.body.items.map((s) => s.id));
  });

  it('découpe de la même façon quelle que soit la taille de page', async () => {
    // Les 12 premiers en une fois doivent être les 12 premiers obtenus en
    // deux pages de 6 : sinon la pagination dépend de la façon de la demander.
    //
    // C'est LE test qui protège le départage par identifiant : faire varier
    // `take` change l'ordre que PostgreSQL rend entre ex aequo, ce qu'un tri
    // sans départage laisse passer dans le résultat. Le retirer fait tomber
    // ce test, et lui seul.
    const enUneFois = await chercher('?limit=12');
    const [p1, p2]  = await Promise.all([chercher('?limit=6&offset=0'), chercher('?limit=6&offset=6')]);

    expect([...p1.body.items, ...p2.body.items].map((s) => s.id))
      .toEqual(enUneFois.body.items.map((s) => s.id));
  });

  it('trie du plus récent au plus ancien', async () => {
    const r = await chercher('?limit=30');
    const dates = r.body.items.map((s) => new Date(s.dateCollecte).getTime());

    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });
});

// ---------------------------------------------------------------------------
describe('Les agrégats portent sur tout le résultat, pas sur la page', () => {
  it('compte les individus du jeu complet même avec une page de 5', async () => {
    const r = await chercher('?limit=5');

    expect(r.body.items).toHaveLength(5);
    expect(r.body.stats.total).toBe(TOTAL);
    expect(r.body.stats.totalIndividus).toBe(TOTAL * 2); // nombre = 2 par ligne
  });

  it('donne la même répartition par sexe quelle que soit la page', async () => {
    const [p1, p3] = await Promise.all([chercher('?limit=10&offset=0'), chercher('?limit=10&offset=20')]);

    expect(p1.body.stats.parSexe).toEqual(p3.body.stats.parSexe);
    expect(p1.body.stats.parSexe.F).toBe(15);
    expect(p1.body.stats.parSexe.M).toBe(15);
  });

  it('couvre toute la période, pas celle de la page', async () => {
    const r = await chercher('?limit=1');

    expect(r.body.stats.periode.dateMin).toBe('2026-09-01');
    expect(r.body.stats.periode.dateMax).toBe('2026-09-03');
  });

  it('agrège le top espèces sur le jeu complet', async () => {
    const r = await chercher('?limit=3');

    expect(r.body.stats.topEspeces[0]).toMatchObject({ count: TOTAL * 2 });
  });

  it('agrège le top missions sur le jeu complet', async () => {
    const r = await chercher('?limit=3');

    expect(r.body.stats.topMissions[0]).toMatchObject({ ordreMission: 'OM-P', count: TOTAL * 2 });
  });
});

// ---------------------------------------------------------------------------
describe('Filtres et pagination ensemble', () => {
  it('le total reflète le filtre, pas la base', async () => {
    const r = await chercher('?sexe=F&limit=5');

    expect(r.body.total).toBe(15);
    expect(r.body.items).toHaveLength(5);
    expect(r.body.items.every((s) => s.sexe === 'F')).toBe(true);
  });

  it('les agrégats aussi reflètent le filtre', async () => {
    const r = await chercher('?sexe=F&limit=5');

    expect(r.body.stats.total).toBe(15);
    expect(r.body.stats.totalIndividus).toBe(30);
    expect(r.body.stats.parSexe.M).toBe(0);
  });

  it('pagine correctement un jeu filtré', async () => {
    const pages = await Promise.all([0, 5, 10].map((o) => chercher(`?sexe=F&limit=5&offset=${o}`)));
    const ids = pages.flatMap((p) => p.body.items.map((s) => s.id));

    expect(ids).toHaveLength(15);
    expect(new Set(ids).size).toBe(15);
  });
});
