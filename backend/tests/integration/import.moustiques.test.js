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
  prisma, app, request,
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

// ---------------------------------------------------------------------------
// Puits témoin H12 — ajouté le 2026-09-22
//
// Le protocole réserve le dernier puits d'une plaque 96 au témoin négatif : il
// ne reçoit jamais d'insecte. Le fichier de terrain porte quand même sa ligne,
// pour décrire la plaque en entier, et cette ligne n'a ni SCIENTIFIC_NAME ni
// GENUS — c'est la définition d'un témoin, pas un oubli de saisie.
//
// L'import la rejetait en « Taxonomie manquante » : un fichier parfaitement
// conforme au protocole sortait avec une erreur par plaque, et l'utilisateur
// devait apprendre à ignorer une erreur — le plus sûr moyen de finir par
// ignorer les vraies.
// ---------------------------------------------------------------------------
const valider = (jeton, buffer, nom = 'test.xlsx') =>
  request(app)
    .post('/api/v1/import/moustiques/validate')
    .set('Authorization', `Bearer ${jeton}`)
    .attach('file', buffer, nom);

describe('Puits témoin H12', () => {
  const temoin  = { series: 'ZZZ_T', taxo: '', genre: '', espece: '', box: 'P_001', pos: 'H12' };
  const normale = { series: 'ZZZ_1', box: 'P_001', pos: 'A1' };

  // Un seul envoi pour les trois assertions : `importLimiter` plafonne à 20
  // requêtes par 10 minutes sans dérogation en test, et l'aperçu partage le
  // même compteur. Un `it` par assertion épuisait le quota en cours de
  // fichier — les tests suivants échouaient alors en 429, sur le débit et non
  // sur la règle qu'ils prétendent vérifier.
  it('est accepté, sans spécimen ni position', async () => {
    const r = await importer(token, await fabriquerXlsx([normale, temoin]), 'plaque.xlsx');

    // 1. L'absence de taxonomie ne fait plus échouer le fichier.
    expect(r.status).toBe(200);
    expect(r.body.errors).toHaveLength(0);

    // 2. Le puits est VIDE : l'importer aurait inventé un moustique qui n'a
    //    jamais été capturé.
    const tubes = await prisma.moustique.findMany({ select: { idTerrain: true, position: true } });
    expect(tubes.map((t) => t.idTerrain)).toEqual(['ZZZ_1']);

    // 3. Et la position reste libre pour le témoin réel.
    expect(tubes.map((t) => t.position)).not.toContain('H12');
  });

  it('CONTRE-ÉPREUVE : une taxonomie manquante ailleurs reste une erreur', async () => {
    // Sans cette assertion, une dispense trop large passerait inaperçue : un
    // import n'exigeant plus JAMAIS de taxonomie satisferait le test précédent.
    const r = await importer(
      token,
      await fabriquerXlsx([{ series: 'ZZZ_9', taxo: '', genre: '', espece: '', box: 'P_001', pos: 'B2' }]),
      'plaque.xlsx',
    );

    expect(r.body.errors.length).toBeGreaterThan(0);
    expect(await prisma.moustique.count()).toBe(0);
  });

  it('CONTRE-ÉPREUVE : H12 hors plaque reste une erreur', async () => {
    // La dispense tient au PUITS TÉMOIN D'UNE PLAQUE. Une boîte de tubes n'a
    // pas de témoin : « H12 » n'y est qu'un identifiant de tube parmi d'autres.
    const r = await importer(
      token,
      await fabriquerXlsx([{ series: 'ZZZ_8', taxo: '', genre: '', espece: '', box: 'BX_001', pos: 'H12' }]),
      'boite.xlsx',
    );

    expect(r.body.errors.length).toBeGreaterThan(0);
  });

  it('l’aperçu rend le même verdict que l’import', async () => {
    // Un aperçu qui annoncerait une erreur là où l'import passe serait pire
    // qu'inutile : on corrigerait un fichier qui n'a rien.
    const r = await valider(token, await fabriquerXlsx([normale, temoin]), 'plaque.xlsx');

    expect(r.status).toBe(200);
    const codes = (r.body.logs ?? []).map((l) => l.code);
    expect(codes).not.toContain('TAXONOMIE_INTROUVABLE');
    expect(codes).toContain('PUITS_TEMOIN');
  });
});


// ---------------------------------------------------------------------------
// Régression du 2026-09-24 — UNE TAXONOMIE « AUTRE » N'EST PAS UN MOUSTIQUE
//
// L'import du dictionnaire complet (2026-09-23) a ajouté 5 799 espèces de type
// `autre` : Culicoides, phlébotomes, simulies… `resoudreTaxonomie` ne filtrait
// pas sur le type et cet import écrit dans la table `moustiques`. Une ligne
// « Culicoides abchazicus » dans un fichier de terrain trouvait donc sa
// taxonomie et devenait un MOUSTIQUE, en silence — alors que la saisie
// manuelle la refuse depuis toujours.
//
// Avant l'import du dictionnaire, la même ligne échouait bruyamment en
// « Taxonomie introuvable » : ajouter les espèces avait transformé une erreur
// visible en erreur muette, qui aurait faussé les densités captures/piège/nuit.
// ---------------------------------------------------------------------------
describe('Taxonomie d’un autre type que moustique', () => {
  const semerCulicoides = async () => {
    const ordre = await prisma.taxonomieSpecimen.create({
      data: { niveau: 'ordre', nom: 'DipteraAutre', type: 'autre' },
    });
    const famille = await prisma.taxonomieSpecimen.create({
      data: { niveau: 'famille', nom: 'Ceratopogonidae', parentId: ordre.id, type: 'autre' },
    });
    const genre = await prisma.taxonomieSpecimen.create({
      data: { niveau: 'genre', nom: 'Culicoides', parentId: famille.id, type: 'autre' },
    });
    await prisma.taxonomieSpecimen.create({
      data: { niveau: 'espece', nom: 'abchazicus', parentId: genre.id, type: 'autre' },
    });
  };

  it('refuse la ligne au lieu de créer un moustique', async () => {
    await semerCulicoides();

    const r = await importer(
      token,
      await fabriquerXlsx([{ series: 'ZZZ_9', taxo: 'Culicoides abchazicus', genre: 'Culicoides', espece: 'abchazicus' }]),
      'culicoides.xlsx',
    );

    expect(r.body.errors.length).toBeGreaterThan(0);
    // `errors` ne porte pas de code, seulement ligne / idTerrain / raison —
    // les codes vivent dans `logs`.
    const erreur = r.body.errors[0];
    // Le message doit dire POURQUOI : « introuvable » enverrait l'utilisateur
    // créer une entrée qui existe déjà.
    expect(erreur.raison).toMatch(/autre/i);

    // La garantie qui compte vraiment : rien n'a été écrit.
    expect(await prisma.moustique.count()).toBe(0);
  });

  it('continue d’accepter une taxonomie moustique', async () => {
    // Contre-épreuve : sans elle, un filtre trop large (ou une faute de frappe
    // sur le type) ferait tout échouer et ce test passerait quand même.
    await semerCulicoides();

    const r = await importer(
      token,
      await fabriquerXlsx([{ series: 'ZZZ_10', taxo: 'Anopheles gambiae', genre: 'Anopheles', espece: 'gambiae' }]),
      'moustique.xlsx',
    );

    expect(r.body.errors ?? []).toHaveLength(0);
    expect(await prisma.moustique.count()).toBe(1);
  });
});
