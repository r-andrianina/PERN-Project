// Gardes « self » de la gestion des comptes.
//
// Ces trois protections empêchent un admin de se verrouiller hors de sa propre
// application. Ce n'est jamais une escalade de privilèges — on ne peut que
// descendre, et seulement en étant déjà admin — mais le dernier admin qui perd
// ses droits laisse l'institut sans administration, et la récupération passe
// par un accès direct à la base.
//
// Le trou corrigé le 2026-09-16 : `PATCH /users/:id/activate` accepte aussi un
// rôle, et ne gardait que le cas `actif: false`. Un admin pouvait donc se
// rétrograder par cette route, alors que `PUT /users/:id` l'interdit
// explicitement. L'interface désactive bien le sélecteur de rôle sur sa propre
// ligne — mais c'était la SEULE protection, et un invariant de ce genre
// n'appartient pas au client.

const bcrypt = require('bcryptjs');
const { resetBase, seedReferentiel, connecter, MDP_TEST, prisma, app, request } = require('./helpers');

let jeton;
let moi;

beforeEach(async () => {
  await resetBase();
  const ref = await seedReferentiel();
  moi   = ref.admin;
  jeton = await connecter();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const patch = (url, corps) =>
  request(app).patch(url).set('Authorization', `Bearer ${jeton}`).send(corps);

const roleEnBase = async (id) =>
  (await prisma.user.findUnique({ where: { id }, select: { role: true } })).role;

// ---------------------------------------------------------------------------
describe('Un admin ne peut pas se rétrograder', () => {
  it('refuse le changement de rôle par /activate', async () => {
    const r = await patch(`/api/v1/auth/users/${moi.id}/activate`, { role: 'lecteur' });

    expect(r.status).toBe(400);
    expect(await roleEnBase(moi.id)).toBe('admin');
  });

  it('refuse aussi par /users/:id, la route jumelle', async () => {
    const r = await request(app)
      .put(`/api/v1/auth/users/${moi.id}`)
      .set('Authorization', `Bearer ${jeton}`)
      .send({ role: 'lecteur' });

    expect(r.status).toBe(400);
    expect(await roleEnBase(moi.id)).toBe('admin');
  });

  it('refuse le rôle glissé à côté d’un changement de statut', async () => {
    // La forme la plus discrète : `actif: true` est légitime et passe la
    // première garde, le rôle voyage avec.
    const r = await patch(`/api/v1/auth/users/${moi.id}/activate`, { actif: true, role: 'technicien' });

    expect(r.status).toBe(400);
    expect(await roleEnBase(moi.id)).toBe('admin');
  });

  it('laisse passer un envoi de son rôle ACTUEL', async () => {
    // Renvoyer la valeur inchangée n'est pas une rétrogradation : un formulaire
    // qui réémet tout son état ne doit pas être refusé.
    const r = await patch(`/api/v1/auth/users/${moi.id}/activate`, { role: 'admin' });

    expect(r.status).toBe(200);
    expect(await roleEnBase(moi.id)).toBe('admin');
  });
});

// ---------------------------------------------------------------------------
describe('CONTRE-ÉPREUVE : la gestion des autres comptes marche toujours', () => {
  let autre;

  beforeEach(async () => {
    autre = await prisma.user.create({
      data: {
        nom: 'Test', prenom: 'Autre',
        email: 'autre@test.local',
        passwordHash: await bcrypt.hash(MDP_TEST, 10),
        role: 'technicien', actif: true,
      },
    });
  });

  it('un admin peut changer le rôle de quelqu’un d’autre', async () => {
    const r = await patch(`/api/v1/auth/users/${autre.id}/activate`, { role: 'chercheur' });

    expect(r.status).toBe(200);
    expect(await roleEnBase(autre.id)).toBe('chercheur');
  });

  it('un admin peut désactiver quelqu’un d’autre', async () => {
    const r = await patch(`/api/v1/auth/users/${autre.id}/activate`, { actif: false });

    expect(r.status).toBe(200);
    const u = await prisma.user.findUnique({ where: { id: autre.id }, select: { actif: true } });
    expect(u.actif).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('Les deux autres gardes « self »', () => {
  it('refuse la désactivation de son propre compte', async () => {
    const r = await patch(`/api/v1/auth/users/${moi.id}/activate`, { actif: false });

    expect(r.status).toBe(400);
    const u = await prisma.user.findUnique({ where: { id: moi.id }, select: { actif: true } });
    expect(u.actif).toBe(true);
  });

  it('refuse la suppression de son propre compte', async () => {
    const r = await request(app)
      .delete(`/api/v1/auth/users/${moi.id}`)
      .set('Authorization', `Bearer ${jeton}`);

    expect(r.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { id: moi.id } })).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('Inscription libre', () => {
  it('ne laisse pas choisir son rôle ni s’activer', async () => {
    // Le rôle est codé en dur côté contrôleur ET absent du schéma Zod : un
    // champ `role` envoyé ici doit être ignoré, pas honoré.
    const r = await request(app).post('/api/v1/auth/register').send({
      nom: 'Test', prenom: 'Intrus',
      email: 'intrus@test.local',
      password: MDP_TEST,
      role: 'admin', actif: true,
    });

    expect(r.status).toBe(201);
    const cree = await prisma.user.findUnique({
      where: { email: 'intrus@test.local' }, select: { role: true, actif: true },
    });
    expect(cree.role).toBe('lecteur');
    expect(cree.actif).toBe(false);
  });
});
