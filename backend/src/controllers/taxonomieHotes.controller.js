// backend/src/controllers/taxonomieHotes.controller.js
// Référentiel hiérarchique des hôtes (mêmes niveaux que spécimens)

const prisma = require('../config/prisma');
const { logAudit, ACTIONS } = require('../utils/audit');

const ENTITY = 'TaxonomieHote';

const NIVEAUX = ['ordre', 'famille', 'sous_famille', 'genre', 'sous_genre', 'espece', 'sous_espece'];

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
  if (!parent) return `Le niveau "${niveau}" doit avoir un parent`;
  const allowed = [].concat(expected);
  if (!allowed.includes(parent.niveau)) {
    return `Parent invalide : "${parent.niveau}" non autorisé pour "${niveau}" (attendu : ${allowed.join(' ou ')})`;
  }
  return null;
};

const list = async (req, res) => {
  try {
    const { niveau, parentId, actif, search } = req.query;
    const where = {};
    if (niveau)              where.niveau   = niveau;
    if (parentId === 'null') where.parentId = null;
    else if (parentId)       where.parentId = parseInt(parentId);
    if (actif !== undefined) where.actif    = actif === 'true';
    if (search) {
      where.OR = [
        { nom:       { contains: search, mode: 'insensitive' } },
        { nomCommun: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.taxonomieHote.findMany({
      where,
      include: {
        parent: { select: { id: true, niveau: true, nom: true } },
        _count: { select: { enfants: true, hotes: true } },
      },
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
    });
    return res.json({ total: items.length, items });
  } catch (err) {
    console.error('Erreur list taxoHotes :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const tree = async (req, res) => {
  try {
    const buildSubtree = async (parentId) => {
      const enfants = await prisma.taxonomieHote.findMany({
        where: { parentId },
        orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
      });
      return Promise.all(enfants.map(async (e) => ({ ...e, enfants: await buildSubtree(e.id) })));
    };

    const racines = await prisma.taxonomieHote.findMany({
      where: { parentId: null },
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
    });
    const arbre = await Promise.all(racines.map(async (r) => ({ ...r, enfants: await buildSubtree(r.id) })));
    return res.json({ tree: arbre });
  } catch (err) {
    console.error('Erreur tree taxoHotes :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const getOne = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const item = await prisma.taxonomieHote.findUnique({
      where: { id },
      include: {
        parent:  { select: { id: true, niveau: true, nom: true } },
        enfants: { orderBy: [{ niveau: 'asc' }, { nom: 'asc' }] },
        _count:  { select: { hotes: true } },
      },
    });
    if (!item) return res.status(404).json({ error: 'Taxonomie hôte introuvable' });
    return res.json({ item });
  } catch (err) {
    console.error('Erreur getOne taxoHotes :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const create = async (req, res) => {
  const { niveau, nom, parentId, nomCommun, description } = req.body;
  if (!niveau || !nom) return res.status(400).json({ error: 'niveau et nom obligatoires' });
  if (!NIVEAUX.includes(niveau)) return res.status(400).json({ error: `niveau invalide (${NIVEAUX.join(', ')})` });

  try {
    let parent = null;
    if (parentId) {
      parent = await prisma.taxonomieHote.findUnique({ where: { id: parseInt(parentId) } });
      if (!parent) return res.status(404).json({ error: 'Parent introuvable' });
    }
    const erreur = validateHierarchy(niveau, parent);
    if (erreur) return res.status(400).json({ error: erreur });

    const existing = await prisma.taxonomieHote.findFirst({
      where: { niveau, nom: nom.trim(), parentId: parent?.id ?? null },
    });
    if (existing) return res.status(409).json({ error: `"${nom}" existe déjà à ce niveau sous ce parent` });

    const item = await prisma.taxonomieHote.create({
      data: {
        niveau,
        nom:         nom.trim(),
        parentId:    parent?.id ?? null,
        nomCommun:   nomCommun || null,
        description: description || null,
        createdById: req.user?.id ?? null,
        updatedById: req.user?.id ?? null,
      },
      include: { parent: { select: { id: true, niveau: true, nom: true } } },
    });

    await logAudit({ req, action: ACTIONS.CREATE, entity: ENTITY, entityId: item.id, newValues: item });
    return res.status(201).json({ message: 'Taxonomie hôte créée', item });
  } catch (err) {
    console.error('Erreur create taxoHotes :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const update = async (req, res) => {
  const id = parseInt(req.params.id);
  const { nom, parentId, nomCommun, description } = req.body;
  try {
    const before = await prisma.taxonomieHote.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Taxonomie hôte introuvable' });

    const data = {};
    if (nom !== undefined)         data.nom         = nom.trim();
    if (nomCommun !== undefined)   data.nomCommun   = nomCommun || null;
    if (description !== undefined) data.description = description || null;

    if (parentId !== undefined) {
      let parent = null;
      if (parentId !== null && parentId !== '') {
        parent = await prisma.taxonomieHote.findUnique({ where: { id: parseInt(parentId) } });
        if (!parent) return res.status(404).json({ error: 'Parent introuvable' });
        if (parent.id === id) return res.status(400).json({ error: 'Une taxonomie ne peut être son propre parent' });
      }
      const erreur = validateHierarchy(before.niveau, parent);
      if (erreur) return res.status(400).json({ error: erreur });
      data.parentId = parent?.id ?? null;
    }

    data.updatedById = req.user?.id ?? null;

    const item = await prisma.taxonomieHote.update({
      where: { id },
      data,
      include: { parent: { select: { id: true, niveau: true, nom: true } } },
    });

    await logAudit({ req, action: ACTIONS.UPDATE, entity: ENTITY, entityId: id, oldValues: before, newValues: item });
    return res.json({ message: 'Taxonomie hôte mise à jour', item });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Taxonomie introuvable' });
    console.error('Erreur update taxoHotes :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const remove = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const item = await prisma.taxonomieHote.findUnique({
      where: { id },
      include: { _count: { select: { enfants: true, hotes: true } } },
    });
    if (!item) return res.status(404).json({ error: 'Taxonomie hôte introuvable' });

    if (item._count.enfants > 0) return res.status(409).json({ error: `Impossible : ${item._count.enfants} enfant(s) liés.` });
    if (item._count.hotes > 0)   return res.status(409).json({ error: `Impossible : utilisée par ${item._count.hotes} hôte(s). Désactivez plutôt.` });

    await prisma.taxonomieHote.delete({ where: { id } });
    await logAudit({ req, action: ACTIONS.DELETE, entity: ENTITY, entityId: id, oldValues: item });
    return res.json({ message: 'Taxonomie hôte supprimée' });
  } catch (err) {
    console.error('Erreur delete taxoHotes :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const setActif = (actif) => async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const before = await prisma.taxonomieHote.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Taxonomie hôte introuvable' });

    const item = await prisma.taxonomieHote.update({
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
    console.error('Erreur setActif taxoHotes :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = {
  list, tree, getOne, create, update, remove,
  activer: setActif(true), desactiver: setActif(false),
};
