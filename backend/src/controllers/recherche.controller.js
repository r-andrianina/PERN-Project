// backend/src/controllers/recherche.controller.js
// Recherche unifiée multi-critères des spécimens (Moustiques + Tiques + Puces).

const prisma  = require('../config/prisma');
const ExcelJS = require('exceljs');
const {
  resolveSpecimenDescendants,
  resolveHoteDescendants,
  buildSpecimenWhere,
  includeBase,
  includeWithHote,
} = require('../utils/specimenSearch');
const { libelleTaxonomie } = require('../utils/taxonomyResolve');

const TYPES_VALIDES = ['moustique', 'tique', 'puce'];

const parseTypes = (raw) => {
  if (!raw) return TYPES_VALIDES;
  return raw.split(',').map((s) => s.trim()).filter((s) => TYPES_VALIDES.includes(s));
};

// Récupère les spécimens pour les types demandés en parallèle
async function fetchAllSpecimens(params, types) {
  const [descTaxos, descHotes] = await Promise.all([
    resolveSpecimenDescendants(params.taxonomieId),
    resolveHoteDescendants(params.taxonomieHoteId),
  ]);

  const promises = [];
  if (types.includes('moustique')) {
    promises.push(prisma.moustique.findMany({
      where:   buildSpecimenWhere({ type: 'moustique', params, descendantTaxonomieIds: descTaxos }),
      include: includeBase,
      orderBy: { dateCollecte: 'desc' },
    }).then((rows) => rows.map((r) => ({ ...r, _type: 'moustique' }))));
  }
  if (types.includes('tique')) {
    promises.push(prisma.tique.findMany({
      where:   buildSpecimenWhere({ type: 'tique', params, descendantTaxonomieIds: descTaxos, descendantHoteIds: descHotes }),
      include: includeWithHote,
      orderBy: { dateCollecte: 'desc' },
    }).then((rows) => rows.map((r) => ({ ...r, _type: 'tique' }))));
  }
  if (types.includes('puce')) {
    promises.push(prisma.puce.findMany({
      where:   buildSpecimenWhere({ type: 'puce', params, descendantTaxonomieIds: descTaxos, descendantHoteIds: descHotes }),
      include: includeWithHote,
      orderBy: { dateCollecte: 'desc' },
    }).then((rows) => rows.map((r) => ({ ...r, _type: 'puce' }))));
  }

  const results = await Promise.all(promises);
  return results.flat();
}

// Calcule les agrégats à partir d'une liste de spécimens
function computeStats(items) {
  const stats = {
    total:           items.length,
    totalIndividus:  items.reduce((s, x) => s + (x.nombre || 1), 0),
    parType:         { moustique: 0, tique: 0, puce: 0 },
    parSexe:         { M: 0, F: 0, inconnu: 0 },
    topEspeces:      [],
    topMissions:     [],
    periode:         { dateMin: null, dateMax: null },
  };

  const especeCounts  = new Map();
  const missionCounts = new Map();

  items.forEach((s) => {
    stats.parType[s._type] = (stats.parType[s._type] || 0) + 1;
    stats.parSexe[s.sexe || 'inconnu'] = (stats.parSexe[s.sexe || 'inconnu'] || 0) + 1;

    const lib = libelleTaxonomie(s.taxonomie);
    if (lib) especeCounts.set(lib, (especeCounts.get(lib) || 0) + (s.nombre || 1));

    const om = s.methode?.localite?.mission?.ordreMission;
    if (om) missionCounts.set(om, (missionCounts.get(om) || 0) + (s.nombre || 1));

    if (s.dateCollecte) {
      const d = new Date(s.dateCollecte).toISOString().split('T')[0];
      if (!stats.periode.dateMin || d < stats.periode.dateMin) stats.periode.dateMin = d;
      if (!stats.periode.dateMax || d > stats.periode.dateMax) stats.periode.dateMax = d;
    }
  });

  stats.topEspeces  = [...especeCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nom, count]) => ({ nom, count }));
  stats.topMissions = [...missionCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([ordreMission, count]) => ({ ordreMission, count }));

  return stats;
}

