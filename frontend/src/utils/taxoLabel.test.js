import { describe, it, expect } from 'vitest';
import { taxoLabel } from './taxoLabel';

describe('utils/taxoLabel', () => {
  it('retourne une chaîne vide si aucun nœud', () => {
    expect(taxoLabel(null)).toBe('');
    expect(taxoLabel(undefined)).toBe('');
  });

  it('espece → "Genre espece"', () => {
    const node = { niveau: 'espece', nom: 'gambiae', parent: { nom: 'Anopheles' } };
    expect(taxoLabel(node)).toBe('Anopheles gambiae');
  });

  it('espece sans parent chargé → juste le nom, trim propre', () => {
    const node = { niveau: 'espece', nom: 'gambiae', parent: null };
    expect(taxoLabel(node)).toBe('gambiae');
  });

  it('sous_espece → "Genre espece sous" (3 niveaux)', () => {
    const node = {
      niveau: 'sous_espece', nom: 'arabiensis',
      parent: { nom: 'gambiae', parent: { nom: 'Anopheles' } },
    };
    expect(taxoLabel(node)).toBe('Anopheles gambiae arabiensis');
  });

  it('genre (ou autre niveau) → juste le nom, sans le parent (pas de "Anophelinae Anopheles")', () => {
    const node = { niveau: 'genre', nom: 'Anopheles', parent: { nom: 'Anophelinae' } };
    expect(taxoLabel(node)).toBe('Anopheles');
  });

  it('famille sans parent → juste le nom', () => {
    const node = { niveau: 'famille', nom: 'Culicidae' };
    expect(taxoLabel(node)).toBe('Culicidae');
  });
});
