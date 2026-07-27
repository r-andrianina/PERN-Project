// frontend/src/lib/i18n.js
// Dictionnaire FR/EN + hook useT()
// Usage : const t = useT(); t('nav.dashboard') → 'Tableau de bord' | 'Dashboard'

import useLangStore from '../store/languageStore';

export const translations = {
  fr: {
    nav: {
      dashboard:    'Tableau de bord',
      explorer:     'Explorer',
      carte:        'Carte',
      projets:      'Projets',
      missions:     'Missions',
      hotes:        'Hôtes',
      dictionnaire: 'Dictionnaire',
      import:       'Import Excel',
      utilisateurs: 'Utilisateurs',
      presence:     'Surveillance',
      specimens:    'Spécimens',
      moustiques:   'Moustiques',
      tiques:       'Tiques',
      puces:        'Puces',
      admin:        'Administration',
    },
    topbar: {
      connected: 'Connecté',
      search:    'Recherche rapide…  Ctrl+K',
      searchPlaceholder: 'Rechercher un spécimen, mission, projet…',
      noResults: 'Aucun résultat',
      scopeAll:  'Tous',
      specimens: 'Spécimens',
      missions:  'Missions',
      projets:   'Projets',
      pressEsc:  'Appuyez sur Échap pour fermer',
    },
    common: {
      add:     'Ajouter',
      edit:    'Modifier',
      delete:  'Supprimer',
      save:    'Enregistrer',
      cancel:  'Annuler',
      loading: 'Chargement…',
      logout:  'Déconnexion',
      export:  'Export',
      seeAll:  'Voir tout',
    },
    footer: {
      subtitle:   'Unité Entomologie Médicale (UEM)',
      institute:  'Institut Pasteur de Madagascar',
      rights:     'Tous droits réservés',
      restricted: 'Données de recherche scientifique — Accès restreint',
      version:    'Version',
    },
    sidebar: {
      subtitle: 'Unité Entomologie Médicale (UEM)',
    },
  },
  en: {
    nav: {
      dashboard:    'Dashboard',
      explorer:     'Explorer',
      carte:        'Map',
      projets:      'Projects',
      missions:     'Missions',
      hotes:        'Hosts',
      dictionnaire: 'Dictionary',
      import:       'Excel Import',
      utilisateurs: 'Users',
      presence:     'Monitoring',
      specimens:    'Specimens',
      moustiques:   'Mosquitoes',
      tiques:       'Ticks',
      puces:        'Fleas',
      admin:        'Administration',
    },
    topbar: {
      connected: 'Connected',
      search:    'Quick search…  Ctrl+K',
      searchPlaceholder: 'Search specimen, mission, project…',
      noResults: 'No results found',
      scopeAll:  'All',
      specimens: 'Specimens',
      missions:  'Missions',
      projets:   'Projects',
      pressEsc:  'Press Escape to close',
    },
    common: {
      add:     'Add',
      edit:    'Edit',
      delete:  'Delete',
      save:    'Save',
      cancel:  'Cancel',
      loading: 'Loading…',
      logout:  'Logout',
      export:  'Export',
      seeAll:  'See all',
    },
    footer: {
      subtitle:   'Medical Entomology Unit (MEU)',
      institute:  'Institut Pasteur de Madagascar',
      rights:     'All rights reserved',
      restricted: 'Scientific research data — Restricted access',
      version:    'Version',
    },
    sidebar: {
      subtitle: 'Medical Entomology Unit (MEU)',
    },
  },
};

// Hook principal
export function useT() {
  const { lang } = useLangStore();
  return (key) => {
    const parts = key.split('.');
    let val = translations[lang] ?? translations.fr;
    for (const part of parts) val = val?.[part];
    return val ?? key;
  };
}

// Utilitaire hors composant (pour les modules non-React)
export function t(key, lang = 'fr') {
  const parts = key.split('.');
  let val = translations[lang] ?? translations.fr;
  for (const part of parts) val = val?.[part];
  return val ?? key;
}
