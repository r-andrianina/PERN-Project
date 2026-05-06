// backend/src/controllers/_referentielFactory.js
// Fabrique générique pour les référentiels "plats" (CRUD + actif + audit).
// Les référentiels hiérarchiques (taxonomies) ont leur propre contrôleur.

const prisma = require('../config/prisma');
const { logAudit, ACTIONS } = require('../utils/audit');

/**
 * @param {object} cfg
 * @param {string} cfg.entity     - nom Prisma de l'entité (ex: "TaxonomieHote") — pour audit
 * @param {string} cfg.delegate   - clé du modèle Prisma (ex: "solutionConservation")
 * @param {string[]} cfg.fields   - champs éditables (ex: ["nom","description","temperature"])
 * @param {string[]} [cfg.required]   - champs obligatoires à la création
 * @param {object}   [cfg.relationsCount] - { moustiques: true, ... } pour _count d'usage
 * @param {string}   [cfg.label]   - libellé pour les messages (ex: "Solution")
 * @param {string}   [cfg.uniqueField] - champ uniques (ex: "nom" ou "code")
 */
function createReferentielController(cfg) {
  const {
    entity, delegate, fields, required = [], relationsCount = {},
    label = 'Élément', uniqueField,
  } = cfg;

  const M = () => prisma[delegate];

  const buildData = (body, userId) => {
    const data = {};
    for (const f of fields) {
      if (body[f] !== undefined) {
        data[f] = body[f] === '' ? null : body[f];
      }
    }
    if (userId !== undefined) data.updatedById = userId;
    return data;
  };

  const list = async (req, res) => {
    try {
      const { actif, search } = req.query;
      const where = {};
      if (actif !== undefined) where.actif = actif === 'true';
      if (search) {
        const orFields = ['nom', 'code', 'description'].filter((f) => fields.includes(f) || f === 'nom');
        where.OR = orFields.map((f) => ({ [f]: { contains: search, mode: 'insensitive' } }));
      }
      const items = await M().findMany({
        where,
        include: Object.keys(relationsCount).length ? { _count: { select: relationsCount } } : undefined,
        orderBy: { nom: 'asc' },
      });
      return res.json({ total: items.length, items });
    } catch (err) {
      console.error(`Erreur list ${delegate} :`, err.message);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  };

  const getOne = async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const item = await M().findUnique({
        where: { id },
        include: Object.keys(relationsCount).length ? { _count: { select: relationsCount } } : undefined,
      });
      if (!item) return res.status(404).json({ error: `${label} introuvable` });
      return res.json({ item });
    } catch (err) {
      console.error(`Erreur getOne ${delegate} :`, err.message);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  };

  const create = async (req, res) => {
    for (const f of required) {
      if (!req.body[f]) return res.status(400).json({ error: `Le champ "${f}" est obligatoire` });
    }
    try {
      if (uniqueField && req.body[uniqueField]) {
        const dupe = await M().findFirst({ where: { [uniqueField]: req.body[uniqueField].trim() } });
        if (dupe) return res.status(409).json({ error: `${uniqueField} "${req.body[uniqueField]}" déjà utilisé` });
      }
      const data = buildData(req.body, req.user?.id);
      data.createdById = req.user?.id ?? null;
      // trim string fields
      for (const k of Object.keys(data)) {
        if (typeof data[k] === 'string') data[k] = data[k].trim();
      }
      const item = await M().create({ data });
      await logAudit({ req, action: ACTIONS.CREATE, entity, entityId: item.id, newValues: item });
      return res.status(201).json({ message: `${label} créé(e)`, item });
    } catch (err) {
      console.error(`Erreur create ${delegate} :`, err.message);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  };

  const update = async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const before = await M().findUnique({ where: { id } });
      if (!before) return res.status(404).json({ error: `${label} introuvable` });

      if (uniqueField && req.body[uniqueField] && req.body[uniqueField].trim() !== before[uniqueField]) {
        const dupe = await M().findFirst({ where: { [uniqueField]: req.body[uniqueField].trim() } });
        if (dupe) return res.status(409).json({ error: `${uniqueField} "${req.body[uniqueField]}" déjà utilisé` });
      }

      const data = buildData(req.body, req.user?.id);
      for (const k of Object.keys(data)) {
        if (typeof data[k] === 'string') data[k] = data[k].trim();
      }
      const item = await M().update({ where: { id }, data });
      await logAudit({ req, action: ACTIONS.UPDATE, entity, entityId: id, oldValues: before, newValues: item });
      return res.json({ message: `${label} mis(e) à jour`, item });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: `${label} introuvable` });
      console.error(`Erreur update ${delegate} :`, err.message);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  };

  const remove = async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const item = await M().findUnique({
        where: { id },
        include: Object.keys(relationsCount).length ? { _count: { select: relationsCount } } : undefined,
      });
      if (!item) return res.status(404).json({ error: `${label} introuvable` });

      const totalUsage = item._count
        ? Object.values(item._count).reduce((a, b) => a + b, 0)
        : 0;
      if (totalUsage > 0) {
        return res.status(409).json({ error: `Impossible : utilisé par ${totalUsage} enregistrement(s). Désactivez plutôt.` });
      }

      await M().delete({ where: { id } });
      await logAudit({ req, action: ACTIONS.DELETE, entity, entityId: id, oldValues: item });
      return res.json({ message: `${label} supprimé(e)` });
    } catch (err) {
      console.error(`Erreur delete ${delegate} :`, err.message);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  };

  const setActif = (actif) => async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const before = await M().findUnique({ where: { id } });
      if (!before) return res.status(404).json({ error: `${label} introuvable` });

      const item = await M().update({
        where: { id },
        data:  { actif, updatedById: req.user?.id ?? null },
      });
      await logAudit({
        req,
        action: actif ? ACTIONS.ACTIVATE : ACTIONS.DEACTIVATE,
        entity, entityId: id,
        oldValues: { actif: before.actif },
        newValues: { actif: item.actif },
      });
      return res.json({ message: `${label} ${actif ? 'activé(e)' : 'désactivé(e)'}`, item });
    } catch (err) {
      console.error(`Erreur setActif ${delegate} :`, err.message);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  };

  return {
    list, getOne, create, update, remove,
    activer: setActif(true), desactiver: setActif(false),
  };
}

module.exports = { createReferentielController };
