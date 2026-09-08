import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatNotificationText, resolveEntityUrl, formatRelativeDate } from './notifications';

describe('utils/notifications — formatNotificationText', () => {
  it('phrase de base : auteur + verbe + entité nommée', () => {
    const item = {
      user: { prenom: 'Rindra', nom: 'R.' }, action: 'CREATE', entity: 'Projet', entityId: 5,
      newValues: { nom: 'Surveillance vecteurs' }, oldValues: {},
    };
    expect(formatNotificationText(item)).toBe('Rindra R. a créé le projet « Surveillance vecteurs »');
  });

  it('sans utilisateur → "Un utilisateur"', () => {
    const item = { user: null, action: 'DELETE', entity: 'Mission', entityId: 3, newValues: {}, oldValues: {} };
    expect(formatNotificationText(item)).toBe('Un utilisateur a supprimé la mission [ID: 3]');
  });

  it('sans nom/idTerrain disponible → fallback [ID: x]', () => {
    const item = { user: { prenom: 'A', nom: 'B' }, action: 'UPDATE', entity: 'Container', entityId: 9, newValues: {}, oldValues: {} };
    expect(formatNotificationText(item)).toBe('A B a modifié le container [ID: 9]');
  });

  it('action inconnue → verbe brut affiché tel quel (fallback)', () => {
    const item = { user: { prenom: 'A', nom: 'B' }, action: 'CUSTOM_ACTION', entity: 'User', entityId: 1, newValues: {}, oldValues: {} };
    expect(formatNotificationText(item)).toContain('CUSTOM_ACTION');
  });

  it('entité inconnue → nom brut de l\'entité affiché tel quel (fallback)', () => {
    const item = { user: { prenom: 'A', nom: 'B' }, action: 'CREATE', entity: 'EntiteInconnue', entityId: 1, newValues: {}, oldValues: {} };
    expect(formatNotificationText(item)).toContain('EntiteInconnue');
  });

  it('UPDATE GPS sur Localite : détecte un changement de coordonnées', () => {
    const item = {
      user: { prenom: 'A', nom: 'B' }, action: 'UPDATE', entity: 'Localite', entityId: 7,
      oldValues: { latitude: -18.9, longitude: 47.5 },
      newValues: { latitude: -18.91, longitude: 47.5 },
    };
    expect(formatNotificationText(item)).toBe('A B a modifié le point GPS [ID: 7] (Coordonnées GPS modifiées)');
  });

  it('UPDATE GPS sur MethodeCollecte : détecte un changement d\'altitude', () => {
    const item = {
      user: { prenom: 'A', nom: 'B' }, action: 'UPDATE', entity: 'MethodeCollecte', entityId: 2,
      oldValues: { altitudeM: 800 }, newValues: { altitudeM: 850 },
    };
    expect(formatNotificationText(item)).toBe('A B a modifié le point GPS [ID: 2] (Altitude modifiée de 800m à 850m)');
  });

  it('UPDATE avec champ métier changé (hors GPS) : signale le champ modifié', () => {
    const item = {
      user: { prenom: 'A', nom: 'B' }, action: 'UPDATE', entity: 'Projet', entityId: 4,
      oldValues: { nom: 'X', statut: 'actif' }, newValues: { nom: 'X', statut: 'termine' },
      // "statut" n'est pas dans FIELD_LABELS mais "actif" (le champ) l'est — on force via un champ suivi.
    };
    // Aucun champ suivi (FIELD_LABELS) n'a changé ici → pas de détail additionnel.
    expect(formatNotificationText(item)).toBe('A B a modifié le projet « X »');
  });

  it('UPDATE avec plusieurs champs suivis modifiés : "+N autre(s)"', () => {
    const item = {
      user: { prenom: 'A', nom: 'B' }, action: 'UPDATE', entity: 'Mission', entityId: 4,
      oldValues: { nom: 'X', notes: 'a', region: 'A' },
      newValues: { nom: 'X', notes: 'b', region: 'B' },
    };
    const text = formatNotificationText(item);
    expect(text).toContain('modifié, +1 autre(s)');
  });
});

describe('utils/notifications — resolveEntityUrl', () => {
  it('renvoie une URL de détail pour une entité connue (non delete)', () => {
    expect(resolveEntityUrl('Moustique', 12, 'UPDATE')).toBe('/specimens/moustiques/12');
    expect(resolveEntityUrl('Mission', 3, 'CREATE')).toBe('/missions/3');
  });

  it('sur DELETE, renvoie la liste plutôt que le détail (la fiche n\'existe plus)', () => {
    expect(resolveEntityUrl('Moustique', 12, 'DELETE')).toBe('/specimens/moustiques');
    expect(resolveEntityUrl('Hote', 1, 'DELETE')).toBe('/hotes');
  });

  it('entités sans page dédiée (Container/Méthode/Localité) renvoient vers /missions', () => {
    expect(resolveEntityUrl('Container', 1, 'UPDATE')).toBe('/missions');
    expect(resolveEntityUrl('MethodeCollecte', 1, 'UPDATE')).toBe('/missions');
    expect(resolveEntityUrl('Localite', 1, 'UPDATE')).toBe('/missions');
  });

  it('entité inconnue → null (pas de navigation possible)', () => {
    expect(resolveEntityUrl('EntiteInconnue', 1, 'UPDATE')).toBeNull();
  });
});

describe('utils/notifications — formatRelativeDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T14:32:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('même jour → "Aujourd\'hui à HHhMM"', () => {
    expect(formatRelativeDate('2026-07-30T09:05:00')).toBe("Aujourd'hui à 09h05");
  });

  it('veille → "Hier à HHhMM"', () => {
    expect(formatRelativeDate('2026-07-29T18:00:00')).toBe('Hier à 18h00');
  });

  it('plus ancien → date complète JJ/MM/AAAA à HHhMM', () => {
    expect(formatRelativeDate('2026-07-20T10:00:00')).toBe('20/07/2026 à 10h00');
  });
});

// Import Excel (2026-08-27) : une entrée d'audit = un lot importé dans une
// mission. entityId est l'id de la MISSION, pas d'un spécimen — le rendu
// générique aurait affiché "a créé ImportMoustiques [ID: 43]".
describe('utils/notifications — import Excel', () => {
  const base = {
    user: { prenom: 'Rindra', nom: 'R.' }, action: 'CREATE',
    entity: 'ImportMoustiques', entityId: 43, oldValues: {},
  };

  it('décrit le lot importé, la mission et le fichier', () => {
    expect(formatNotificationText({
      ...base,
      newValues: { importes: 2, ordreMission: 'OM-2024-001', fichier: 'collecte.xlsx' },
    })).toBe('Rindra R. a importé 2 moustiques dans la mission « OM-2024-001 » — fichier collecte.xlsx');
  });

  it('accorde le singulier et tolère un fichier absent', () => {
    expect(formatNotificationText({
      ...base, newValues: { importes: 1, ordreMission: 'OM-2024-001' },
    })).toBe('Rindra R. a importé 1 moustique dans la mission « OM-2024-001 »');
  });

  it('retombe sur l\'ID de mission si ordreMission manque', () => {
    expect(formatNotificationText({ ...base, newValues: { importes: 0 } }))
      .toBe('Rindra R. a importé 0 moustique dans la mission [ID: 43]');
  });

  it('pointe vers la mission concernée', () => {
    expect(resolveEntityUrl('ImportMoustiques', 43, 'CREATE')).toBe('/missions/43');
  });
});
