// backend/src/utils/sseManager.js
// Registre en mémoire des connexions SSE actives, indexées par userId.
// Un même utilisateur peut avoir plusieurs onglets ouverts (Set par userId).

const clients = new Map(); // Map<userId, Set<res>>

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
}

function removeClient(userId, res) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(userId);
}

// Envoie un événement SSE à tous les clients connectés sauf l'acteur.
// excludeUserId = null → tout le monde reçoit l'événement (action système).
function broadcast(excludeUserId, eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [userId, responses] of clients) {
    if (userId === excludeUserId) continue;
    const dead = [];
    for (const res of responses) {
      try { res.write(payload); } catch { dead.push(res); }
    }
    // Nettoie les connexions mortes (navigateur fermé sans close event)
    dead.forEach(res => removeClient(userId, res));
  }
}

function getOnlineUserIds() {
  return [...clients.keys()];
}

function getTabCount(userId) {
  return clients.get(userId)?.size ?? 0;
}

// Ferme toutes les connexions SSE d'un utilisateur (kick de session).
function disconnectUser(userId) {
  const set = clients.get(userId);
  if (!set) return false;
  for (const res of set) {
    try { res.end(); } catch { /* connexion déjà morte */ }
  }
  clients.delete(userId);
  return true;
}

// Envoie un événement SSE à un utilisateur spécifique (tous ses onglets).
function sendToUser(userId, eventName, data) {
  const responses = clients.get(userId);
  if (!responses || responses.size === 0) return false;
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  const dead = [];
  for (const res of responses) {
    try { res.write(payload); } catch { dead.push(res); }
  }
  dead.forEach(res => removeClient(userId, res));
  return true;
}

module.exports = { addClient, removeClient, broadcast, sendToUser, getOnlineUserIds, getTabCount, disconnectUser };
