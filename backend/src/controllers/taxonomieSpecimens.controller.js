// backend/src/controllers/taxonomieSpecimens.controller.js
// Référentiel hiérarchique : ordre → famille → sous_famille → genre → sous_genre → espece → sous_espece

const prisma = require('../config/prisma');
const { logAudit, ACTIONS } = require('../utils/audit');

const ENTITY = 'TaxonomieSpecimen';

const NIVEAUX = ['ordre', 'famille', 'sous_famille', 'genre', 'sous_genre', 'espece', 'sous_espece'];

// Pour chaque niveau, le niveau parent autorisé (null = racine).
const PARENT_LEVEL = {
  ordre:        null,
  famille:      'ordre',
  sous_famille: 'famille',
  genre:        ['famille', 'sous_famille'],
  sous_genre:   'genre',
  espece:       ['genre', 'sous_genre'],
  sous_espece:  'espece',
};

const validateHierarchy = (niveau, parent) => {
  const expected = PARENT_LEVEL[niveau];
  if (expected === null) {
    if (parent) return `Le niveau "${niveau}" ne peut pas avoir de parent`;
    return null;
  }
  if (!parent) return `Le niveau "${niveau}" doit avoir un parent (${[].concat(expected).join(' ou ')})`;
  const allowed = [].concat(expected);
  if (!allowed.includes(parent.niveau)) {
    return `Parent invalide : niveau "${parent.niveau}" non autorisé pour "${niveau}" (attendu : ${allowed.join(' ou ')})`;
  }
  return null;
};

// Niveaux où un nom doit être unique sur tout l'arbre (même type), pas
// seulement sous le même parent — un genre (ou toute unité au-dessus de
// l'espèce) ne doit exister qu'à un seul endroit. Sans ce garde-fou, deux
// branches distinctes peuvent porter le même nom de genre (ex: "Anopheles"
// à la fois directement sous la famille et sous une sous-famille) et se
// retrouver avec des espèces éclatées entre les deux, invisibles l'une de
// l'autre — incident réel corrigé en 2026-07 (10 genres dupliqués fusionnés).
// espece/sous_espece restent volontairement uniques par parent seulement :
// un même épithète spécifique peut légitimement se répéter d'un genre à
// l'autre (nomenclature binomiale).
const GLOBAL_UNIQUE_LEVELS = ['ordre', 'famille', 'sous_famille', 'genre', 'sous_genre'];

// Cherche un doublon existant ; renvoie le message d'erreur ou null.
const checkDuplicate = async ({ niveau, nom, parentId, type, excludeId }) => {
  const where = GLOBAL_UNIQUE_LEVELS.includes(niveau)
    ? { niveau, nom: { equals: nom.trim(), mode: 'insensitive' }, type }
    : { niveau, nom: nom.trim(), parentId };
  if (excludeId) where.id = { not: excludeId };

  const existing = await prisma.taxonomieSpecimen.findFirst({
    where, include: { parent: { select: { niveau: true, nom: true } } },
  });
  if (!existing) return null;

  if (GLOBAL_UNIQUE_LEVELS.includes(niveau)) {
    const location = existing.parent ? `sous ${existing.parent.niveau} "${existing.parent.nom}"` : 'à la racine';
    return `"${nom}" existe déjà à ce niveau ${location} — un nom de ${niveau} doit être unique sur tout l'arbre`;
  }
  return `"${nom}" existe déjà à ce niveau sous ce parent`;
};

// GET /api/v1/dictionnaire/taxonomie-specimens?niveau=...&type=...&parentId=...&actif=true&search=...
const list = async (req, res) => {
  const { niveau, type, parentId, actif, search } = req.query;
  const where = {};
  if (niveau)               where.niveau   = niveau;
  if (type)                 where.type     = type;
  if (parentId === 'null')  where.parentId = null;
  else if (parentId)        where.parentId = parseInt(parentId);
  if (actif !== undefined)  where.actif    = actif === 'true';
  if (search)               where.nom      = { contains: search, mode: 'insensitive' };

  const items = await prisma.taxonomieSpecimen.findMany({
    where,
    include: {
      parent:  { select: { id: true, niveau: true, nom: true } },
      _count:  { select: { enfants: true, moustiques: true, tiques: true, puces: true } },
    },
    orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
  });

  return res.json({ total: items.length, items });
};

