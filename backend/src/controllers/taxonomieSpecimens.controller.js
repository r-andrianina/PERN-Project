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

// GET /api/v1/dictionnaire/taxonomie-specimens?niveau=...&type=...&parentId=...&actif=true&search=...
const list = async (req, res) => {
  try {
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
  } catch (err) {
    console.error('Erreur list taxoSpecimens :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// GET /api/v1/dictionnaire/taxonomie-specimens/tree?type=moustique
const tree = async (req, res) => {
  try {
    const { type } = req.query;
    const where = { parentId: null };
    if (type) where.type = type;

    const buildSubtree = async (parentId) => {
      const enfants = await prisma.taxonomieSpecimen.findMany({
        where: { parentId },
        orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
      });
      return Promise.all(enfants.map(async (e) => ({
        ...e,
        enfants: await buildSubtree(e.id),
      })));
    };

    const racines = await prisma.taxonomieSpecimen.findMany({
      where,
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
    });

    const arbre = await Promise.all(racines.map(async (r) => ({
      ...r,
      enfants: await buildSubtree(r.id),
    })));

    return res.json({ tree: arbre });
  } catch (err) {
    console.error('Erreur tree taxoSpecimens :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// GET /api/v1/dictionnaire/taxonomie-specimens/:id
const getOne = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
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
  } catch (err) {
    console.error('Erreur getOne taxoSpecimens :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// POST /api/v1/dictionnaire/taxonomie-specimens
const create = async (req, res) => {
  const { niveau, nom, parentId, type, auteur, annee, nomCommun, description } = req.body;

  if (!niveau || !nom) return res.status(400).json({ error: 'niveau et nom obligatoires' });
  if (!NIVEAUX.includes(niveau)) return res.status(400).json({ error: `niveau invalide (${NIVEAUX.join(', ')})` });

  try {
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

    // Unicité (parentId + niveau + nom)
    const existing = await prisma.taxonomieSpecimen.findFirst({
      where: { niveau, nom: nom.trim(), parentId: parent?.id ?? null },
    });
    if (existing) return res.status(409).json({ error: `"${nom}" existe déjà à ce niveau sous ce parent` });

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
  } catch (err) {
    console.error('Erreur create taxoSpecimens :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// PUT /api/v1/dictionnaire/taxonomie-specimens/:id
const update = async (req, res) => {
  const id = parseInt(req.params.id);
  const { nom, parentId, type, auteur, annee, nomCommun, description } = req.body;

  try {
    const before = await prisma.taxonomieSpecimen.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Taxonomie introuvable' });

    const data = {};
    if (nom !== undefined)         data.nom         = nom.trim();
    if (auteur !== undefined)      data.auteur      = auteur || null;
    if (annee !== undefined)       data.annee       = annee ? parseInt(annee) : null;
    if (nomCommun !== undefined)   data.nomCommun   = nomCommun || null;
    if (description !== undefined) data.description = description || null;
    if (type !== undefined && before.niveau === 'ordre') data.type = type || null;

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
    }

    data.updatedById = req.user?.id ?? null;

    const item = await prisma.taxonomieSpecimen.update({
      where: { id },
      data,
      include: { parent: { select: { id: true, niveau: true, nom: true } } },
    });

    await logAudit({ req, action: ACTIONS.UPDATE, entity: ENTITY, entityId: id, oldValues: before, newValues: item });
    return res.json({ message: 'Taxonomie mise à jour', item });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Taxonomie introuvable' });
    console.error('Erreur update taxoSpecimens :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// DELETE /api/v1/dictionnaire/taxonomie-specimens/:id
const remove = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
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
  } catch (err) {
    console.error('Erreur delete taxoSpecimens :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// PATCH /api/v1/dictionnaire/taxonomie-specimens/:id/activer | /desactiver
const setActif = (actif) => async (req, res) => {
  const id = parseInt(req.params.id);
  try {
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
  } catch (err) {
    console.error('Erreur setActif taxoSpecimens :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = {
  list, tree, getOne, create, update, remove,
  activer: setActif(true), desactiver: setActif(false),
};
