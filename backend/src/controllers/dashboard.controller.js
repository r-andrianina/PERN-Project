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

  if (autorises.length === 0) {
    return res.json({ parMois: [], topEspeces: [], autorises: [] });
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

  return res.json({ parMois, topEspeces, autorises });
};

module.exports = { getStats };
