// backend/src/utils/access.js
// Logique de cloisonnement par projet : admin et superviseur voient tout,
// les autres rôles ne voient que les projets dont ils sont membres.

const prisma = require('../config/prisma');

const BYPASS_ROLES = ['admin', 'superviseur'];

/**
 * Retourne les projetIds accessibles pour un utilisateur.
 * Retourne null si l'utilisateur bypass (admin/superviseur) → aucun filtre.
 * Retourne [] si l'utilisateur n'est membre d'aucun projet.
 */
const getAccessibleProjetIds = async (userId, userRole) => {
  if (BYPASS_ROLES.includes(userRole)) return null;
  const membres = await prisma.membreProjet.findMany({
    where:  { userId },
    select: { projetId: true },
  });
  return membres.map(m => m.projetId);
};

const canBypass = (role) => BYPASS_ROLES.includes(role);

module.exports = { getAccessibleProjetIds, canBypass, BYPASS_ROLES };
