// backend/src/utils/audit.js
// Helper d'historisation générique pour les référentiels (CDC §3 — historisation)
// Écrit une entrée dans audit_logs à chaque CRUD/activation/désactivation.

const prisma      = require('../config/prisma');
const sseManager  = require('./sseManager');

const ACTIONS = {
  CREATE:     'CREATE',
  UPDATE:     'UPDATE',
  DELETE:     'DELETE',
  ACTIVATE:   'ACTIVATE',
  DEACTIVATE: 'DEACTIVATE',
  READ:       'READ',
};

/**
 * Construit la ligne `audit_logs` correspondant à une action, SANS l'écrire.
 *
 * Extrait de logAudit pour que les écritures en masse puissent l'insérer via
 * leur propre client — typiquement le client transactionnel d'un import, qui
 * doit valider ou annuler l'audit en même temps que les données qu'il décrit
 * (cf. import.controller.js : c'est cette entrée qui porte l'empreinte du
 * fichier et bloque un ré-import ; l'écrire hors transaction laissait un import
 * validé sans sa garde).
 */
function buildAuditData({ req, action, entity, entityId, oldValues, newValues }) {
  return {
    userId:    req?.user?.id ?? null,
    action,
    entity,
    entityId,
    oldValues: oldValues ?? null,
    newValues: newValues ?? null,
    metadata: {
      ip:        req?.ip ?? null,
      userAgent: req?.headers?.['user-agent'] ?? null,
      method:    req?.method ?? null,
      path:      req?.originalUrl ?? null,
    },
  };
}

/** Notifie en temps réel tous les utilisateurs connectés sauf l'auteur. */
function notifierActivite(actorId) {
  try {
    sseManager.broadcast(actorId, 'new_activity', { actorId });
  } catch (err) {
    console.error('Erreur diffusion SSE :', err.message);
  }
}

/**
 * Enregistre une entrée d'audit.
 * @param {object} params
 * @param {object} params.req       - requête Express (pour user + ip)
 * @param {string} params.action    - une valeur de ACTIONS
 * @param {string} params.entity    - nom de l'entité (ex: "TaxonomieSpecimen")
 * @param {number} params.entityId  - id de la ligne concernée
 * @param {object} [params.oldValues]
 * @param {object} [params.newValues]
 */
async function logAudit(params) {
  try {
    await prisma.auditLog.create({ data: buildAuditData(params) });
    notifierActivite(params.req?.user?.id ?? null);
  } catch (err) {
    // L'audit ne doit jamais bloquer la requête utilisateur ;
    // on log côté serveur sans relancer.
    console.error('Erreur audit :', err.message);
  }
}

module.exports = { logAudit, buildAuditData, notifierActivite, ACTIONS };
