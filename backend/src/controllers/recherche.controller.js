// backend/src/controllers/recherche.controller.js
// Recherche unifiée multi-critères des spécimens (Moustiques + Tiques + Puces).

const prisma  = require('../config/prisma');
const ExcelJS = require('exceljs');
const { BYPASS_ROLES } = require('../config/rbac');
const {
  resolveSpecimenDescendants,
  resolveHoteDescendants,
  buildSpecimenWhere,
  includeBase,
  includeWithHote,
} = require('../utils/specimenSearch');
const { libelleTaxonomie, decomposeTaxon } = require('../utils/taxonomyResolve');
const { chargerEquipes } = require('../utils/missionEquipe');
const { formatTrancheHoraire } = require('../utils/trancheHoraire');

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

// Retourne les types effectivement accessibles à l'utilisateur connecté
function resolveAllowedTypes(requestedTypes, user) {
  if (BYPASS_ROLES.includes(user?.role)) return requestedTypes;
  const autorises = user?.specimensAutorises || [];
  return requestedTypes.filter(t => autorises.includes(t));
}

// ============================================================
//  GET /api/v1/recherche/specimens
// ============================================================
const search = async (req, res) => {
  const types  = resolveAllowedTypes(parseTypes(req.query.types), req.user);
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
      // Décomposition calculée côté serveur : le frontend affiche Genre et
      // Espèce en deux colonnes et ne doit pas re-dériver la règle de remontée
      // du sous-genre (c'est cette duplication qui avait fait diverger les
      // libellés entre l'écran, l'export et la page de recherche).
      ...decomposeTaxon(s.taxonomie),
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
};

