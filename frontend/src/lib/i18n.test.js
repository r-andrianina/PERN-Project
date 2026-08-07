import { describe, it, expect } from 'vitest';
import { interpolate, t } from './i18n';

describe('lib/i18n — interpolate', () => {
  it('remplace un placeholder simple', () => {
    expect(interpolate('{n} spécimen(s)', { n: 5 })).toBe('5 spécimen(s)');
  });

  it('remplace plusieurs placeholders distincts', () => {
    expect(interpolate('{a} et {b}', { a: 'X', b: 'Y' })).toBe('X et Y');
  });

  it('remplace toutes les occurrences du même placeholder (replaceAll)', () => {
    expect(interpolate('{n}/{n}', { n: 3 })).toBe('3/3');
  });

  it('laisse un placeholder non fourni tel quel', () => {
    expect(interpolate('{n} sur {total}', { n: 2 })).toBe('2 sur {total}');
  });

  it('sans variable fournie, retourne la chaîne inchangée', () => {
    expect(interpolate('Aucun placeholder')).toBe('Aucun placeholder');
  });

  it('accepte un nombre 0 (ne doit pas être traité comme falsy/absent)', () => {
    expect(interpolate('{n} résultat(s)', { n: 0 })).toBe('0 résultat(s)');
  });
});

describe('lib/i18n — t() standalone (hors composant)', () => {
  it('résout une clé imbriquée existante', () => {
    expect(t('common.loading', 'fr')).toBe('Chargement…');
    expect(t('common.loading', 'en')).toBe('Loading…');
  });

  it('retourne la clé brute si introuvable (comportement de repli)', () => {
    expect(t('namespace.inexistant', 'fr')).toBe('namespace.inexistant');
  });

  it('retombe sur en si la langue est inconnue', () => {
    expect(t('common.loading', 'mg')).toBe(t('common.loading', 'en'));
  });
});
