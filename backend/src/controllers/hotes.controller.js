// backend/src/controllers/hotes.controller.js
// CRUD Hôtes — un hôte est rattaché à une méthode de collecte et à une TaxonomieHote.

const prisma = require('../config/prisma');

const includeBase = {
  methode: {
    select: {
      id: true,
      typeMethode: { select: { nom: true } },
      localite:    { select: { nom: true, region: true } },
    },
  },
  taxonomieHote: {
    include: { parent: { include: { parent: true } } },
  },
  _count: { select: { tiques: true, puces: true } },
};

const list = async (req, res) => {
  try {
    const { methodeId, taxonomieHoteId, sexe } = req.query;
    const where = {};
    if (methodeId)       where.methodeId       = parseInt(methodeId);
    if (taxonomieHoteId) where.taxonomieHoteId = parseInt(taxonomieHoteId);
    if (sexe)            where.sexe            = sexe;

    const hotes = await prisma.hote.findMany({
      where, include: includeBase, orderBy: { createdAt: 'desc' },
    });
    return res.json({ total: hotes.length, hotes });
  } catch (err) {
    console.error('Erreur list hotes :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const getOne = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const hote = await prisma.hote.findUnique({ where: { id }, include: includeBase });
    if (!hote) return res.status(404).json({ error: 'Hôte introuvable' });
    return res.json({ hote });
  } catch (err) {
    console.error('Erreur getOne hote :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const create = async (req, res) => {
  const {
    methodeId, taxonomieHoteId, especeLocale,
    age, sexe, etatSante, vaccination, notes,
  } = req.body;

  if (!methodeId)       return res.status(400).json({ error: 'methodeId obligatoire' });
  if (!taxonomieHoteId) return res.status(400).json({ error: 'taxonomieHoteId obligatoire' });

  try {
    const [methode, taxo] = await Promise.all([
      prisma.methodeCollecte.findUnique({ where: { id: parseInt(methodeId) } }),
      prisma.taxonomieHote.findUnique({ where: { id: parseInt(taxonomieHoteId) } }),
    ]);
    if (!methode) return res.status(404).json({ error: 'Méthode introuvable' });
    if (!taxo)    return res.status(404).json({ error: 'Taxonomie hôte introuvable' });
    if (!taxo.actif) return res.status(400).json({ error: 'Cette taxonomie hôte est désactivée' });

    const hote = await prisma.hote.create({
      data: {
        methodeId:       parseInt(methodeId),
        taxonomieHoteId: parseInt(taxonomieHoteId),
        especeLocale:    especeLocale || null,
        age:             age          || null,
        sexe:            sexe         || 'inconnu',
        etatSante:       etatSante    || null,
        vaccination:     vaccination  || null,
        notes:           notes        || null,
      },
      include: includeBase,
    });
    return res.status(201).json({ message: 'Hôte enregistré', hote });
  } catch (err) {
    console.error('Erreur create hote :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const update = async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    taxonomieHoteId, especeLocale, age, sexe, etatSante, vaccination, notes,
  } = req.body;

  const data = {};
  if (taxonomieHoteId !== undefined) data.taxonomieHoteId = parseInt(taxonomieHoteId);
  if (especeLocale    !== undefined) data.especeLocale    = especeLocale;
  if (age             !== undefined) data.age             = age;
  if (sexe            !== undefined) data.sexe            = sexe;
  if (etatSante       !== undefined) data.etatSante       = etatSante;
  if (vaccination     !== undefined) data.vaccination     = vaccination;
  if (notes           !== undefined) data.notes           = notes;

  try {
    const hote = await prisma.hote.update({ where: { id }, data, include: includeBase });
    return res.json({ message: 'Hôte mis à jour', hote });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Hôte introuvable' });
    console.error('Erreur update hote :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const remove = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const hote = await prisma.hote.findUnique({
      where: { id },
      include: { _count: { select: { tiques: true, puces: true } } },
    });
    if (!hote) return res.status(404).json({ error: 'Hôte introuvable' });

    const total = hote._count.tiques + hote._count.puces;
    if (total > 0) return res.status(409).json({ error: `Impossible — ${total} spécimen(s) liés.` });

    await prisma.hote.delete({ where: { id } });
    return res.json({ message: 'Hôte supprimé' });
  } catch (err) {
    console.error('Erreur delete hote :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = { list, getOne, create, update, remove };
