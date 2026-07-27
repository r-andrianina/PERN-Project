// backend/src/controllers/dashboard.controller.js
// Statistiques agrégées pour les graphiques du dashboard.
// Filtre par specimensAutorises (RBAC).

const prisma = require('../config/prisma');

// Génère les 6 derniers mois (du plus ancien au plus récent)
function derniersMois(n = 6) {
  const mois = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    d.setHours(0, 0, 0, 0);
    mois.push({
      key:   d.toISOString().slice(0, 7),                          // "2025-11"
      label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), // "nov. 25"
      date:  d,
    });
  }
  return mois;
}

// GET /api/v1/dashboard/stats
const getStats = async (req, res) => {
  const autorises = req.user.role === 'admin'
    ? ['moustique', 'tique', 'puce']
    : (req.user.specimensAutorises || []);

  // ── Totaux scalaires + missions récentes (toujours fetchés) ──
  const [
    totalProjets,
    totalMissions,
    aggMoustiques,
    aggTiques,
    aggPuces,
    missionsRecentes,
  ] = await Promise.all([
    prisma.projet.count(),
    prisma.mission.count(),
    autorises.includes('moustique')
      ? prisma.moustique.aggregate({ _sum: { nombre: true } })
      : null,
    autorises.includes('tique')
      ? prisma.tique.aggregate({ _sum: { nombre: true } })
      : null,
    autorises.includes('puce')
      ? prisma.puce.aggregate({ _sum: { nombre: true } })
      : null,
    prisma.mission.findMany({
      take:    6,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, ordreMission: true,
        projet: { select: { nom: true } },
        _count: { select: { localites: true } },
      },
    }),
  ]);

  const totaux = {
    projets:    totalProjets,
    missions:   totalMissions,
    moustiques: autorises.includes('moustique') ? Number(aggMoustiques._sum.nombre ?? 0) : null,
    tiques:     autorises.includes('tique')     ? Number(aggTiques._sum.nombre     ?? 0) : null,
    puces:      autorises.includes('puce')      ? Number(aggPuces._sum.nombre      ?? 0) : null,
  };

  if (autorises.length === 0) {
    return res.json({ parMois: [], topEspeces: [], autorises: [], totaux, missionsRecentes });
  }

  const mois    = derniersMois(6);
  const dateMin = mois[0].date;

  // ── Collectes par mois pour chaque type autorisé ─────────────
  const rawQueries = [];

  if (autorises.includes('moustique')) {
    rawQueries.push(
      prisma.$queryRaw`
        SELECT TO_CHAR(DATE_TRUNC('month', COALESCE(date_collecte, created_at)), 'YYYY-MM') AS mois,
               COALESCE(SUM(nombre), 0)::int AS total
        FROM moustiques
        WHERE COALESCE(date_collecte, created_at) >= ${dateMin}
        GROUP BY 1
      `.then(rows => ({ type: 'moustique', rows }))
    );
  }
  if (autorises.includes('tique')) {
    rawQueries.push(
      prisma.$queryRaw`
        SELECT TO_CHAR(DATE_TRUNC('month', COALESCE(date_collecte, created_at)), 'YYYY-MM') AS mois,
               COALESCE(SUM(nombre), 0)::int AS total
        FROM tiques
        WHERE COALESCE(date_collecte, created_at) >= ${dateMin}
        GROUP BY 1
      `.then(rows => ({ type: 'tique', rows }))
    );
  }
  if (autorises.includes('puce')) {
    rawQueries.push(
      prisma.$queryRaw`
        SELECT TO_CHAR(DATE_TRUNC('month', COALESCE(date_collecte, created_at)), 'YYYY-MM') AS mois,
               COALESCE(SUM(nombre), 0)::int AS total
        FROM puces
        WHERE COALESCE(date_collecte, created_at) >= ${dateMin}
        GROUP BY 1
      `.then(rows => ({ type: 'puce', rows }))
    );
  }

  const rawResults = await Promise.all(rawQueries);

  // Construire le tableau parMois en remplissant les mois sans données
  const parMois = mois.map(m => {
    const entry = { mois: m.label };
    autorises.forEach(t => { entry[t] = 0; });
    return entry;
  });

  rawResults.forEach(({ type, rows }) => {
    rows.forEach(row => {
      const idx = mois.findIndex(m => m.key === row.mois);
      if (idx !== -1) parMois[idx][type] = Number(row.total);
    });
  });

  // ── Top 5 espèces toutes collections confondues ──────────────
  const topQueries = [];

  if (autorises.includes('moustique')) {
    topQueries.push(
      prisma.moustique.groupBy({
        by: ['taxonomieId'],
        _sum: { nombre: true },
        orderBy: { _sum: { nombre: 'desc' } },
        take: 5,
      }).then(rows => rows.map(r => ({ taxonomieId: r.taxonomieId, total: r._sum.nombre || 0, type: 'moustique' })))
    );
  }
  if (autorises.includes('tique')) {
    topQueries.push(
      prisma.tique.groupBy({
        by: ['taxonomieId'],
        _sum: { nombre: true },
        orderBy: { _sum: { nombre: 'desc' } },
        take: 5,
      }).then(rows => rows.map(r => ({ taxonomieId: r.taxonomieId, total: r._sum.nombre || 0, type: 'tique' })))
    );
  }
  if (autorises.includes('puce')) {
    topQueries.push(
      prisma.puce.groupBy({
        by: ['taxonomieId'],
        _sum: { nombre: true },
        orderBy: { _sum: { nombre: 'desc' } },
        take: 5,
      }).then(rows => rows.map(r => ({ taxonomieId: r.taxonomieId, total: r._sum.nombre || 0, type: 'puce' })))
    );
  }

  const topRaw = (await Promise.all(topQueries)).flat();

  // Enrichir avec les noms de taxonomie
  const taxoIds = [...new Set(topRaw.map(r => r.taxonomieId))];
  const taxos   = await prisma.taxonomieSpecimen.findMany({
    where: { id: { in: taxoIds } },
    select: { id: true, nom: true, parent: { select: { nom: true } } },
  });
  const taxoMap = Object.fromEntries(taxos.map(t => [
    t.id,
    t.parent?.nom ? `${t.parent.nom} ${t.nom}` : t.nom,
  ]));

  const topEspeces = topRaw
    .map(r => ({ nom: taxoMap[r.taxonomieId] || `#${r.taxonomieId}`, total: r.total, type: r.type }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return res.json({ parMois, topEspeces, autorises, totaux, missionsRecentes });
};

// GET /api/v1/dashboard/admin-stats  (admin uniquement)
// Métriques d'usage par utilisateur + totaux globaux.
const getAdminStats = async (req, res) => {
  const SPECIMEN_ENTITIES = ['Moustique', 'Tique', 'Puce'];
  const now       = new Date();
  const debut7j   = new Date(now - 7  * 86400000);
  const debut30j  = new Date(now - 30 * 86400000);
  const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    saisies7j, saisies30j, derniereAction,
    totalMoustiques, totalTiques, totalPuces,
    nbAujourdHui, nbSemaine, nbMois,
  ] = await Promise.all([
    // Créations de spécimens par userId sur 7j
    prisma.auditLog.groupBy({
      by: ['userId'],
      _count: { id: true },
      where: { action: 'CREATE', entity: { in: SPECIMEN_ENTITIES }, createdAt: { gte: debut7j }, userId: { not: null } },
    }),
    // Créations de spécimens par userId sur 30j
    prisma.auditLog.groupBy({
      by: ['userId'],
      _count: { id: true },
      where: { action: 'CREATE', entity: { in: SPECIMEN_ENTITIES }, createdAt: { gte: debut30j }, userId: { not: null } },
    }),
    // Dernière action toutes entités confondues
    prisma.auditLog.groupBy({
      by: ['userId'],
      _max: { createdAt: true },
      where: { userId: { not: null } },
    }),
    // Totaux spécimens (somme nombre)
    prisma.moustique.aggregate({ _sum: { nombre: true } }),
    prisma.tique.aggregate({ _sum:    { nombre: true } }),
    prisma.puce.aggregate({ _sum:     { nombre: true } }),
    // Spécimens créés aujourd'hui / semaine / mois (audit_logs)
    prisma.auditLog.count({ where: { action: 'CREATE', entity: { in: SPECIMEN_ENTITIES }, createdAt: { gte: debutJour } } }),
    prisma.auditLog.count({ where: { action: 'CREATE', entity: { in: SPECIMEN_ENTITIES }, createdAt: { gte: debut7j  } } }),
    prisma.auditLog.count({ where: { action: 'CREATE', entity: { in: SPECIMEN_ENTITIES }, createdAt: { gte: debut30j } } }),
  ]);

  // Enrichissement avec infos utilisateur
  const userIds = [...new Set([
    ...saisies30j.map(s => s.userId),
    ...derniereAction.map(s => s.userId),
  ])].filter(Boolean);

  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where:  { id: { in: userIds } },
        select: { id: true, nom: true, prenom: true, role: true, actif: true },
      })
    : [];

  const s7Map  = Object.fromEntries(saisies7j.map(s => [s.userId,       s._count.id]));
  const s30Map = Object.fromEntries(saisies30j.map(s => [s.userId,      s._count.id]));
  const daMap  = Object.fromEntries(derniereAction.map(s => [s.userId,  s._max.createdAt]));

  const parUtilisateur = users
    .map(u => ({
      user:          u,
      saisies7j:     s7Map[u.id]  ?? 0,
      saisies30j:    s30Map[u.id] ?? 0,
      derniereAction: daMap[u.id] ?? null,
    }))
    .sort((a, b) => b.saisies30j - a.saisies30j);

  return res.json({
    parUtilisateur,
    totauxSpecimens: {
      moustique: Number(totalMoustiques._sum.nombre ?? 0),
      tique:     Number(totalTiques._sum.nombre     ?? 0),
      puce:      Number(totalPuces._sum.nombre      ?? 0),
    },
    saisiesRecentes: {
      aujourdhui: nbAujourdHui,
      semaine:    nbSemaine,
      mois:       nbMois,
    },
  });
};

module.exports = { getStats, getAdminStats };
