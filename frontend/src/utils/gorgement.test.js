import { describe, it, expect } from 'vitest';
import { formatGorgement, GORGEMENT_LABELS, GORGEMENT_OPTIONS } from './gorgement';

describe('utils/gorgement', () => {
  it('formatGorgement traduit chaque code SOP connu (N/G/Gr/SGr/NC)', () => {
    expect(formatGorgement('N')).toBe('Non gorgé');
    expect(formatGorgement('G')).toBe('Gorgé');
    expect(formatGorgement('Gr')).toBe('Gravide');
    expect(formatGorgement('SGr')).toBe('Semi-gravide');
    expect(formatGorgement('NC')).toBe('Non collecté');
  });

  it('formatGorgement retourne le code brut si inconnu', () => {
    expect(formatGorgement('X')).toBe('X');
  });

  it('formatGorgement retourne "—" si aucun code', () => {
    expect(formatGorgement(null)).toBe('—');
    expect(formatGorgement(undefined)).toBe('—');
  });

  it('GORGEMENT_OPTIONS dérive exactement de GORGEMENT_LABELS (pas de désynchronisation)', () => {
    expect(GORGEMENT_OPTIONS.map((o) => o.value)).toEqual(Object.keys(GORGEMENT_LABELS));
    expect(GORGEMENT_OPTIONS.map((o) => o.label)).toEqual(Object.values(GORGEMENT_LABELS));
  });
});