// GET /api/v1/dictionnaire/taxonomie-specimens/tree?type=moustique
const tree = async (req, res) => {
  const { type } = req.query;
  const where = {};
  if (type) where.type = type;

  // Un seul aller-retour BD — plus de N+1 récursif qui épuise le pool
  const all = await prisma.taxonomieSpecimen.findMany({
    where,
    orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
  });

  const byId = {};
  all.forEach((n) => { byId[n.id] = { ...n, enfants: [] }; });
  const roots = [];
  all.forEach((n) => {
    if (n.parentId === null) roots.push(byId[n.id]);
    else if (byId[n.parentId]) byId[n.parentId].enfants.push(byId[n.id]);
  });

  return res.json({ tree: roots });
};

// GET /api/v1/dictionnaire/taxonomie-specimens/:id
const getOne = async (req, res) => {
  const id = parseInt(req.params.id);
  const item = await prisma.taxonomieSpecimen.findUnique({
    where: { id },
    include: {
      parent:  { select: { id: true, niveau: true, nom: true, parent: { select: { id: true, niveau: true, nom: true } } } },
      enfants: { orderBy: [{ niveau: 'asc' }, { nom: 'asc' }] },
      _count:  { select: { moustiques: true, tiques: true, puces: true } },
    },
  });
  if (!item) return res.status(404).json({ error: 'Taxonomie introuvable' });
  return res.json({ item });
};

// POST /api/v1/dictionnaire/taxonomie-specimens
const create = async (req, res) => {
  const { niveau, nom, parentId, type, auteur, annee, nomCommun, description } = req.body;

  if (!niveau || !nom) return res.status(400).json({ error: 'niveau et nom obligatoires' });
  if (!NIVEAUX.includes(niveau)) return res.status(400).json({ error: `niveau invalide (${NIVEAUX.join(', ')})` });

  let parent = null;
  if (parentId) {
    parent = await prisma.taxonomieSpecimen.findUnique({ where: { id: parseInt(parentId) } });
    if (!parent) return res.status(404).json({ error: 'Parent introuvable' });
  }
  const erreur = validateHierarchy(niveau, parent);
  if (erreur) return res.status(400).json({ error: erreur });

  // Le type se propage du parent (si présent)
  const typeFinal = niveau === 'ordre' ? (type ?? null) : (parent?.type ?? type ?? null);
  if (niveau === 'ordre' && !typeFinal) {
    return res.status(400).json({ error: 'type obligatoire au niveau ordre (moustique, tique ou puce)' });
  }

  const dupError = await checkDuplicate({ niveau, nom, parentId: parent?.id ?? null, type: typeFinal });
  if (dupError) return res.status(409).json({ error: dupError });

  const item = await prisma.taxonomieSpecimen.create({
    data: {
      niveau,
      nom:         nom.trim(),
      parentId:    parent?.id ?? null,
      type:        typeFinal,
      auteur:      auteur || null,
      annee:       annee ? parseInt(annee) : null,
      nomCommun:   nomCommun || null,
      description: description || null,
      createdById: req.user?.id ?? null,
      updatedById: req.user?.id ?? null,
    },
    include: { parent: { select: { id: true, niveau: true, nom: true } } },
  });

  await logAudit({ req, action: ACTIONS.CREATE, entity: ENTITY, entityId: item.id, newValues: item });
  return res.status(201).json({ message: 'Taxonomie créée', item });
};

