const prisma   = require('../config/prisma');
const AppError = require('../utils/AppError');
const { getAccessibleProjetIds, canBypass } = require('../utils/access');
const { statutMission } = require('../utils/missionStatut');

// Les quatre tables de spécimens portent toutes une `methodeId`, mais aucune
// relation ne les réunit : il faut les interroger une par une.
const MODELES_SPECIMENS = ['moustique', 'tique', 'puce', 'autreSpecimen'];

/**
 * Ajoute à chaque mission son `statut` dérivé, plus les deux compteurs dont il
 * découle (`methodes`, `methodesAvecSpecimens`) — affichés tels quels dans
 * l'interface, pour que l'utilisateur voie POURQUOI une mission est partielle.
 *
 * Coût : 1 requête pour les méthodes + 4 pour les types de spécimens, quel que
 * soit le nombre de missions. Un calcul par mission aurait multiplié par N.
 */
const avecStatut = async (missions) => {
  if (missions.length === 0) return missions;

  const methodes = await prisma.methodeCollecte.findMany({
    where:  { localite: { missionId: { in: missions.map((m) => m.id) } } },
    select: { id: true, localite: { select: { missionId: true } } },
  });

  // `distinct` plutôt que `groupBy` : on ne veut pas compter les spécimens,
  // seulement savoir si une méthode en a au moins un.
  const idsMethodes = methodes.map((x) => x.id);
  const avecSpecimens = new Set();
  if (idsMethodes.length > 0) {
    const listes = await Promise.all(MODELES_SPECIMENS.map((modele) =>
      prisma[modele].findMany({
        where:    { methodeId: { in: idsMethodes } },
        select:   { methodeId: true },
        distinct: ['methodeId'],
      })));
    listes.flat().forEach((s) => avecSpecimens.add(s.methodeId));
  }

  const compteurs = new Map(missions.map((m) => [m.id, { methodes: 0, methodesAvecSpecimens: 0 }]));
  for (const me of methodes) {
    const c = compteurs.get(me.localite.missionId);
    if (!c) continue;
    c.methodes += 1;
    if (avecSpecimens.has(me.id)) c.methodesAvecSpecimens += 1;
  }

  return missions.map((m) => {
    const c = compteurs.get(m.id) ?? { methodes: 0, methodesAvecSpecimens: 0 };
    return { ...m, ...c, statut: statutMission({ ...m, ...c }) };
  });
};

const PERSONNEL_SELECT = { id: true, nom: true, fonction: true, equipe: true, actif: true };

const INCLUDE_LIST = {
  projet:      { select: { id: true, code: true, nom: true } },
  chefMission: { select: PERSONNEL_SELECT },
  agents:      { include: { personnel: { select: PERSONNEL_SELECT } } },
  _count:      { select: { localites: true } },
};

