// frontend/src/utils/notifications.js
// Transforme une entrée audit_logs (telle que renvoyée par /notifications)
// en phrase lisible pour le centre de notifications.

const ENTITY_LABELS = {
  Moustique:            'le moustique',
  Tique:                'la tique',
  Puce:                 'la puce',
  Localite:             'la localité',
  MethodeCollecte:      'la méthode de collecte',
  Mission:              'la mission',
  Projet:               'le projet',
  Hote:                 "l'hôte",
  Container:            'le container',
  TaxonomieSpecimen:    'la taxonomie',
  TaxonomieHote:        'la taxonomie hôte',
  TypeMethodeCollecte:  'le type de méthode',
  SolutionConservation: 'la solution de conservation',
  TypeEnvironnement:    "le type d'environnement",
  TypeHabitat:          "le type d'habitat",
  User:                 "l'utilisateur",
};

const ACTION_VERBS = {
  CREATE:     'a créé',
  UPDATE:     'a modifié',
  DELETE:     'a supprimé',
  ACTIVATE:   'a activé',
  DEACTIVATE: 'a désactivé',
  READ:       'a consulté',
};

const FIELD_LABELS = {
  nom: 'nom', code: 'code', actif: 'statut', description: 'description',
  nombre: 'nombre', sexe: 'sexe', stade: 'stade', notes: 'notes',
  role: 'rôle', capacity: 'capacité', type: 'type',
  taxonomieId: 'taxonomie', solutionId: 'solution', dateCollecte: 'date de collecte',
  region: 'région', district: 'district', commune: 'commune', fokontany: 'fokontany',
  contacts: 'contacts locaux',
  typeMethodeId: 'type de méthode', typeHabitatId: 'habitat', typeEnvironnementId: 'environnement',
};

const GPS_ENTITIES = new Set(['Localite', 'MethodeCollecte']);

function describeGpsChange(old, neu) {
  if (old.altitudeM !== undefined && neu.altitudeM !== undefined && Number(old.altitudeM ?? 0) !== Number(neu.altitudeM ?? 0)) {
    return `Altitude modifiée de ${old.altitudeM ?? '—'}m à ${neu.altitudeM ?? '—'}m`;
  }
  const latChanged = old.latitude !== undefined && neu.latitude !== undefined && Number(old.latitude ?? 0) !== Number(neu.latitude ?? 0);
  const lngChanged = old.longitude !== undefined && neu.longitude !== undefined && Number(old.longitude ?? 0) !== Number(neu.longitude ?? 0);
  if (latChanged || lngChanged) return 'Coordonnées GPS modifiées';
  return null;
}

function describeFieldChanges(old, neu) {
  const changed = Object.keys(FIELD_LABELS).filter((f) =>
    old[f] !== undefined && neu[f] !== undefined && String(old[f]) !== String(neu[f])
  );
  if (!changed.length) return null;
  return `${FIELD_LABELS[changed[0]]} modifié${changed.length > 1 ? `, +${changed.length - 1} autre(s)` : ''}`;
}

/** Construit la phrase d'une notification, ex: "Rindra a modifié le point GPS [ID: 24] (...)" */
export function formatNotificationText(item) {
  const author = item.user ? `${item.user.prenom} ${item.user.nom}` : 'Un utilisateur';
  const verb    = ACTION_VERBS[item.action] || item.action;
  const label   = ENTITY_LABELS[item.entity] || item.entity;
  const old = item.oldValues || {};
  const neu = item.newValues || {};

  // Import Excel : une entrée = un lot importé dans une mission, pas un objet
  // unique. Le rendu générique ("a créé ImportMoustiques [ID: 43]") serait
  // trompeur — l'ID est celui de la mission, pas d'un spécimen.
  if (item.entity === 'ImportMoustiques') {
    const n       = neu.importes ?? 0;
    const cible   = neu.ordreMission ? `la mission « ${neu.ordreMission} »` : `la mission [ID: ${item.entityId}]`;
    const fichier = neu.fichier ? ` — fichier ${neu.fichier}` : '';
    return `${author} a importé ${n} moustique${n > 1 ? 's' : ''} dans ${cible}${fichier}`;
  }

  if (GPS_ENTITIES.has(item.entity) && item.action === 'UPDATE') {
    const gpsDetail = describeGpsChange(old, neu);
    if (gpsDetail) return `${author} ${verb} le point GPS [ID: ${item.entityId}] (${gpsDetail})`;
  }

  const name = neu.nom ?? old.nom ?? neu.idTerrain ?? old.idTerrain ?? null;
  const target = name ? `${label} « ${name} »` : `${label} [ID: ${item.entityId}]`;

  let detail = '';
  if (item.action === 'UPDATE') {
    const fieldDetail = describeFieldChanges(old, neu);
    if (fieldDetail) detail = ` (${fieldDetail})`;
  }

  return `${author} ${verb} ${target}${detail}`;
}

/** Résout l'URL de navigation pour une entrée audit_log.
 *  Retourne null si l'entité n'a pas de page dédiée. */
export function resolveEntityUrl(entity, entityId, action) {
  const isDelete = action === 'DELETE';
  const urls = {
    Moustique:            isDelete ? '/specimens/moustiques'  : `/specimens/moustiques/${entityId}`,
    Tique:                isDelete ? '/specimens/tiques'      : `/specimens/tiques/${entityId}`,
    Puce:                 isDelete ? '/specimens/puces'       : `/specimens/puces/${entityId}`,
    Mission:              isDelete ? '/missions'              : `/missions/${entityId}`,
    Projet:               isDelete ? '/projets'               : `/projets/${entityId}`,
    Hote:                 isDelete ? '/hotes'                   : `/hotes/${entityId}`,
    Container:            '/missions',
    ImportMoustiques:     `/missions/${entityId}`, // entityId = la mission importée
    MethodeCollecte:      '/missions',
    Localite:             '/missions',
    TaxonomieSpecimen:    '/dictionnaire/taxonomie-specimens',
    TaxonomieHote:        '/dictionnaire/taxonomie-hotes',
    TypeMethodeCollecte:  '/dictionnaire/types-methode',
    SolutionConservation: '/dictionnaire/solutions-conservation',
    TypeEnvironnement:    '/dictionnaire/types-environnement',
    TypeHabitat:          '/dictionnaire/types-habitat',
    User:                 '/utilisateurs',
  };
  return urls[entity] ?? null;
}

/** Formate une date en "Aujourd'hui à 14h32", "Hier à 09h15" ou date complète. */
export function formatRelativeDate(dateStr) {
  const date = new Date(dateStr);
  const now  = new Date();
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');

  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, now)) return `Aujourd'hui à ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return `Hier à ${time}`;

  return `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} à ${time}`;
}
