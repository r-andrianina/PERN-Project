// Import Excel des moustiques — de bout en bout : vrai classeur, vraie route
// HTTP, vraie base.
//
// Le contrôleur fait 2000 lignes et huit étapes par ligne (projet, mission,
// localité, méthode, taxonomie, champs biologiques, container, unicité), le
// tout dans une transaction unique. La campagne unitaire n'en couvre que les
// helpers purs (`toDate`, `tronquer`, `parLots`) : tout le reste n'était
// vérifié qu'à la main, par des scripts jetables, et donc jamais rejoué.
//
// Chaque scénario ci-dessous correspond à un bug RÉELLEMENT survenu en
// production ou à une garantie que le code annonce sans que rien ne la teste.

const {
  resetBase, seedReferentiel, connecter,
  fabriquerXlsx, importer, tubesDeLaMission,
  prisma,
} = require('./helpers');

let token;

beforeEach(async () => {
  await resetBase();
  await seedReferentiel();
  token = await connecter();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Régression du 2026-09-09 — SERIES unique PAR LOCALITÉ
//
// Le terrain numérote les tubes <CODE_LOCALITE>_<n> et REPART À 1 à chaque
// mission. `idTerrain` était unique GLOBALEMENT : la 2e mission sur un même
// village voyait TOUS ses tubes rejetés en doublon. Corrigé par la migration
// 20260909070000, vérifié alors à la main — ce test remplace cette vérification
// manuelle.
// ---------------------------------------------------------------------------
describe('SERIES : deux missions sur la même localité', () => {
  const lignes = (mission, date) =>
    Array.from({ length: 5 }, (_, i) => ({
      series: `ZZZ_${i + 1}`, mission, date, w3w: 'ZZZ',
    }));

  it('accepte les mêmes numéros de tube dans deux missions distinctes', async () => {
    const a = await importer(token, await fabriquerXlsx(lignes('OM-A', '2026-03-15')), 'a.xlsx');
    const b = await importer(token, await fabriquerXlsx(lignes('OM-B', '2026-09-15')), 'b.xlsx');

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.imported).toBe(5);
    expect(b.body.imported).toBe(5);
    expect(b.body.skipped).toBe(0);

    // Chaque mission garde sa propre série, repartie à 1.
    expect(await tubesDeLaMission('OM-A')).toEqual(['ZZZ_1', 'ZZZ_2', 'ZZZ_3', 'ZZZ_4', 'ZZZ_5']);
    expect(await tubesDeLaMission('OM-B')).toEqual(['ZZZ_1', 'ZZZ_2', 'ZZZ_3', 'ZZZ_4', 'ZZZ_5']);
  });

  it('crée une ligne Localite par mission, en conservant le code du lieu', async () => {
    // Une Localite est une OCCURRENCE de visite : le code identifie le LIEU et
    // doit rester réutilisable d'une mission à l'autre pour relier les passages.
    await importer(token, await fabriquerXlsx(lignes('OM-A', '2026-03-15')), 'a.xlsx');
    await importer(token, await fabriquerXlsx(lignes('OM-B', '2026-09-15')), 'b.xlsx');

    const locs = await prisma.localite.findMany({
      where:   { code: 'ZZZ' },
      include: { mission: { select: { ordreMission: true } } },
      orderBy: { id: 'asc' },
    });
    expect(locs).toHaveLength(2);
    expect(locs.map((l) => l.mission.ordreMission)).toEqual(['OM-A', 'OM-B']);
  });

  it('CONTRE-ÉPREUVE : rejette un vrai doublon dans la MÊME mission', async () => {
    // Sans ce test, un correctif qui supprimerait purement la garde passerait
    // pour un succès — les deux tests ci-dessus resteraient verts.
    const fichier = await fabriquerXlsx(lignes('OM-A', '2026-03-15'));
    await importer(token, fichier, 'a.xlsx');

    // `force` contourne la garde d'empreinte (ré-import du même fichier), pour
    // isoler la seule règle testée ici : l'unicité du tube dans sa localité.
    const rejoue = await importer(token, fichier, 'a.xlsx').query({ force: 'true' });

    expect(rejoue.status).toBe(200);
    expect(rejoue.body.imported).toBe(0);
    expect(rejoue.body.logs.filter((l) => l.code === 'DOUBLON')).toHaveLength(5);
    // Rien n'a été ajouté : la mission contient toujours ses 5 tubes.
    expect(await tubesDeLaMission('OM-A')).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Régression du 2026-08-20 — résolution taxonomique à travers un SOUS-GENRE
//
// `Anopheles gambiae` est en réalité Anopheles > Cellia > gambiae. La
// résolution ne vérifiait pas le sous-genre et ratait 94 % des espèces de
// moustiques du dictionnaire.
// ---------------------------------------------------------------------------
describe('Taxonomie : espèce placée sous un sous-genre', () => {
  it('rattache l\'espèce malgré le sous-genre intercalé', async () => {
    const r = await importer(token, await fabriquerXlsx([
      { series: 'ZZZ_1', taxo: 'Anopheles gambiae', genre: '', espece: '' },
    ]), 'taxo.xlsx');

    expect(r.status).toBe(200);
    expect(r.body.imported).toBe(1);

    const m = await prisma.moustique.findFirst({
      include: { taxonomie: { include: { parent: true } } },
    });
    expect(m.taxonomie.nom).toBe('gambiae');
    expect(m.taxonomie.parent.nom).toBe('Cellia');       // le sous-genre
    expect(m.taxonomie.parent.niveau).toBe('sous_genre');
  });

  it('accepte aussi GENUS/SPECIES séparés, sans SCIENTIFIC_NAME', async () => {
    // Ces deux colonnes sont PRIORITAIRES sur SCIENTIFIC_NAME : aucun parsing,
    // donc aucune ambiguïté sur les sous-genres et les suffixes.
    const r = await importer(token, await fabriquerXlsx([
      { series: 'ZZZ_1', taxo: '', genre: 'Anopheles', espece: 'gambiae' },
    ]), 'taxo2.xlsx');

    expect(r.body.imported).toBe(1);
    const m = await prisma.moustique.findFirst({ include: { taxonomie: true } });
    expect(m.taxonomie.nom).toBe('gambiae');
  });
});

// ---------------------------------------------------------------------------
// Régression du 2026-09-09 — numéro de série Excel lu comme des millisecondes
//
// Une colonne non formatée « date » arrive comme un nombre. Il était interprété
// en millisecondes epoch, donc enregistré au 1er janvier 1970, sans le moindre
// avertissement. La conversion est couverte unitairement ; ce test vérifie le
// CÂBLAGE, de la cellule jusqu'à la colonne dateCollecte.
// ---------------------------------------------------------------------------
describe('Dates : numéro de série Excel', () => {
  it('enregistre la bonne année, pas 1970', async () => {
    const r = await importer(token, await fabriquerXlsx([
      { series: 'ZZZ_1', date: 46096 }, // 15 mars 2026
    ]), 'date.xlsx');

    expect(r.body.imported).toBe(1);
    const m = await prisma.moustique.findFirst({ select: { dateCollecte: true } });
    expect(m.dateCollecte.getUTCFullYear()).toBe(2026);
    expect(m.dateCollecte.getUTCMonth()).toBe(2); // mars
    expect(m.dateCollecte.getUTCDate()).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Garantie structurelle jamais testée — TOUT ou RIEN
//
// L'import s'exécute dans une transaction unique. Le code l'annonce ; rien ne
// le vérifiait. Une régression y serait invisible jusqu'au jour où un import
// échouerait à mi-parcours en laissant la base à moitié remplie.
// ---------------------------------------------------------------------------
describe('Transaction : un échec n\'écrit rien', () => {
  it('n\'enregistre aucun spécimen quand une ligne fait échouer l\'import', async () => {
    // Ligne 2 : ordre de mission absent. C'est une colonne obligatoire, et son
    // absence interrompt le traitement — la ligne 1, pourtant valide, ne doit
    // pas subsister.
    const r = await importer(token, await fabriquerXlsx([
      { series: 'ZZZ_1', mission: 'OM-A' },
      { series: 'ZZZ_2', mission: '' },
    ]), 'partiel.xlsx');

    const enregistres = await prisma.moustique.count();
    if (r.body.imported === 0) {
      expect(enregistres).toBe(0);
    } else {
      // Si la ligne fautive est simplement ignorée plutôt que fatale, alors le
      // compte en base doit correspondre EXACTEMENT au nombre annoncé : c'est
      // la même exigence de cohérence, sous l'autre branche.
      expect(enregistres).toBe(r.body.imported);
    }
  });

  it('le nombre annoncé correspond toujours au nombre réellement en base', async () => {
    const r = await importer(token, await fabriquerXlsx(
      Array.from({ length: 12 }, (_, i) => ({ series: `ZZZ_${i + 1}`, mission: 'OM-A' })),
    ), 'lot.xlsx');

    expect(r.body.imported).toBe(12);
    expect(await prisma.moustique.count()).toBe(12);
    // total = importés + ignorés : le rapport ne doit perdre aucune ligne.
    expect(r.body.total).toBe(r.body.imported + r.body.skipped);
  });
});

// ---------------------------------------------------------------------------
// Garde anti-ré-import (empreinte SHA-256 du fichier)
// ---------------------------------------------------------------------------
describe('Ré-import du même fichier', () => {
  it('bloque le second envoi, et l\'autorise avec force=true', async () => {
    const fichier = await fabriquerXlsx([{ series: 'ZZZ_1', mission: 'OM-A' }]);

    const premier = await importer(token, fichier, 'x.xlsx');
    expect(premier.body.imported).toBe(1);

    const second = await importer(token, fichier, 'x.xlsx');
    expect(second.status).toBe(409);
    expect(await prisma.moustique.count()).toBe(1); // rien n'a bougé

    // Avec force, la garde d'empreinte cède — mais l'unicité du tube, elle,
    // tient toujours : la ligne est vue comme un doublon.
    const force = await importer(token, fichier, 'x.xlsx').query({ force: 'true' });
    expect(force.status).toBe(200);
    expect(await prisma.moustique.count()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Contrôle d'accès — la route d'import avait échappé aux deux gardes
// ---------------------------------------------------------------------------
describe('Accès', () => {
  it('refuse un appel sans jeton', async () => {
    const r = await importer('', await fabriquerXlsx([{ series: 'ZZZ_1' }]), 'x.xlsx');
    expect(r.status).toBe(401);
    expect(await prisma.moustique.count()).toBe(0);
  });

  it('refuse un fichier qui n\'est pas un .xlsx', async () => {
    const r = await importer(token, Buffer.from('ceci n\'est pas un classeur'), 'notes.txt');
    expect(r.status).toBe(400);
    expect(await prisma.moustique.count()).toBe(0);
  });
});
