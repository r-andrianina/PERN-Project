// backend/src/services/specimenFactory.js
//
// Fabrique du socle CRUD partagé par les 4 types de spécimens (moustiques,
// tiques, puces, autres-spécimens) — extrait du code quasi identique qui
// existait dans chacun des 4 contrôleurs (list/get/create/update/delete,
// cloisonnement projet, placement en container, génération d'idTerrain).
//
// Chaque type déclare son propre `specimenConfig` (voir en bas des 4
// contrôleurs) plutôt que de dupliquer cette logique — un correctif ici
// (ex: le cloisonnement projet du 2026-08) profite aux 4 types d'un coup.
//
// Les différences RÉELLES entre types (pas juste des noms de champs) sont
// préservées via la config, pas unifiées :
//   - moustique  : split autorisé sur BOITE et PLAQUE, taxonomie obligatoire + type vérifié
//   - tique/puce : split autorisé sur BOITE seulement, taxonomie obligatoire + type vérifié, ont un hoteId
//   - autre      : split sans restriction de type de container, taxonomie optionnelle
//                  et jamais vérifiée par type, a un typeSpecimenId (référentiel) + attributs (JSON)
//
// Service PUR : pas de req/res, pas de logAudit ici (convention du projet —
// voir CLAUDE.md "Services : logique métier pure, jamais de res/req"). Les
// contrôleurs générés par specimenControllerFactory.js appellent logAudit
// eux-mêmes avec req, à partir de ce que create/update/remove renvoient.

const prisma   = require('../config/prisma');
const AppError = require('../utils/AppError');
const { generateIdTerrain, generateMany, isIdTerrainUnique } = require('../utils/idTerrain');
const { validatePlacement, nextAvailablePositions } = require('../utils/container');
const { countSpecimenRefs } = require('../utils/specimenRefs');
const { getAccessibleProjetIds, canBypass, projetScopeWhere, assertProjetAccessible } = require('../utils/access');

/**
 * @param {object} config
 * @param {string}   config.model               nom de l'accesseur Prisma (ex: 'moustique')
 * @param {string}   config.entityLabel          nom pour logAudit/messages, capitalisé (ex: 'Moustique')
 * @param {string}   config.labelLower           nom en minuscule pour les messages (ex: 'moustique')
 * @param {string}   config.refsKey              clé attendue par countSpecimenRefs (ex: 'moustique', 'autre')
 * @param {object}   config.includeBase          objet `include` Prisma (propre à chaque type)
 * @param {function} config.searchClauses        (search: string) => tableau de clauses OR Prisma
 * @param {boolean}  config.taxonomieRequired     la taxonomie est-elle obligatoire à la création ?
 * @param {string|null} config.taxoType          si non-null, vérifie que taxonomie.type === taxoType
 * @param {boolean}  config.hasHoteId            le modèle a-t-il un champ hoteId ?
 * @param {boolean}  config.hasTypeSpecimen      le modèle a-t-il un typeSpecimenId (référentiel autres-spécimens) ?
 * @param {string[]|null} config.splitContainerTypes  types de container autorisant le mode split (null = tous)
 * @param {string[]} config.extraFields          champs spécifiques au type, copiés tels quels entre
 *   req.body et les data Prisma (create/update/split) — ex: ['repasSang','organePreleve','parite']
 * @param {function} config.deleteBlockedMessage (refs: {total,...}) => message d'erreur 409 exact
 *   (accord de genre différent selon le type — pas généralisable automatiquement ; le
 *   contrôleur appelant fournit une fonction qui utilise refsReason(refs) lui-même)
 */
