// backend/src/utils/access.js
// Logique de cloisonnement par projet : admin et superviseur voient tout,
// les autres rôles ne voient que les projets dont ils sont membres.

const prisma   = require('../config/prisma');
const AppError = require('./AppError');
const { BYPASS_ROLES } = require('../config/rbac'); // source unique (F2)

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

/**
 * Construit un filtre Prisma imbriqué qui restreint une requête aux lignes
 * dont la chaîne de relations mène à un projet accessible.
 * @param {string[]} relationPath  ex: ['methode','localite','mission'] pour un Hote
 * @param {number[]|null} accessibleProjetIds  résultat de getAccessibleProjetIds
 * @returns {object}  {} si pas de restriction (bypass), sinon la clause imbriquée
 */
const projetScopeWhere = (relationPath, accessibleProjetIds) => {
  if (accessibleProjetIds === null) return {};
  let clause = { projetId: { in: accessibleProjetIds } };
  for (let i = relationPath.length - 1; i >= 0; i--) {
    clause = { [relationPath[i]]: clause };
  }
  return clause;
};

/**
 * Vérifie qu'un projetId donné fait partie des projets accessibles à
 * l'utilisateur ; lève AppError.forbidden sinon. Ne rien faire pour un
 * utilisateur bypass (accessibleProjetIds === null).
 * @param {number} projetId
 * @param {number[]|null} accessibleProjetIds
 */
const assertProjetAccessible = (projetId, accessibleProjetIds) => {
  if (accessibleProjetIds !== null && !accessibleProjetIds.includes(projetId)) {
    throw AppError.forbidden('Accès refusé — hors de votre périmètre projet');
  }
};

module.exports = { getAccessibleProjetIds, canBypass, BYPASS_ROLES, projetScopeWhere, assertProjetAccessible };
