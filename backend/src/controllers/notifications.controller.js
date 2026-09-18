// backend/src/controllers/notifications.controller.js
// Centre de notifications — réutilise audit_logs comme flux d'activité.
// L'état "lu / non lu" est PAR UTILISATEUR (B3) : il vit dans la table
// NotificationRead (une ligne = un audit_log lu par un utilisateur donné,
// l'absence de ligne = "non lu" pour cet utilisateur). Le booléen partagé
// audit_logs.isRead n'est plus utilisé pour l'état de lecture.
// Accessible à tout utilisateur authentifié (pas réservé aux admins,
// contrairement à /dictionnaire/audit-logs).

const prisma      = require('../config/prisma');
const sseManager  = require('../utils/sseManager');

// Une notification concerne les actions des AUTRES utilisateurs
// (on ne se notifie pas soi-même de ses propres actions).
// Entités d'audit qui ne sont PAS de l'activité à diffuser.
// `Auth` porte les connexions et les tentatives échouées (2026-09-14) : ce sont
// des données de sécurité, consultables par les admins via
// /dictionnaire/audit-logs. Les laisser passer ici noierait le flux sous une
// ligne par personne et par jour, et ferait fuiter vers tous les utilisateurs
// les tentatives échouées sur les comptes de leurs collègues.
const ENTITES_HORS_FLUX = ['Auth'];

const othersWhere = (userId) => ({
  AND: [
    { entity: { notIn: ENTITES_HORS_FLUX } },
    {
      OR: [
        { userId: { not: userId } },
        { userId: null },
      ],
    },
  ],
});

// Nombre de notifications non lues POUR CET UTILISATEUR : les logs des autres
// qui n'ont aucune ligne NotificationRead à son nom.
const unreadCountFor = (userId) =>
  prisma.auditLog.count({
    where: { ...othersWhere(userId), reads: { none: { userId } } },
  });

const list = async (req, res) => {
  const userId = req.user.id;
  const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);

  const base   = othersWhere(userId);
  const filter = { ...base };

  if (req.query.action) filter.action = req.query.action;
  if (req.query.entity) filter.entity = req.query.entity;
  // Filtre lu/non lu par utilisateur (relation NotificationRead), plus le
  // booléen partagé d'avant.
  if (req.query.isRead === 'true')  filter.reads = { some: { userId } };
  if (req.query.isRead === 'false') filter.reads = { none: { userId } };

  const [rows, total, unreadCount] = await Promise.all([
    prisma.auditLog.findMany({
      where:   filter,
      include: {
        user:  { select: { id: true, prenom: true, nom: true } },
        // Ne récupère que la ligne de lecture de CET utilisateur (0 ou 1).
        reads: { where: { userId }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      skip:    offset,
    }),
    prisma.auditLog.count({ where: filter }),
    unreadCountFor(userId),
  ]);

  // Expose un booléen isRead par utilisateur (contrat inchangé côté frontend)
  // en remplacement de la colonne partagée, et masque la relation brute.
  const items = rows.map(({ reads, ...rest }) => ({
    ...rest,
    isRead: reads.length > 0,
  }));

  return res.json({ items, total, unreadCount });
};

const markRead = async (req, res) => {
  const userId     = req.user.id;
  const auditLogId = parseInt(req.params.id);

  // Idempotent : marquer deux fois "lu" ne crée pas de doublon (unique).
  await prisma.notificationRead.upsert({
    where:  { userId_auditLogId: { userId, auditLogId } },
    create: { userId, auditLogId },
    update: {},
  });
  return res.json({ message: 'ok' });
};

const markAllRead = async (req, res) => {
  const userId = req.user.id;

  // Toutes les notifications encore non lues pour cet utilisateur.
  const rows = await prisma.auditLog.findMany({
    where:  { ...othersWhere(userId), reads: { none: { userId } } },
    select: { id: true },
  });

  if (rows.length > 0) {
    await prisma.notificationRead.createMany({
      data: rows.map((r) => ({ userId, auditLogId: r.id })),
      skipDuplicates: true,
    });
  }
  return res.json({ message: 'ok' });
};

// Endpoint SSE — maintient une connexion longue durée et pousse les événements
// d'activité en temps réel. Le token JWT est lu en query param car EventSource
// ne supporte pas les headers personnalisés.
const stream = async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // désactive le buffering nginx/proxy
  res.flushHeaders();

  const userId = req.user.id;
  sseManager.addClient(userId, res);
  sseManager.broadcast(userId, 'presence_update', {});

  // Envoie le unreadCount actuel (par utilisateur) dès l'établissement de la connexion
  try {
    const unreadCount = await unreadCountFor(userId);
    res.write(`event: init\ndata: ${JSON.stringify({ unreadCount })}\n\n`);
  } catch { /* non bloquant */ }

  // Keep-alive : commentaire SSE toutes les 30 s pour éviter les timeouts proxy.
  //
  // Il sert AUSSI de faucheuse (2026-09-18). L'ancienne version se contentait
  // d'arrêter l'intervalle quand l'écriture échouait : l'entrée restait au
  // registre de sseManager, donc l'utilisateur apparaissait connecté
  // indéfiniment sur la page de présence, avec un onglet fantôme. Seule une
  // diffusion ultérieure pouvait la ramasser, et seulement si elle avait lieu.
  //
  // L'état de la réponse est testé explicitement plutôt que de compter sur une
  // exception : `res.write()` sur une socket détruite renvoie `false` sans
  // lever, donc le `catch` seul pouvait ne jamais se déclencher.
  const libere = () => {
    clearInterval(ping);
    sseManager.removeClient(userId, res);
    sseManager.broadcast(null, 'presence_update', {});
  };

  const ping = setInterval(() => {
    if (res.writableEnded || res.destroyed) return libere();
    try { res.write(':ping\n\n'); } catch { libere(); }
  }, 30000);

  req.on('close', () => {
    clearInterval(ping);
    sseManager.removeClient(userId, res);
    sseManager.broadcast(null, 'presence_update', {});
  });
};

module.exports = { list, markRead, markAllRead, stream };
