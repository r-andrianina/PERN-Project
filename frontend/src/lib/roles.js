// frontend/src/lib/roles.js
// Utilitaires de rôles côté client. La hiérarchie (niveaux + bypass) est
// HYDRATÉE au démarrage depuis le backend via GET /api/v1/rbac/config
// (source de vérité unique, F2) ; les valeurs ci-dessous ne servent que de
// repli avant hydratation ou si l'endpoint est injoignable.

// Repli statique — doit rester aligné sur backend/src/config/rbac.js.
const DEFAULT_ROLE_LEVELS = {
  admin:       5,
  superviseur: 4,
  chercheur:   3,
  technicien:  2,
  lecteur:     1,
};
const DEFAULT_BYPASS_ROLES = ['admin', 'superviseur'];

// État courant, remplacé par hydrateRbac() une fois la config backend reçue.
let roleLevels  = { ...DEFAULT_ROLE_LEVELS };
let bypassRoles = [...DEFAULT_BYPASS_ROLES];

/** Alimente la config RBAC depuis le backend (F2). Repli conservé si absent. */
export const hydrateRbac = (config) => {
  if (config?.roleLevels && Object.keys(config.roleLevels).length) {
    roleLevels = config.roleLevels;
    // Dérive-t-on du repli ? Signale la dérive en dev (diagnostic F2).
    if (import.meta.env.DEV) {
      const drift = Object.keys(DEFAULT_ROLE_LEVELS).some(
        (r) => DEFAULT_ROLE_LEVELS[r] !== roleLevels[r]
      );
      if (drift) console.warn('[rbac] la hiérarchie de rôles backend diffère du repli frontend — mettez à jour DEFAULT_ROLE_LEVELS dans lib/roles.js');
    }
  }
  if (Array.isArray(config?.bypassRoles) && config.bypassRoles.length) {
    bypassRoles = config.bypassRoles;
  }
};

/** Niveaux courants (lecture seule) — surtout utile pour le debug. */
export const getRoleLevels = () => ({ ...roleLevels });

/** Retourne true si userRole >= minRole dans la hiérarchie. */
export const hasMinRole = (userRole, minRole) =>
  (roleLevels[userRole] ?? 0) >= (roleLevels[minRole] ?? 0);

/** admin et superviseur voient tout — bypass membership, specimen filter, etc. */
export const canBypass = (userRole) => bypassRoles.includes(userRole);

export const ROLE_LABELS = {
  admin:       'Admin',
  superviseur: 'Superviseur',
  chercheur:   'Chercheur',
  technicien:  'Technicien',
  lecteur:     'Lecteur',
};

export const ROLE_DESCRIPTIONS = {
  admin:       'Accès total — gestion des utilisateurs, référentiels, toutes les données',
  superviseur: 'Gestion des projets et membres — création/modification sans accès admin',
  chercheur:   'Création et modification de toutes les données scientifiques',
  technicien:  'Saisie de spécimens, méthodes de collecte et import Excel',
  lecteur:     'Consultation uniquement — aucune modification possible',
};

export const ROLE_COLORS = {
  admin:       'bg-role-admin/10 text-role-admin border-role-admin/20',
  superviseur: 'bg-purple-100 text-purple-700 border-purple-200',
  chercheur:   'bg-role-chercheur/10 text-role-chercheur border-role-chercheur/20',
  technicien:  'bg-role-terrain/10 text-role-terrain border-role-terrain/20',
  lecteur:     'bg-surface-3 text-fg-muted border-border-strong',
};

export const ROLE_TONE = {
  admin:       'role-admin',
  superviseur: 'role-superviseur',
  chercheur:   'role-chercheur',
  technicien:  'role-terrain',
  lecteur:     'default',
};
