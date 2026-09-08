import { describe, it, expect } from 'vitest';
import { taxoLabel, decomposeTaxon } from './taxoLabel';

// Les fixtures portent toutes `niveau` à chaque niveau de la chaîne, comme les
// payloads réels de l'API. Les anciennes fixtures l'omettaient sur les parents —
// c'est précisément pourquoi elles ne détectaient pas le bug du sous-genre.

describe('utils/taxoLabel', () => {
  it('retourne une chaîne vide si aucun nœud', () => {
    expect(taxoLabel(null)).toBe('');
    expect(taxoLabel(undefined)).toBe('');
  });

  it('espece → "Genre espece"', () => {
    const node = { niveau: 'espece', nom: 'gambiae', parent: { niveau: 'genre', nom: 'Anopheles' } };
    expect(taxoLabel(node)).toBe('Anopheles gambiae');
  });

  it('espece sans parent chargé → juste le nom, trim propre', () => {
    const node = { niveau: 'espece', nom: 'gambiae', parent: null };
    expect(taxoLabel(node)).toBe('gambiae');
  });

  it('sous_espece → "Genre espece sous" (3 niveaux)', () => {
    const node = {
      niveau: 'sous_espece', nom: 'arabiensis',
      parent: { niveau: 'espece', nom: 'gambiae', parent: { niveau: 'genre', nom: 'Anopheles' } },
    };
    expect(taxoLabel(node)).toBe('Anopheles gambiae arabiensis');
  });

  it('genre (ou autre niveau) → juste le nom, sans le parent (pas de "Anophelinae Anopheles")', () => {
    const node = { niveau: 'genre', nom: 'Anopheles', parent: { niveau: 'sous_famille', nom: 'Anophelinae' } };
    expect(taxoLabel(node)).toBe('Anopheles');
  });

  it('famille sans parent → juste le nom', () => {
    const node = { niveau: 'famille', nom: 'Culicidae' };
    expect(taxoLabel(node)).toBe('Culicidae');
  });
});

// Régression 2026-09-01 : 412 des 475 moustiques ont une espèce rattachée à un
// SOUS-GENRE. L'ancienne version prenait le parent direct pour le genre et
// produisait un nom faux mais plausible ("Acartomyia mariae" au lieu de
// "Aedes mariae") sur 179 spécimens. Le sous-genre n'est pas restitué.
describe('utils/taxoLabel — sous-genre intermédiaire', () => {
  const mariae = {
    niveau: 'espece', nom: 'mariae',
    parent: {
      niveau: 'sous_genre', nom: 'Acartomyia',
      parent: { niveau: 'genre', nom: 'Aedes', parent: { niveau: 'sous_famille', nom: 'Culicinae' } },
    },
  };

  it('remonte au vrai genre et ignore le sous-genre', () => {
    expect(taxoLabel(mariae)).toBe('Aedes mariae');
    expect(decomposeTaxon(mariae)).toEqual({ genre: 'Aedes', espece: 'mariae' });
  });

  it('n\'affiche jamais le sous-genre comme genre', () => {
    expect(taxoLabel(mariae)).not.toContain('Acartomyia');
  });

  it('gère le sous-genre homonyme du genre sans le dupliquer', () => {
    const africana = {
      niveau: 'espece', nom: 'africana',
      parent: {
        niveau: 'sous_genre', nom: 'Aedeomyia',
        parent: { niveau: 'genre', nom: 'Aedeomyia' },
      },
    };
    expect(taxoLabel(africana)).toBe('Aedeomyia africana');
  });

  it('sous_espece sous un sous-genre remonte aussi au genre (4 niveaux)', () => {
    const node = {
      niveau: 'sous_espece', nom: 'xyz',
      parent: {
        niveau: 'espece', nom: 'mariae',
        parent: { niveau: 'sous_genre', nom: 'Acartomyia', parent: { niveau: 'genre', nom: 'Aedes' } },
      },
    };
    expect(decomposeTaxon(node)).toEqual({ genre: 'Aedes', espece: 'mariae xyz' });
  });
});

describe('utils/taxoLabel — decomposeTaxon', () => {
  it('sépare genre et espèce pour les colonnes du tableau', () => {
    expect(decomposeTaxon({ niveau: 'genre', nom: 'Eretmapodites', parent: { niveau: 'sous_famille', nom: 'Culicinae' } }))
      .toEqual({ genre: 'Eretmapodites', espece: null });
  });

  it('nœud absent → deux valeurs nulles', () => {
    expect(decomposeTaxon(null)).toEqual({ genre: null, espece: null });
  });

  it('taxon au-dessus du genre → exposé dans genre, jamais perdu', () => {
    expect(decomposeTaxon({ niveau: 'famille', nom: 'Culicidae' }))
      .toEqual({ genre: 'Culicidae', espece: null });
  });
});
