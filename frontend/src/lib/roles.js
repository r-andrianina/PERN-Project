// frontend/src/lib/roles.js
// Utilitaires de rôles côté client — miroir de la logique backend.

export const ROLE_LEVELS = {
  admin:       5,
  superviseur: 4,
  chercheur:   3,
  technicien:  2,
  lecteur:     1,
};

/** Retourne true si userRole >= minRole dans la hiérarchie. */
export const hasMinRole = (userRole, minRole) =>
  (ROLE_LEVELS[userRole] ?? 0) >= (ROLE_LEVELS[minRole] ?? 0);

/** admin et superviseur voient tout — bypass membership, specimen filter, etc. */
export const canBypass = (userRole) =>
  userRole === 'admin' || userRole === 'superviseur';

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
