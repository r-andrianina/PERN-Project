// Liste des comptes — pagination À LA DEMANDE.
//
// Cette route sert deux besoins opposés, d'où deux formes de réponse :
//
//   sans `page` → forme historique { total, en_attente, actifs }. CINQ écrans
//     l'utilisent pour remplir une liste déroulante (ajout d'agents à une
//     mission, de membres à un projet) et ont besoin de TOUS les comptes
//     actifs. C'est la raison pour laquelle la pagination n'est pas devenue le
//     défaut : ces écrans auraient affiché les 25 premiers comptes sans que
//     rien ne signale les autres. Le premier test ci-dessous est donc un test
//     de NON-RÉGRESSION de ces cinq écrans, pas une commodité.
//
//   avec `page` → { items, total, page, pages, limit, compteurs, en_attente }.

const bcrypt = require('bcryptjs');
const { resetBase, seedReferentiel, connecter, MDP_TEST, prisma, app, request } = require('./helpers');

let jeton;

// 1 admin (du seed) + 6 comptes : 4 actifs, 2 en attente.
const COMPTES = [
  { prenom: 'Alice',   nom: 'Rakoto',     role: 'chercheur',   actif: true  },
  { prenom: 'Bob',     nom: 'Randria',    role: 'chercheur',   actif: true  },
  { prenom: 'Chantal', nom: 'Rasoa',      role: 'technicien',  actif: true  },
  { prenom: 'David',   nom: 'Ravelo',     role: 'superviseur', actif: true  },
  { prenom: 'Eva',     nom: 'Razafy',     role: 'lecteur',     actif: false },
  { prenom: 'Fidy',    nom: 'Rakotobe',   role: 'lecteur',     actif: false },
];

beforeEach(async () => {
  await resetBase();
  await seedReferentiel();
  jeton = await connecter();

  for (const c of COMPTES) {
    await prisma.user.create({
      data: {
        ...c,
        email: `${c.prenom.toLowerCase()}@test.local`,
        passwordHash: await bcrypt.hash(MDP_TEST, 10),
      },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

const lire = (params = '') =>
  request(app).get(`/api/v1/auth/users${params}`).set('Authorization', `Bearer ${jeton}`);

// ---------------------------------------------------------------------------
describe('Sans page — la forme historique, dont dépendent les sélecteurs', () => {
  it('renvoie TOUS les comptes, jamais une page', async () => {
    const r = await lire();

    expect(r.status).toBe(200);
    expect(r.body.items).toBeUndefined();
    expect(r.body.total).toBe(7);          // 6 + l'admin du seed
    expect(r.body.actifs).toHaveLength(5); // 4 + l'admin
    expect(r.body.en_attente).toHaveLength(2);
  });

  it('ignore une limite passée seule, sans page', async () => {
    // Un client qui enverrait `limit` sans `page` doit rester sur la forme
    // complète : c'est `page` qui bascule de forme, rien d'autre.
    const r = await lire('?limit=2');

    expect(r.body.items).toBeUndefined();
    expect(r.body.actifs).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
describe('Avec page — la forme paginée', () => {
  it('découpe en pages', async () => {
    const r = await lire('?page=1&limit=3');

    expect(r.body.items).toHaveLength(3);
    expect(r.body.total).toBe(7);
    expect(r.body.pages).toBe(3);
    expect(r.body.page).toBe(1);
    expect(r.body.limit).toBe(3);
  });

  it('renvoie le reste sur la dernière page', async () => {
    const r = await lire('?page=3&limit=3');

    expect(r.body.items).toHaveLength(1);
  });

  it('ne rend pas deux fois le même compte sur deux pages', async () => {
    const [p1, p2, p3] = await Promise.all([lire('?page=1&limit=3'), lire('?page=2&limit=3'), lire('?page=3&limit=3')]);
    const ids = [...p1.body.items, ...p2.body.items, ...p3.body.items].map((u) => u.id);

    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
  });

  it('ne divulgue aucune empreinte de mot de passe', async () => {
    const r = await lire('?page=1&limit=10');

    for (const u of r.body.items) expect(u.passwordHash).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe('Filtres, côté serveur', () => {
  it('cherche dans le nom, le prénom et l’email', async () => {
    const parPrenom = await lire('?page=1&search=Chantal');
    const parNom    = await lire('?page=1&search=Ravelo');
    const parEmail  = await lire('?page=1&search=eva@test');

    expect(parPrenom.body.items.map((u) => u.prenom)).toEqual(['Chantal']);
    expect(parNom.body.items.map((u) => u.nom)).toEqual(['Ravelo']);
    expect(parEmail.body.items.map((u) => u.prenom)).toEqual(['Eva']);
  });

  it('cherche sans tenir compte de la casse', async () => {
    const r = await lire('?page=1&search=rAkOtO');

    expect(r.body.items.map((u) => u.nom)).toContain('Rakoto');
  });

  it('filtre par statut', async () => {
    const attente = await lire('?page=1&statut=attente');
    const actifs  = await lire('?page=1&statut=actifs');

    expect(attente.body.total).toBe(2);
    expect(actifs.body.total).toBe(5);
  });

  it('filtre par rôle', async () => {
    const r = await lire('?page=1&role=chercheur');

    expect(r.body.total).toBe(2);
    expect(r.body.items.every((u) => u.role === 'chercheur')).toBe(true);
  });

  it('ignore un rôle inconnu au lieu de planter', async () => {
    // Transmis tel quel à Prisma, une valeur hors énumération lève — une faute
    // de frappe dans l'URL produirait un 500.
    const r = await lire('?page=1&role=roi');

    expect(r.status).toBe(200);
    expect(r.body.total).toBe(7);
  });
});

// ---------------------------------------------------------------------------
describe('Compteurs et file d’attente', () => {
  it('les compteurs portent sur toute la base, pas sur le filtre', async () => {
    // Ce sont les cartes de statistiques en tête de page : elles doivent rester
    // stables pendant qu'on tape dans la recherche.
    const r = await lire('?page=1&limit=2&search=Alice');

    expect(r.body.items).toHaveLength(1);
    expect(r.body.total).toBe(1);
    expect(r.body.compteurs).toMatchObject({
      total: 7, actifs: 5, enAttente: 2,
      admins: 1, superviseurs: 1, chercheurs: 2,
    });
  });

  it('la file d’attente reste complète, même paginée ou filtrée', async () => {
    // C'est une file d'action qu'un admin doit vider, pas un catalogue : la
    // tronquer cacherait des comptes à valider.
    const r = await lire('?page=2&limit=1&statut=actifs');

    expect(r.body.en_attente).toHaveLength(2);
    expect(r.body.en_attente.every((u) => u.actif === false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('Bornes', () => {
  it('ramène une page hors limites à une réponse vide, sans erreur', async () => {
    const r = await lire('?page=99&limit=10');

    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(0);
    expect(r.body.total).toBe(7);
  });

  it('borne la limite plutôt que de laisser vider la table', async () => {
    const r = await lire('?page=1&limit=99999');

    expect(r.status).toBe(200);
    expect(r.body.limit).toBe(200);
  });

  it('retombe sur des valeurs saines pour une page absurde', async () => {
    const r = await lire('?page=0&limit=-5');

    expect(r.status).toBe(200);
    expect(r.body.page).toBe(1);
    expect(r.body.limit).toBe(25);
  });
});
