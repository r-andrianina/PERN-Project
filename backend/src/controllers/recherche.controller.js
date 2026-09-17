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
const { libelleTaxonomie, decomposeTaxon, TAXONOMIE_INCLUDE } = require('../utils/taxonomyResolve');
const { chargerEquipes } = require('../utils/missionEquipe');
const { formatTrancheHoraire } = require('../utils/trancheHoraire');
const { getAccessibleProjetIds, projetScopeWhere } = require('../utils/access');

const TYPES_VALIDES = ['moustique', 'tique', 'puce'];

const parseTypes = (raw) => {
  if (!raw) return TYPES_VALIDES;
  return raw.split(',').map((s) => s.trim()).filter((s) => TYPES_VALIDES.includes(s));
};

// Récupère les spécimens pour les types demandés en parallèle.
//
// Cloisonnement par projet (2026-09-16) : la recherche ne filtrait que par TYPE
// de spécimen. Un chercheur affecté à un seul projet pouvait retrouver — et
// exporter — n'importe quel spécimen de l'institut.
//
// `projetIds` est un paramètre OBLIGATOIRE, pas une option avec un défaut
// permissif : un appelant qui l'oublie doit produire une liste vide, jamais la
// base entière. Les deux points d'appel (liste et export Excel) le passent.
async function fetchAllSpecimens(params, types, projetIds) {
  const scope = projetScopeWhere(['localite', 'mission'], projetIds);
  const [descTaxos, descHotes] = await Promise.all([
    resolveSpecimenDescendants(params.taxonomieId),
    resolveHoteDescendants(params.taxonomieHoteId),
  ]);

  const promises = [];
  if (types.includes('moustique')) {
    promises.push(prisma.moustique.findMany({
      where:   { ...buildSpecimenWhere({ type: 'moustique', params, descendantTaxonomieIds: descTaxos }), ...scope },
      include: includeBase,
      orderBy: { dateCollecte: 'desc' },
    }).then((rows) => rows.map((r) => ({ ...r, _type: 'moustique' }))));
  }
  if (types.includes('tique')) {
    promises.push(prisma.tique.findMany({
      where:   { ...buildSpecimenWhere({ type: 'tique', params, descendantTaxonomieIds: descTaxos, descendantHoteIds: descHotes }), ...scope },
      include: includeWithHote,
      orderBy: { dateCollecte: 'desc' },
    }).then((rows) => rows.map((r) => ({ ...r, _type: 'tique' }))));
  }
  if (types.includes('puce')) {
    promises.push(prisma.puce.findMany({
      where:   { ...buildSpecimenWhere({ type: 'puce', params, descendantTaxonomieIds: descTaxos, descendantHoteIds: descHotes }), ...scope },
      include: includeWithHote,
      orderBy: { dateCollecte: 'desc' },
    }).then((rows) => rows.map((r) => ({ ...r, _type: 'puce' }))));
  }

  const results = await Promise.all(promises);
  return results.flat();
}

// ============================================================
//  PAGINATION RÉELLE (2026-09-17)
// ============================================================
//
// Avant : les trois tables étaient chargées EN ENTIER avec toutes leurs
// jointures, triées en JS, puis découpées — `offset`/`limit` ne servaient qu'à
// la fin. Mesuré sur la base de dev : 247 ms et 1,5 Mo pour 746 moustiques, et
// ça montait linéairement (≈16 s et 99 Mo à 50 000, pour UN type sur trois).
//
// Maintenant, deux passages :
//   1. par type, les (offset + limit) lignes les plus récentes, en ne
//      sélectionnant que l'identifiant et la date — aucune jointure. Le tri et
//      la coupe sont faits par PostgreSQL, qui s'appuie sur l'index
//      `*_date_collecte_idx`.
//   2. seules les lignes de la page demandée sont rechargées avec leurs
//      jointures.
//
// Pourquoi (offset + limit) par type suffit : les N lignes globalement les plus
// récentes sont forcément incluses dans l'union des N plus récentes de chaque
// table. C'est la fusion de listes triées.
//
// L'EXPORT garde `fetchAllSpecimens` : un export doit tout renvoyer.

const MODELES = { moustique: 'moustique', tique: 'tique', puce: 'puce' };
const includePour = (type) => (type === 'moustique' ? includeBase : includeWithHote);