function createSpecimenService(config) {
  const {
    model, entityLabel, labelLower, refsKey, includeBase, searchClauses,
    taxonomieRequired, taxoType, hasHoteId, hasTypeSpecimen,
    splitContainerTypes, extraFields, deleteBlockedMessage,
  } = config;

  const db = () => prisma[model];

  const buildWhere = ({ methodeId, missionId, taxonomieId, typeSpecimenId, sexe, search }) => {
    const where = {};
    if (methodeId)                         where.methodeId      = parseInt(methodeId);
    if (taxonomieId)                       where.taxonomieId    = parseInt(taxonomieId);
    if (hasTypeSpecimen && typeSpecimenId) where.typeSpecimenId = parseInt(typeSpecimenId);
    if (sexe)                              where.sexe           = sexe;
    if (missionId)                         where.methode        = { localite: { missionId: parseInt(missionId) } };
    if (search) where.OR = searchClauses(search);
    return where;
  };

  const applyProjectScope = async (where, user) => {
    if (!user || canBypass(user.role)) return where;
    const ids = await getAccessibleProjetIds(user.id, user.role);
    where.AND = [...(where.AND || []), projetScopeWhere(['methode', 'localite', 'mission'], ids)];
    return where;
  };

  const assertMethodeAccessible = async (methodeProjetId, user) => {
    if (!user || canBypass(user.role)) return;
    const ids = await getAccessibleProjetIds(user.id, user.role);
    assertProjetAccessible(methodeProjetId, ids);
  };

  const list = async (query, user) => {
    const { page, limit } = query;
    const pageNum  = Math.max(parseInt(page)  || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const where = await applyProjectScope(buildWhere(query), user);

    const [total, items] = await prisma.$transaction([
      db().count({ where }),
      db().findMany({ where, include: includeBase, orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * limitNum, take: limitNum }),
    ]);
    return { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum), items };
  };

  const getById = async (id, user) => {
    const item = await db().findUnique({ where: { id }, include: includeBase });
    if (!item) throw AppError.notFound(`${entityLabel} introuvable`);
    await assertMethodeAccessible(item.methode.localite.mission.projetId, user);
    return item;
  };

  // Champs communs à create/split, construits à partir de req.body.
  // Passthrough tel quel pour extraFields (pas de `?? null`) : certains champs
  // (repasSang, gorge) ont un @default() Prisma ("N") qui doit s'appliquer si
  // le champ est absent — Prisma ignore les clés `undefined` d'un objet data,
  // donc laisser `body[key]` tel quel (même undefined) préserve ce défaut.
  // Pour les champs sans @default, undefined-omis et null-explicite donnent
  // de toute façon le même résultat en base (NULL) — passthrough est donc
  // correct dans les deux cas, pas seulement pour repasSang/gorge.
  const buildBaseData = (body) => {
    const data = { sexe: body.sexe || 'inconnu', stade: body.stade || null };
    if (hasHoteId) data.hoteId = body.hoteId ? parseInt(body.hoteId) : null;
    for (const key of extraFields) data[key] = body[key];
    return data;
  };

  // Sous-ensemble de champs à journaliser dans l'audit (create/update) —
  // exposé pour que le contrôleur puisse appeler logAudit avec req.
  const pickAuditFields = (item, { includeNotesDate = false } = {}) => {
    const fields = { idTerrain: item.idTerrain, taxonomieId: item.taxonomieId, nombre: item.nombre, sexe: item.sexe, stade: item.stade, methodeId: item.methodeId };
    if (hasHoteId)       fields.hoteId = item.hoteId;
    if (hasTypeSpecimen) fields.typeSpecimenId = item.typeSpecimenId;
    for (const key of extraFields) fields[key] = item[key];
    if (includeNotesDate) { fields.solutionId = item.solutionId; fields.dateCollecte = item.dateCollecte; fields.notes = item.notes; }
    return fields;
  };

  const create = async (body, user) => {
    const { methodeId, taxonomieId, typeSpecimenId, idTerrain, nombre, containerId, position, dateCollecte, notes, insertMode } = body;

    if (!methodeId) throw AppError.badRequest('methodeId obligatoire');
    if (taxonomieRequired && !taxonomieId) throw AppError.badRequest('taxonomieId obligatoire (référentiel)');

    const methode = await prisma.methodeCollecte.findUnique({
      where: { id: parseInt(methodeId) },
      include: { localite: { select: { mission: { select: { projetId: true } } } } },
    });
    if (!methode) throw AppError.notFound('Méthode introuvable');
    await assertMethodeAccessible(methode.localite.mission.projetId, user);

    if (taxonomieId) {
      const taxo = await prisma.taxonomieSpecimen.findUnique({ where: { id: parseInt(taxonomieId) } });
      if (!taxo) throw AppError.notFound('Taxonomie introuvable');
      if (!taxo.actif) throw AppError.badRequest('Cette taxonomie est désactivée');
      if (taxoType && taxo.type && taxo.type !== taxoType) throw AppError.badRequest(`Taxonomie de type non-${labelLower}`);
    } else if (taxonomieRequired) {
      throw AppError.notFound('Taxonomie introuvable');
    }

    if (hasTypeSpecimen) {
      const typeSpec = await prisma.typeAutreSpecimen.findUnique({ where: { id: parseInt(typeSpecimenId) } });
      if (!typeSpec) throw AppError.notFound('Type de spécimen introuvable');
      if (!typeSpec.actif) throw AppError.badRequest('Ce type de spécimen est désactivé');
    }

    const nbInt = Math.max(parseInt(nombre) || 1, 1);
    const cId   = containerId ? parseInt(containerId) : null;
    let container = null;
    if (cId) {
      container = await prisma.container.findUnique({ where: { id: cId } });
      if (!container) throw AppError.notFound('Container introuvable');
    }

    const splitAllowed = cId && insertMode === 'split' && nbInt > 1
      && (splitContainerTypes === null || splitContainerTypes.includes(container.type));

    // ── MODE SPLIT — N enregistrements, 1 individu/position ──
    if (splitAllowed) {
      const positions = await nextAvailablePositions(cId, nbInt);
      const ids = await generateMany(parseInt(methodeId), nbInt);
      const baseData = {
        methodeId: parseInt(methodeId),
        taxonomieId: taxonomieId ? parseInt(taxonomieId) : null,
        ...(hasTypeSpecimen ? { typeSpecimenId: parseInt(typeSpecimenId) } : {}),
        ...buildBaseData(body),
        nombre: 1,
        solutionId: body.solutionId ? parseInt(body.solutionId) : null,
        containerId: cId,
        dateCollecte: dateCollecte ? new Date(dateCollecte) : null,
        notes: notes || null,
      };
      const data = positions.map((p, i) => ({ ...baseData, position: p, idTerrain: ids[i] }));
      const created = await db().createMany({ data });
      return {
        split: true,
        count: created.count,
        positions,
        message: `${created.count} ${labelLower}(s) enregistré(s) (1 individu / ${container.type === 'PLAQUE' ? 'puit' : 'tube'})`,
      };
    }

    // ── MODE SINGLE ──
    if (cId && container.type === 'PLAQUE' && nbInt > 1) {
      throw AppError.badRequest('Une plaque ne peut contenir qu\'un seul spécimen par puit (nombre forcé à 1)');
    }
    if (cId) {
      const err = await validatePlacement(cId, position);
      if (err) throw AppError.badRequest(err);
    }

    let finalIdTerrain = idTerrain ? idTerrain.trim() : null;
    if (finalIdTerrain) {
      const ok = await isIdTerrainUnique(finalIdTerrain);
      if (!ok) throw AppError.conflict(`L'ID "${finalIdTerrain}" est déjà utilisé`);
    } else {
      finalIdTerrain = await generateIdTerrain(parseInt(methodeId));
    }

    const item = await db().create({
      data: {
        idTerrain: finalIdTerrain,
        methodeId: parseInt(methodeId),
        taxonomieId: taxonomieId ? parseInt(taxonomieId) : null,
        ...(hasTypeSpecimen ? { typeSpecimenId: parseInt(typeSpecimenId) } : {}),
        ...buildBaseData(body),
        nombre: cId && container.type === 'PLAQUE' ? 1 : nbInt,
        solutionId: body.solutionId ? parseInt(body.solutionId) : null,
        containerId: cId,
        position: position || null,
        dateCollecte: dateCollecte ? new Date(dateCollecte) : null,
        notes: notes || null,
      },
      include: includeBase,
    });

    return { split: false, item };
  };

  const update = async (id, body, user) => {
    const { taxonomieId, typeSpecimenId, idTerrain, nombre, containerId, position, dateCollecte, notes } = body;

    const data = {};
    if (idTerrain !== undefined) {
      if (idTerrain) {
        const ok = await isIdTerrainUnique(idTerrain.trim(), model, id);
        if (!ok) throw AppError.conflict(`L'ID "${idTerrain}" est déjà utilisé`);
        data.idTerrain = idTerrain.trim();
      } else {
        data.idTerrain = null;
      }
    }
    if (taxonomieId !== undefined) data.taxonomieId = taxonomieId ? parseInt(taxonomieId) : null;
    if (hasTypeSpecimen && typeSpecimenId !== undefined) data.typeSpecimenId = parseInt(typeSpecimenId);
    if (nombre !== undefined) data.nombre = parseInt(nombre);
    if (body.sexe !== undefined) data.sexe = body.sexe;
    if (body.stade !== undefined) data.stade = body.stade;
    if (hasHoteId && body.hoteId !== undefined) data.hoteId = body.hoteId ? parseInt(body.hoteId) : null;
    for (const key of extraFields) if (body[key] !== undefined) data[key] = body[key];
    if (body.solutionId !== undefined) data.solutionId = body.solutionId ? parseInt(body.solutionId) : null;
    if (containerId !== undefined) data.containerId = containerId ? parseInt(containerId) : null;
    if (position !== undefined) data.position = position;
    if (dateCollecte !== undefined) data.dateCollecte = dateCollecte ? new Date(dateCollecte) : null;
    if (notes !== undefined) data.notes = notes;

    const before = await db().findUnique({ where: { id } });
    if (!before) throw AppError.notFound(`${entityLabel} introuvable`);

    const methode = await prisma.methodeCollecte.findUnique({
      where: { id: before.methodeId },
      select: { localite: { select: { mission: { select: { projetId: true } } } } },
    });
    await assertMethodeAccessible(methode.localite.mission.projetId, user);

    const item = await db().update({ where: { id }, data, include: includeBase });
    return { before, item };
  };

  const remove = async (id, user) => {
    const before = await db().findUnique({ where: { id } });
    if (!before) throw AppError.notFound(`${entityLabel} introuvable`);

    const methode = await prisma.methodeCollecte.findUnique({
      where: { id: before.methodeId },
      select: { localite: { select: { mission: { select: { projetId: true } } } } },
    });
    await assertMethodeAccessible(methode.localite.mission.projetId, user);

    // B6 — refuse la suppression tant que le spécimen est référencé en labo/pool.
    const refs = await countSpecimenRefs(refsKey, id);
    if (refs.total > 0) throw AppError.conflict(deleteBlockedMessage(refs));

    await db().delete({ where: { id } });
    return { before };
  };

  return { list, getById, create, update, remove, pickAuditFields };
}

module.exports = { createSpecimenService };
