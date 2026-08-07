import { describe, it, expect } from 'vitest';
import { formatStade, STADE_LABELS, STADE_OPTIONS_MOUSTIQUE, STADE_OPTIONS_TIQUE } from './stade';

describe('utils/stade', () => {
  it('formatStade traduit chaque code connu', () => {
    expect(formatStade('E')).toBe('Œuf');
    expect(formatStade('L')).toBe('Larve');
    expect(formatStade('N')).toBe('Nymphe');
    expect(formatStade('A')).toBe('Adulte');
  });

  it('formatStade retourne le code brut si inconnu', () => {
    expect(formatStade('X')).toBe('X');
  });

  it('formatStade retourne "—" si null/undefined (?? ne couvre pas la chaîne vide)', () => {
    expect(formatStade(null)).toBe('—');
    expect(formatStade(undefined)).toBe('—');
  });

  it('formatStade retourne une chaîne vide telle quelle (pas nullish)', () => {
    expect(formatStade('')).toBe('');
  });

  it('les options moustique couvrent les 4 stades de STADE_LABELS', () => {
    const values = STADE_OPTIONS_MOUSTIQUE.map((o) => o.value).sort();
    expect(values).toEqual(Object.keys(STADE_LABELS).sort());
  });

  it('les options tique excluent Œuf (E) — pas de stade œuf collecté sur tique', () => {
    const values = STADE_OPTIONS_TIQUE.map((o) => o.value);
    expect(values).not.toContain('E');
    expect(values).toEqual(['A', 'N', 'L']);
  });
});