/**
 * Ordre de parcours des résultats — repris à l'identique par PostgreSQL
 * (`orderBy` ci-dessous) et par la fusion en JS. Les deux DOIVENT coïncider,
 * sinon la propriété « les N plus récentes sont dans l'union des N par table »
 * tombe et la page devient fausse.
 *
 * Changement assumé : le tri portait sur `dateCollecte ?? createdAt`, un
 * COALESCE que PostgreSQL ne peut pas satisfaire depuis un index. Les lignes
 * sans date de collecte passent donc désormais à la FIN au lieu d'être
 * intercalées selon leur date de création. Elles sont aujourd'hui au nombre de
 * zéro : depuis le modèle nuit-piège, `dateCollecte` dérive du relevé de la
 * méthode et est toujours renseignée.
 *
 * Départage par identifiant : il n'y en avait AUCUN, et c'était un vrai défaut.
 * La base de dev compte 746 moustiques pour 17 dates distinctes — l'ordre entre
 * ex aequo dépendait donc de l'ordre de lignes rendu par PostgreSQL, qui n'est
 * garanti d'une requête à l'autre par rien. Deux pages consécutives pouvaient
 * répéter un spécimen et en omettre un autre.
 */
const ORDRE_SQL = [{ dateCollecte: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }];

const comparerSpecimens = (a, b) => {
  const da = a.dateCollecte ? new Date(a.dateCollecte).getTime() : null;
  const db = b.dateCollecte ? new Date(b.dateCollecte).getTime() : null;
  if (da !== db) {
    if (da === null) return 1;   // nulls last
    if (db === null) return -1;
    return db - da;
  }
  if (a.id !== b.id) return b.id - a.id;
  return a._type < b._type ? -1 : a._type > b._type ? 1 : 0;
};

/** Le `where` Prisma d'un type, filtres métier + cloisonnement projet. */
function whereDuType(type, params, descTaxos, descHotes, scope) {
  return {
    ...buildSpecimenWhere({
      type, params,
      descendantTaxonomieIds: descTaxos,
      descendantHoteIds:      descHotes,
    }),
    ...scope,
  };
}

/** Une page de résultats, jointures chargées pour cette page seulement. */
async function chargerPage(params, types, projetIds, offset, limit) {
  const [descTaxos, descHotes] = await Promise.all([
    resolveSpecimenDescendants(params.taxonomieId),
    resolveHoteDescendants(params.taxonomieHoteId),
  ]);
  const scope  = projetScopeWhere(['localite', 'mission'], projetIds);
  const besoin = offset + limit;

  const listes = await Promise.all(types.map((type) =>
    prisma[MODELES[type]].findMany({
      where:   whereDuType(type, params, descTaxos, descHotes, scope),
      select:  { id: true, dateCollecte: true },
      orderBy: ORDRE_SQL,
      take:    besoin,
    }).then((rows) => rows.map((r) => ({ ...r, _type: type })))));

  const page = listes.flat().sort(comparerSpecimens).slice(offset, offset + limit);
  if (page.length === 0) return [];

  // Rechargement avec jointures, un appel par type présent dans la page.
  const idsParType = new Map();
  for (const r of page) {
    if (!idsParType.has(r._type)) idsParType.set(r._type, []);
    idsParType.get(r._type).push(r.id);
  }

  const complets = new Map();
  await Promise.all([...idsParType].map(([type, ids]) =>
    prisma[MODELES[type]].findMany({ where: { id: { in: ids } }, include: includePour(type) })
      .then((rows) => rows.forEach((r) => complets.set(`${type}-${r.id}`, { ...r, _type: type })))));

  // L'ordre de `page` fait foi : `findMany({ id: { in } })` ne le préserve pas.
  return page.map((r) => complets.get(`${r._type}-${r.id}`)).filter(Boolean);
}

/**
 * Agrégats sur TOUT le résultat filtré, calculés par la base.
 *
 * Ils ne peuvent pas se déduire de la page — un top 5 des espèces sur 200
 * lignes affichées ne dit rien du jeu complet. C'est ce besoin qui imposait de
 * tout charger ; il est ici satisfait par des agrégats SQL.
 */
