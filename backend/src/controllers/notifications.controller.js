// backend/src/controllers/notifications.controller.js
// Centre de notifications — réutilise audit_logs comme flux d'activité,
// avec un état "lu/non lu" partagé entre les utilisateurs connectés.
// Accessible à tout utilisateur authentifié (pas réservé aux admins,
// contrairement à /dictionnaire/audit-logs).

const prisma      = require('../config/prisma');
const sseManager  = require('../utils/sseManager');

// Une notification concerne les actions des AUTRES utilisateurs
// (on ne se notifie pas soi-même de ses propres actions).
const othersWhere = (userId) => ({
  OR: [
    { userId: { not: userId } },
    { userId: null },
  ],
});

const list = async (req, res) => {
  const userId = req.user.id;
  const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);

  const base   = othersWhere(userId);
  const filter = { ...base };

  if (req.query.action) filter.action = req.query.action;
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.isRead === 'true')  filter.isRead = true;
  if (req.query.isRead === 'false') filter.isRead = false;

  const [items, total, unreadCount] = await Promise.all([
    prisma.auditLog.findMany({
      where:   filter,
      include: { user: { select: { id: true, prenom: true, nom: true } } },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      skip:    offset,
    }),
    prisma.auditLog.count({ where: filter }),
    prisma.auditLog.count({ where: { ...base, isRead: false } }),
  ]);

  return res.json({ items, total, unreadCount });
};

const markRead = async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.auditLog.update({ where: { id }, data: { isRead: true } });
  return res.json({ message: 'ok' });
};

const markAllRead = async (req, res) => {
  await prisma.auditLog.updateMany({
    where: { ...othersWhere(req.user.id), isRead: false },
    data: { isRead: true },
  });
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

  // Envoie le unreadCount actuel dès l'établissement de la connexion
  try {
    const unreadCount = await prisma.auditLog.count({
      where: { ...othersWhere(userId), isRead: false },
    });
    res.write(`event: init\ndata: ${JSON.stringify({ unreadCount })}\n\n`);
  } catch { /* non bloquant */ }

  // Keep-alive : commentaire SSE toutes les 30s pour éviter les timeouts proxy
  const ping = setInterval(() => {
    try { res.write(':ping\n\n'); } catch { clearInterval(ping); }
  }, 30000);

  req.on('close', () => {
    clearInterval(ping);
    sseManager.removeClient(userId, res);
    sseManager.broadcast(null, 'presence_update', {});
  });
};

module.exports = { list, markRead, markAllRead, stream };
