// backend/src/utils/audit.js
// Helper d'historisation générique pour les référentiels (CDC §3 — historisation)
// Écrit une entrée dans audit_logs à chaque CRUD/activation/désactivation.

const prisma = require('../config/prisma');

const ACTIONS = {
  CREATE:     'CREATE',
  UPDATE:     'UPDATE',
  DELETE:     'DELETE',
  ACTIVATE:   'ACTIVATE',
  DEACTIVATE: 'DEACTIVATE',
};

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
async function logAudit({ req, action, entity, entityId, oldValues, newValues }) {
  try {
    await prisma.auditLog.create({
      data: {
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
      },
    });
  } catch (err) {
    // L'audit ne doit jamais bloquer la requête utilisateur ;
    // on log côté serveur sans relancer.
    console.error('Erreur audit :', err.message);
  }
}

module.exports = { logAudit, ACTIONS };