async function calculerStats(params, types, projetIds) {
  const [descTaxos, descHotes] = await Promise.all([
    resolveSpecimenDescendants(params.taxonomieId),
    resolveHoteDescendants(params.taxonomieHoteId),
  ]);
  const scope = projetScopeWhere(['localite', 'mission'], projetIds);

  const parType = await Promise.all(types.map(async (type) => {
    const where = whereDuType(type, params, descTaxos, descHotes, scope);
    const modele = prisma[MODELES[type]];
    const [global, sexes, taxons, localites] = await Promise.all([
      modele.aggregate({ where, _count: { _all: true }, _sum: { nombre: true }, _min: { dateCollecte: true }, _max: { dateCollecte: true } }),
      modele.groupBy({ by: ['sexe'], where, _count: { _all: true } }),
      // 20 par type avant fusion : deux identifiants taxonomiques peuvent
      // porter le même libellé une fois le sous-genre replié, et le top 5
      // final se calcule sur les libellés, pas sur les identifiants.
      modele.groupBy({ by: ['taxonomieId'], where, _sum: { nombre: true }, orderBy: { _sum: { nombre: 'desc' } }, take: 20 }),
      // Pas de `take` ici : plusieurs localités retombent sur une même mission,
      // un top 5 des localités ne donnerait pas le top 5 des missions. Le
      // nombre de localités est borné par la taille du terrain, pas par celle
      // de la collection.
      modele.groupBy({ by: ['localiteId'], where, _sum: { nombre: true } }),
    ]);
    return { type, global, sexes, taxons, localites };
  }));

  const stats = {
    total:          0,
    totalIndividus: 0,
    parType:        { moustique: 0, tique: 0, puce: 0 },
    parSexe:        { M: 0, F: 0, inconnu: 0 },
    topEspeces:     [],
    topMissions:    [],
    periode:        { dateMin: null, dateMax: null },
  };

  const jour = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  const totauxTaxon    = new Map();
  const totauxLocalite = new Map();

  for (const { type, global, sexes, taxons, localites } of parType) {
    stats.total          += global._count._all;
    stats.totalIndividus += global._sum.nombre ?? 0;
    stats.parType[type]   = global._count._all;

    for (const s of sexes) {
      const cle = s.sexe || 'inconnu';
      stats.parSexe[cle] = (stats.parSexe[cle] || 0) + s._count._all;
    }
    for (const t of taxons)     totauxTaxon.set(t.taxonomieId,    (totauxTaxon.get(t.taxonomieId)    || 0) + (t._sum.nombre ?? 0));
    for (const l of localites)  totauxLocalite.set(l.localiteId,  (totauxLocalite.get(l.localiteId)  || 0) + (l._sum.nombre ?? 0));

    const min = jour(global._min.dateCollecte);
    const max = jour(global._max.dateCollecte);
    if (min && (!stats.periode.dateMin || min < stats.periode.dateMin)) stats.periode.dateMin = min;
    if (max && (!stats.periode.dateMax || max > stats.periode.dateMax)) stats.periode.dateMax = max;
  }

  // Résolution des libellés : deux requêtes, sur des ensembles bornés.
  const [taxonomies, lieux] = await Promise.all([
    totauxTaxon.size
      ? prisma.taxonomieSpecimen.findMany({ where: { id: { in: [...totauxTaxon.keys()] } }, ...TAXONOMIE_INCLUDE })
      : [],
    totauxLocalite.size
      ? prisma.localite.findMany({ where: { id: { in: [...totauxLocalite.keys()] } }, select: { id: true, mission: { select: { ordreMission: true } } } })
      : [],
  ]);

  const parEspece = new Map();
  for (const tx of taxonomies) {
    const lib = libelleTaxonomie(tx);
    if (lib) parEspece.set(lib, (parEspece.get(lib) || 0) + (totauxTaxon.get(tx.id) || 0));
  }
  const parMission = new Map();
  for (const l of lieux) {
    const om = l.mission?.ordreMission;
    if (om) parMission.set(om, (parMission.get(om) || 0) + (totauxLocalite.get(l.id) || 0));
  }

  const top = (map, cle) => [...map.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nom, count]) => ({ [cle]: nom, count }));

  stats.topEspeces  = top(parEspece,  'nom');
  stats.topMissions = top(parMission, 'ordreMission');

  return stats;
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

  const projetIds = await getAccessibleProjetIds(req.user.id, req.user.role);

  // La page et les agrégats partent en parallèle : ils ne dépendent pas l'un
  // de l'autre, et les agrégats portent sur tout le résultat, pas sur la page.
  const [paginated, stats] = await Promise.all([
    chargerPage(req.query, types, projetIds, offset, limit),
    calculerStats(req.query, types, projetIds),
  ]);

  return res.json({
    total:  stats.total,
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
  const projetIds = await getAccessibleProjetIds(req.user.id, req.user.role);
  const items = await fetchAllSpecimens(req.query, types, projetIds);

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

module.exports = {
  search,
  exportExcel,
  // Exposés pour les tests : la pagination doit rendre EXACTEMENT ce que
  // rendait le chargement complet suivi d'un découpage, et les agrégats SQL
  // doivent coïncider avec ceux que computeStats calculait en mémoire.
  __test__: { chargerPage, calculerStats, computeStats, comparerSpecimens, fetchAllSpecimens },
};
