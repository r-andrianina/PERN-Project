// backend/src/config/rbac.js
// Source de vérité UNIQUE de la configuration RBAC (F2).
//
// Consommée côté backend par le middleware d'auth (hiérarchie des rôles), les
// schémas Zod (enums role/spécimens) et l'utilitaire de cloisonnement projet,
// et exposée au frontend via GET /api/v1/rbac/config. Objectif : supprimer la
// duplication back/front qui a déjà provoqué un bug (blocage du superviseur,
// carte de rôles obsolète sans « superviseur »).

// Hiérarchie des rôles, du plus faible au plus fort. L'ORDRE du tableau définit
// les niveaux (index 0 → niveau 1). Ajouter/retirer un rôle ici se propage
// partout (middleware, validation, endpoint, frontend hydraté).
const ROLE_ORDER = ['lecteur', 'technicien', 'chercheur', 'superviseur', 'admin'];

// { lecteur:1, technicien:2, chercheur:3, superviseur:4, admin:5 }
const ROLE_LEVELS = Object.fromEntries(ROLE_ORDER.map((r, i) => [r, i + 1]));

// Rôles qui bypassent le cloisonnement (projets + accès par type de spécimen).
const BYPASS_ROLES = ['admin', 'superviseur'];

// Types de spécimens gérés (specimensAutorises + validation).
const SPECIMEN_TYPES = ['moustique', 'tique', 'puce', 'autre'];

// Accès spécimen par défaut à la création d'un utilisateur.
const DEFAULT_SPECIMEN_ACCESS = ['moustique', 'tique', 'puce'];

module.exports = {
  ROLE_ORDER,
  ROLE_LEVELS,
  BYPASS_ROLES,
  SPECIMEN_TYPES,
  DEFAULT_SPECIMEN_ACCESS,
};
