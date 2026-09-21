import { describe, it, expect } from 'vitest';
import { interpolate, t, translations } from './i18n';

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

// ---------------------------------------------------------------------------
// Parité FR / EN
//
// Rien ne la vérifiait, alors que l'application est bilingue et que le dico
// compte ~4000 lignes. Une clé ajoutée d'un seul côté ne casse rien : `t()`
// retombe sur la clé brute, donc l'utilisateur voit « analysesLabo.titre »
// s'afficher à l'écran au lieu d'un texte. Échec silencieux classique.
//
// Ce test a été ajouté après avoir vérifié cette parité à la main six fois au
// cours d'une même session.
describe('lib/i18n — parité des dictionnaires', () => {
  const chemins = (objet, prefixe = '') =>
    Object.entries(objet).flatMap(([cle, valeur]) =>
      valeur && typeof valeur === 'object' && !Array.isArray(valeur)
        ? chemins(valeur, `${prefixe}${cle}.`)
        : [`${prefixe}${cle}`]);

  const fr = chemins(translations.fr).sort();
  const en = chemins(translations.en).sort();

  it('déclare les deux langues', () => {
    expect(fr.length).toBeGreaterThan(500);
    expect(en.length).toBeGreaterThan(500);
  });

  it('aucune clé présente en français et absente en anglais', () => {
    expect(fr.filter((k) => !en.includes(k))).toEqual([]);
  });

  it('aucune clé présente en anglais et absente en français', () => {
    expect(en.filter((k) => !fr.includes(k))).toEqual([]);
  });

  it('aucune valeur vide', () => {
    // Une chaîne vide s'affiche comme un blanc, ce qui ressemble à un défaut
    // de mise en page plutôt qu'à une traduction manquante.
    const vides = [...Object.entries(translations)].flatMap(([lang, dico]) =>
      chemins(dico).filter((k) => {
        const val = k.split('.').reduce((o, p) => o?.[p], dico);
        return typeof val === 'string' && val.trim() === '';
      }).map((k) => `${lang}:${k}`));
    expect(vides).toEqual([]);
  });
});