const INCLUDE_DETAIL = {
  ...INCLUDE_LIST,
  projet:    { select: { id: true, code: true, nom: true, statut: true } },
  localites: {
    include: {
      methodes: {
        include: {
          typeMethode:       { select: { id: true, code: true, nom: true } },
          typeHabitat:       { select: { id: true, nom: true } },
          typeEnvironnement: { select: { id: true, nom: true } },
          _count:            { select: { moustiques: true, tiques: true, puces: true, autresSpecimens: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      contacts: { orderBy: { id: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  },
};

const list = async ({ projetId, search } = {}, user) => {
  const where = {};
  if (projetId) where.projetId = parseInt(projetId);
  if (search) {
    where.OR = [
      { ordreMission: { contains: search, mode: 'insensitive' } },
      { observations: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Si l'utilisateur n'est pas admin/superviseur et qu'aucun projetId précis n'est demandé,
  // on restreint aux missions des projets dont il est membre.
  if (user && !canBypass(user.role) && !projetId) {
    const ids = await getAccessibleProjetIds(user.id, user.role);
    if (ids !== null) where.projetId = { in: ids };
  }

  const missions = await prisma.mission.findMany({ where, include: INCLUDE_LIST, orderBy: { dateDebut: 'desc' } });
  return avecStatut(missions);
};

const getById = async (id, user) => {
  const mission = await prisma.mission.findUnique({ where: { id }, include: INCLUDE_DETAIL });
  if (!mission) throw AppError.notFound('Mission introuvable');
  if (user && !canBypass(user.role)) {
    const ids = await getAccessibleProjetIds(user.id, user.role);
    if (!ids.includes(mission.projetId)) throw AppError.forbidden('Accès refusé — vous n\'êtes pas membre de ce projet');
  }
  const [avec] = await avecStatut([mission]);
  return avec;
};

// Un id de fiche inconnu ferait échouer l'écriture sur la clé étrangère, en
// erreur Prisma brute ; on le refuse avant, avec un message lisible. Une fiche
// INACTIVE reste acceptée : une mission modifiée doit pouvoir garder un agent
// parti depuis — c'est le formulaire qui ne propose que les fiches actives.
async function verifierPersonnel(chefMissionId, agentIds) {
  const ids = [...new Set([
    ...(chefMissionId ? [parseInt(chefMissionId)] : []),
    ...(agentIds ?? []).map((i) => parseInt(i)),
  ])];
  if (!ids.length) return;
  const trouves = await prisma.personnel.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (trouves.length !== ids.length) {
    const connus = new Set(trouves.map((p) => p.id));
    const manquants = ids.filter((i) => !connus.has(i));
    throw AppError.badRequest(`Personne introuvable dans le dictionnaire (id ${manquants.join(', ')})`);
  }
}

const create = async (data) => {
  const { ordreMission, projetId, chefMissionId, dateDebut, dateFin, objet, observations, agentIds } = data;

  if (Array.isArray(agentIds) && agentIds.length > 20)
    throw AppError.badRequest('Maximum 20 agents de terrain par mission');
  await verifierPersonnel(chefMissionId, agentIds);

  const existing = await prisma.mission.findUnique({ where: { ordreMission } });
  if (existing) throw AppError.conflict(`L'ordre de mission "${ordreMission}" existe déjà`);

  const projet = await prisma.projet.findUnique({ where: { id: parseInt(projetId) } });
  if (!projet) throw AppError.notFound('Projet introuvable');

  // Le statut est ajouté ici aussi : sans lui, la mission renvoyée après
  // création n'aurait pas le même contenu que celle de la liste, et l'écran
  // afficherait un badge vide jusqu'au rechargement suivant.
  const creee = await prisma.mission.create({
    data: {
      ordreMission:  ordreMission.trim(),
      projetId:      parseInt(projetId),
      chefMissionId:  chefMissionId ? parseInt(chefMissionId) : null,
      dateDebut:      new Date(dateDebut),
      dateFin:       dateFin ? new Date(dateFin) : null,
      objet:         objet || null,
      observations:  observations || null,
      agents: agentIds?.length ? { create: agentIds.map(pid => ({ personnelId: parseInt(pid) })) } : undefined,
    },
    include: INCLUDE_LIST,
  });
  const [avec] = await avecStatut([creee]);
  return avec;
};

const update = async (id, data, user) => {
  const { chefMissionId, dateDebut, dateFin, objet, observations, agentIds } = data;

  if (Array.isArray(agentIds) && agentIds.length > 20)
    throw AppError.badRequest('Maximum 20 agents de terrain par mission');
  await verifierPersonnel(chefMissionId, agentIds);

  if (user && !canBypass(user.role)) {
    const current = await prisma.mission.findUnique({ where: { id }, select: { projetId: true } });
    if (!current) throw AppError.notFound('Mission introuvable');
    const ids = await getAccessibleProjetIds(user.id, user.role);
    if (!ids.includes(current.projetId)) throw AppError.forbidden('Accès refusé — vous n\'êtes pas membre de ce projet');
  }

  const patch = {};
  if (chefMissionId  !== undefined) patch.chefMissionId  = chefMissionId ? parseInt(chefMissionId) : null;
  if (dateDebut)                   patch.dateDebut     = new Date(dateDebut);
  if (dateFin !== undefined)       patch.dateFin       = dateFin ? new Date(dateFin) : null;
  if (objet !== undefined)         patch.objet         = objet || null;
  if (observations !== undefined)  patch.observations  = observations;

  // Le remplacement des agents (suppression puis recréation) et la mise à jour
  // de la mission doivent former un seul tout. Hors transaction, un échec de
  // l'update après le deleteMany — un id de fiche invalide suffit — laissait la
  // mission SANS AUCUN agent, sans rien pour les rétablir : modifier une
  // mission pouvait donc vider silencieusement sa liste d'agents.
  const modifiee = await prisma.$transaction(async (tx) => {
    if (agentIds !== undefined) {
      await tx.missionAgent.deleteMany({ where: { missionId: id } });
      if (agentIds.length > 0) patch.agents = { create: agentIds.map(pid => ({ personnelId: parseInt(pid) })) };
    }

    return tx.mission.update({
      where: { id }, data: patch,
      include: { ...INCLUDE_LIST, _count: { select: { localites: true } } },
    });
  });

  // Hors transaction : le recalcul ne lit que des compteurs et n'a aucune
  // raison de retenir la connexion pendant que les agents sont réécrits.
  const [avec] = await avecStatut([modifiee]);
  return avec;
};

const remove = async (id, user) => {
  const mission = await prisma.mission.findUnique({
    where: { id }, include: { _count: { select: { localites: true } } },
  });
  if (!mission) throw AppError.notFound('Mission introuvable');
  if (user && !canBypass(user.role)) {
    const ids = await getAccessibleProjetIds(user.id, user.role);
    if (!ids.includes(mission.projetId)) throw AppError.forbidden('Accès refusé — vous n\'êtes pas membre de ce projet');
  }
  if (mission._count.localites > 0)
    throw AppError.conflict(`Impossible — cette mission contient ${mission._count.localites} localité(s). Supprimez d'abord les localités.`);
  await prisma.mission.delete({ where: { id } });
};

module.exports = { list, getById, create, update, remove };