// ============================================================
//  GET /api/v1/recherche/specimens/export
//  Renvoie un .xlsx unifié des résultats filtrés
// ============================================================
const exportExcel = async (req, res) => {
  const types = resolveAllowedTypes(parseTypes(req.query.types), req.user);
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
    // Genre et espèce en colonnes distinctes plutôt qu'un libellé concaténé :
    // permet de trier, filtrer et faire un tableau croisé par genre sans
    // redécouper la chaîne dans Excel.
    { header: 'Genre',        key: 'genre',      width: 20 },
    { header: 'Espèce',       key: 'espece',     width: 20 },
    { header: 'Nombre',       key: 'nombre',     width: 8  },
    { header: 'Sexe',         key: 'sexe',       width: 10 },
    { header: 'Stade',        key: 'stade',      width: 10 },
    // Colonne "Parité (SOP)" supprimée le 2026-09-02 : la parité étant binaire
    // (Nulle/Pare), elle dupliquait strictement cette colonne en notation NP/P.
    { header: 'Parité',       key: 'parite',     width: 10 },
    // "Repas sang" (moustiques) et "Gorgée" (tiques) fusionnées le 2026-09-02 :
    // les deux champs partagent le même enum STATUT_SANGUIN et le même helper
    // d'affichage, et ne pouvaient jamais être remplies sur la même ligne. Deux
    // colonnes affirmaient une distinction que la donnée ne fait pas.
    { header: 'Statut sanguin', key: 'statutSanguin', width: 14 },
    // Champ moustique uniquement — vide pour les autres types, comme "Parité".
    // Même position que dans l'export moustiques, pour garder les deux alignés.
    { header: 'Organe prélevé', key: 'organePreleve', width: 15 },
    { header: 'Date collecte',key: 'date',       width: 14 },
    // Créneau horaire : moustiques uniquement, renseigné par les protocoles
    // horodatés (HLC). Chargé depuis l'enum, restitué en clair ("18h–19h").
    { header: 'Tranche horaire', key: 'trancheHoraire', width: 14 },
    // Le projet était chargé à chaque requête et n'était exporté nulle part :
    // le fichier donnait la mission sans dire à quel projet elle appartient.
    { header: 'Projet',       key: 'projet',     width: 22 },
    { header: 'Mission',      key: 'mission',    width: 14 },
    { header: 'Chef de mission', key: 'chefMission', width: 22 },
    // Agents rattachés à la MISSION, pas au spécimen : tous les spécimens d'une
    // même mission portent donc la même liste. Ce n'est pas « qui a capturé ce
    // spécimen », information que le modèle n'enregistre pas.
    { header: 'Agents',       key: 'agents',     width: 30 },
    { header: 'Localité',     key: 'localite',   width: 22 },
    { header: 'Région',       key: 'region',     width: 14 },
    { header: 'District',     key: 'district',   width: 14 },
    { header: 'Commune',      key: 'commune',    width: 14 },
    { header: 'Fokontany',    key: 'fokontany',  width: 18 },
    { header: 'Latitude',     key: 'lat',        width: 12 },
    { header: 'Longitude',    key: 'lng',        width: 12 },
    // Code d'instance (BG_1) et type (BIOGENTS_TRAP) séparés, comme Genre/Espèce :
    // permet de regrouper par type de piège sans redécouper la chaîne.
    { header: 'Méthode',      key: 'methode',    width: 14 },
    { header: 'Type de méthode', key: 'typeMethode', width: 22 },
    { header: 'Hôte',         key: 'hote',       width: 22 },
    { header: 'Solution',     key: 'solution',   width: 14 },
    { header: 'Container',    key: 'container',  width: 18 },
    { header: 'Position',     key: 'pos',        width: 12 },
    { header: 'Notes',        key: 'notes',      width: 30 },
  ];
  ws.getRow(1).font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D9E75' } };
  ws.getRow(1).alignment = { horizontal: 'center' };

  // Chef de mission + agents : une seule requête pour toutes les missions
  // représentées dans l'export. Les charger via l'include des spécimens aurait
  // dupliqué la même liste sur chaque ligne (des centaines de fois par mission).
  const equipes = await chargerEquipes(items.map((s) => s.methode?.localite?.mission?.id));

  items.forEach((s) => {
    const { genre, espece } = decomposeTaxon(s.taxonomie);
    const equipe = equipes.get(s.methode?.localite?.mission?.id) ?? {};
    ws.addRow({
      type:      s._type,
      id:        s.id,
      idTerrain: s.idTerrain || '',
      genre:     genre  ?? '',
      espece:    espece ?? '',
      nombre:    s.nombre,
      sexe:      s.sexe,
      stade:     s.stade,
      parite:    s.parite ?? '',
      // Un spécimen ne porte que l'un des deux champs selon son type — ils ne
      // peuvent donc pas se contredire (cf. commentaire de la colonne).
      statutSanguin: s.repasSang ?? s.gorge ?? '',
      organePreleve: s.organePreleve ?? '',
      date:      s.dateCollecte ? new Date(s.dateCollecte).toISOString().split('T')[0] : '',
      trancheHoraire: formatTrancheHoraire(s.trancheHoraire),
      projet:    s.methode?.localite?.mission?.projet?.nom
        ?? s.methode?.localite?.mission?.projet?.code ?? '',
      mission:   s.methode?.localite?.mission?.ordreMission ?? '',
      chefMission: equipe.chef   ?? '',
      agents:      equipe.agents ?? '',
      localite:  s.methode?.localite?.nom ?? '',
      region:    s.methode?.localite?.region ?? '',
      district:  s.methode?.localite?.district ?? '',
      commune:   s.methode?.localite?.commune ?? '',
      fokontany: s.methode?.localite?.fokontany ?? '',
      // Coordonnées du piège d'abord, celles de la localité en repli : c'est là
      // que le spécimen a réellement été capturé. L'export ne lisait que la
      // localité, si bien qu'un site géolocalisé au niveau du piège seulement
      // (cas de "Terrain Ambohimanoro") sortait sans coordonnées, alors que
      // l'application et la carte les affichaient.
      lat:       s.methode?.latitude  ?? s.methode?.localite?.latitude  ?? '',
      lng:       s.methode?.longitude ?? s.methode?.localite?.longitude ?? '',
      methode:   s.methode?.typeMethode?.code && s.methode?.numero != null
        ? `${s.methode.typeMethode.code}_${s.methode.numero}`
        : (s.methode?.typeMethode?.code ?? ''),
      typeMethode: s.methode?.typeMethode?.nom ?? '',
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
};

module.exports = { search, exportExcel };