// PUT /api/v1/dictionnaire/taxonomie-specimens/:id
const update = async (req, res) => {
  const id = parseInt(req.params.id);
  const { nom, parentId, type, auteur, annee, nomCommun, description } = req.body;

  const before = await prisma.taxonomieSpecimen.findUnique({ where: { id } });
  if (!before) return res.status(404).json({ error: 'Taxonomie introuvable' });

  const data = {};
  if (nom !== undefined)         data.nom         = nom.trim();
  if (auteur !== undefined)      data.auteur      = auteur || null;
  if (annee !== undefined)       data.annee       = annee ? parseInt(annee) : null;
  if (nomCommun !== undefined)   data.nomCommun   = nomCommun || null;
  if (description !== undefined) data.description = description || null;
  if (type !== undefined && before.niveau === 'ordre') data.type = type || null;

  let effectiveParentId = before.parentId;
  if (parentId !== undefined) {
    let parent = null;
    if (parentId !== null && parentId !== '') {
      parent = await prisma.taxonomieSpecimen.findUnique({ where: { id: parseInt(parentId) } });
      if (!parent) return res.status(404).json({ error: 'Parent introuvable' });
      if (parent.id === id) return res.status(400).json({ error: 'Une taxonomie ne peut être son propre parent' });
    }
    const erreur = validateHierarchy(before.niveau, parent);
    if (erreur) return res.status(400).json({ error: erreur });
    data.parentId = parent?.id ?? null;
    effectiveParentId = data.parentId;
  }

  const dupError = await checkDuplicate({
    niveau:   before.niveau,
    nom:      data.nom ?? before.nom,
    parentId: effectiveParentId,
    type:     data.type ?? before.type,
    excludeId: id,
  });
  if (dupError) return res.status(409).json({ error: dupError });

  data.updatedById = req.user?.id ?? null;

  const item = await prisma.taxonomieSpecimen.update({
    where: { id },
    data,
    include: { parent: { select: { id: true, niveau: true, nom: true } } },
  });

  await logAudit({ req, action: ACTIONS.UPDATE, entity: ENTITY, entityId: id, oldValues: before, newValues: item });
  return res.json({ message: 'Taxonomie mise à jour', item });
};

// DELETE /api/v1/dictionnaire/taxonomie-specimens/:id
const remove = async (req, res) => {
  const id = parseInt(req.params.id);
  const item = await prisma.taxonomieSpecimen.findUnique({
    where: { id },
    include: { _count: { select: { enfants: true, moustiques: true, tiques: true, puces: true } } },
  });
  if (!item) return res.status(404).json({ error: 'Taxonomie introuvable' });

  if (item._count.enfants > 0) {
    return res.status(409).json({ error: `Impossible : ${item._count.enfants} enfant(s) liés. Supprimez-les d'abord.` });
  }
  const total = item._count.moustiques + item._count.tiques + item._count.puces;
  if (total > 0) {
    return res.status(409).json({ error: `Impossible : utilisée par ${total} spécimen(s). Désactivez plutôt.` });
  }

  await prisma.taxonomieSpecimen.delete({ where: { id } });
  await logAudit({ req, action: ACTIONS.DELETE, entity: ENTITY, entityId: id, oldValues: item });
  return res.json({ message: 'Taxonomie supprimée' });
};

// PATCH /api/v1/dictionnaire/taxonomie-specimens/:id/activer | /desactiver
const setActif = (actif) => async (req, res) => {
  const id = parseInt(req.params.id);
  const before = await prisma.taxonomieSpecimen.findUnique({ where: { id } });
  if (!before) return res.status(404).json({ error: 'Taxonomie introuvable' });

  const item = await prisma.taxonomieSpecimen.update({
    where: { id },
    data:  { actif, updatedById: req.user?.id ?? null },
  });

  await logAudit({
    req,
    action: actif ? ACTIONS.ACTIVATE : ACTIONS.DEACTIVATE,
    entity: ENTITY,
    entityId: id,
    oldValues: { actif: before.actif },
    newValues: { actif: item.actif },
  });
  return res.json({ message: `Taxonomie ${actif ? 'activée' : 'désactivée'}`, item });
};

module.exports = {
  list, tree, getOne, create, update, remove,
  activer: setActif(true), desactiver: setActif(false),
};