// ============================================================
//  GET /api/v1/recherche/specimens
// ============================================================
const search = async (req, res) => {
  try {
    const types  = parseTypes(req.query.types);
    const limit  = Math.min(parseInt(req.query.limit)  || 200, 1000);
    const offset = parseInt(req.query.offset) || 0;

    const items = await fetchAllSpecimens(req.query, types);

    // Tri global par date décroissante (createdAt si dateCollecte absent)
    items.sort((a, b) => {
      const da = a.dateCollecte ? new Date(a.dateCollecte) : new Date(a.createdAt);
      const db = b.dateCollecte ? new Date(b.dateCollecte) : new Date(b.createdAt);
      return db - da;
    });

    const stats     = computeStats(items);
    const paginated = items.slice(offset, offset + limit);

    return res.json({
      total:  items.length,
      count:  paginated.length,
      offset, limit,
      stats,
      items:  paginated.map((s) => ({
        _type:        s._type,
        id:           s.id,
        idTerrain:    s.idTerrain,
        taxonomie:    s.taxonomie,
        nombre:       s.nombre,
        sexe:         s.sexe,
        stade:        s.stade,
        parite:       s.parite,
        repasSang:    s.repasSang,
        gorge:        s.gorge,
        dateCollecte: s.dateCollecte,
        notes:        s.notes,
        position:     s.position,
        container:    s.container,
        solution:     s.solution,
        methode:      s.methode,
        hote:         s.hote ?? null,
      })),
    });
  } catch (err) {
    console.error('Erreur recherche.search :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ============================================================
//  GET /api/v1/recherche/specimens/export
//  Renvoie un .xlsx unifié des résultats filtrés
// ============================================================
const exportExcel = async (req, res) => {
  try {
    const types = parseTypes(req.query.types);
    const items = await fetchAllSpecimens(req.query, types);

    items.sort((a, b) => {
      const da = a.dateCollecte ? new Date(a.dateCollecte) : new Date(a.createdAt);
      const db = b.dateCollecte ? new Date(b.dateCollecte) : new Date(b.createdAt);
      return db - da;
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Recherche');

    ws.columns = [
      { header: 'Type',         key: 'type',       width: 12 },
      { header: 'ID',           key: 'id',         width: 8  },
      { header: 'ID terrain',   key: 'idTerrain',  width: 14 },
      { header: 'Taxonomie',    key: 'taxo',       width: 25 },
      { header: 'Nombre',       key: 'nombre',     width: 8  },
      { header: 'Sexe',         key: 'sexe',       width: 10 },
      { header: 'Stade',        key: 'stade',      width: 10 },
      { header: 'Parité',       key: 'parite',     width: 10 },
      { header: 'Repas sang',   key: 'repasSang',  width: 12 },
      { header: 'Gorgée',       key: 'gorge',      width: 10 },
      { header: 'Date collecte',key: 'date',       width: 14 },
      { header: 'Mission',      key: 'mission',    width: 14 },
      { header: 'Localité',     key: 'localite',   width: 22 },
      { header: 'Région',       key: 'region',     width: 14 },
      { header: 'Latitude',     key: 'lat',        width: 12 },
      { header: 'Longitude',    key: 'lng',        width: 12 },
      { header: 'Méthode',      key: 'methode',    width: 18 },
      { header: 'Hôte',         key: 'hote',       width: 22 },
      { header: 'Solution',     key: 'solution',   width: 14 },
      { header: 'Container',    key: 'container',  width: 18 },
      { header: 'Position',     key: 'pos',        width: 12 },
      { header: 'Notes',        key: 'notes',      width: 30 },
    ];
    ws.getRow(1).font      = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D9E75' } };
    ws.getRow(1).alignment = { horizontal: 'center' };

    items.forEach((s) => {
      ws.addRow({
        type:      s._type,
        id:        s.id,
        idTerrain: s.idTerrain || '',
        taxo:      libelleTaxonomie(s.taxonomie),
        nombre:    s.nombre,
        sexe:      s.sexe,
        stade:     s.stade,
        parite:    s.parite ?? '',
        repasSang: s._type === 'moustique' ? (s.repasSang ? 'Oui' : 'Non') : '',
        gorge:     s._type === 'tique'     ? (s.gorge     ? 'Oui' : 'Non') : '',
        date:      s.dateCollecte ? new Date(s.dateCollecte).toISOString().split('T')[0] : '',
        mission:   s.methode?.localite?.mission?.ordreMission ?? '',
        localite:  s.methode?.localite?.nom ?? '',
        region:    s.methode?.localite?.region ?? '',
        lat:       s.methode?.localite?.latitude ?? '',
        lng:       s.methode?.localite?.longitude ?? '',
        methode:   s.methode?.typeMethode?.nom ?? '',
        hote:      s.hote?.taxonomieHote?.nom ?? '',
        solution:  s.solution?.nom ?? '',
        container: s.container?.code ?? '',
        pos:       s.position ?? '',
        notes:     s.notes ?? '',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=recherche-specimens-${Date.now()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Erreur recherche.exportExcel :', err.message);
    return res.status(500).json({ error: "Erreur lors de l'export Excel" });
  }
};

module.exports = { search, exportExcel };
