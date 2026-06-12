// backend/src/controllers/notifications.controller.js
// Centre de notifications — réutilise audit_logs comme flux d'activité,
// avec un état "lu/non lu" partagé entre les utilisateurs connectés.
// Accessible à tout utilisateur authentifié (pas réservé aux admins,
// contrairement à /dictionnaire/audit-logs).

const prisma = require('../config/prisma');

// Une notification concerne les actions des AUTRES utilisateurs
// (on ne se notifie pas soi-même de ses propres actions).
const othersWhere = (userId) => ({
  OR: [
    { userId: { not: userId } },
    { userId: null },
  ],
});

const list = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const [items, unreadCount] = await Promise.all([
      prisma.auditLog.findMany({
        where: othersWhere(userId),
        include: { user: { select: { id: true, prenom: true, nom: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.auditLog.count({ where: { ...othersWhere(userId), isRead: false } }),
    ]);

    return res.json({ items, unreadCount });
  } catch (err) {
    console.error('Erreur list notifications :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const markRead = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.auditLog.update({ where: { id }, data: { isRead: true } });
    return res.json({ message: 'ok' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Notification introuvable' });
    console.error('Erreur markRead notification :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const markAllRead = async (req, res) => {
  try {
    await prisma.auditLog.updateMany({
      where: { ...othersWhere(req.user.id), isRead: false },
      data: { isRead: true },
    });
    return res.json({ message: 'ok' });
  } catch (err) {
    console.error('Erreur markAllRead notifications :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = { list, markRead, markAllRead };
