// Présentation taxonomique côté backend (exports + API recherche).
// Doit rester le MIROIR EXACT de frontend/src/utils/taxoLabel.js — les deux
// avaient divergé, chacune avec son propre bug sur le sous-genre.
const { decomposeTaxon, libelleTaxonomie } = require('../../src/utils/taxonomyResolve');

describe('taxonomyResolve/decomposeTaxon', () => {
  it('espece sous un genre direct', () => {
    const n = { niveau: 'espece', nom: 'gambiae', parent: { niveau: 'genre', nom: 'Anopheles' } };
    expect(decomposeTaxon(n)).toEqual({ genre: 'Anopheles', espece: 'gambiae' });
    expect(libelleTaxonomie(n)).toBe('Anopheles gambiae');
  });

  // Régression 2026-09-01 : 412 des 475 moustiques passent par un sous-genre.
  // L'export produisait "mariae" (genre perdu) ; le miroir frontend affichait
  // "Acartomyia mariae" (sous-genre pris pour le genre) sur 179 spécimens.
  it('remonte au genre à travers un sous-genre, sans le restituer', () => {
    const n = {
      niveau: 'espece', nom: 'mariae',
      parent: {
        niveau: 'sous_genre', nom: 'Acartomyia',
        parent: { niveau: 'genre', nom: 'Aedes', parent: { niveau: 'sous_famille', nom: 'Culicinae' } },
      },
    };
    expect(decomposeTaxon(n)).toEqual({ genre: 'Aedes', espece: 'mariae' });
    expect(libelleTaxonomie(n)).toBe('Aedes mariae');
    expect(libelleTaxonomie(n)).not.toContain('Acartomyia');
  });

  it('sous-genre homonyme du genre : pas de duplication', () => {
    const n = {
      niveau: 'espece', nom: 'africana',
      parent: { niveau: 'sous_genre', nom: 'Aedeomyia', parent: { niveau: 'genre', nom: 'Aedeomyia' } },
    };
    expect(libelleTaxonomie(n)).toBe('Aedeomyia africana');
  });

  it('sous_espece : épithète accolée à l\'espèce, genre retrouvé sur 4 niveaux', () => {
    const n = {
      niveau: 'sous_espece', nom: 'xyz',
      parent: {
        niveau: 'espece', nom: 'mariae',
        parent: { niveau: 'sous_genre', nom: 'Acartomyia', parent: { niveau: 'genre', nom: 'Aedes' } },
      },
    };
    expect(decomposeTaxon(n)).toEqual({ genre: 'Aedes', espece: 'mariae xyz' });
  });

  it('identification au genre seul : espèce nulle, pas le nom du parent', () => {
    const n = { niveau: 'genre', nom: 'Eretmapodites', parent: { niveau: 'sous_famille', nom: 'Culicinae' } };
    expect(decomposeTaxon(n)).toEqual({ genre: 'Eretmapodites', espece: null });
    expect(libelleTaxonomie(n)).toBe('Eretmapodites');
  });

  it('taxon au-dessus du genre : exposé plutôt que perdu', () => {
    expect(decomposeTaxon({ niveau: 'famille', nom: 'Culicidae' }))
      .toEqual({ genre: 'Culicidae', espece: null });
  });

  it('nœud absent', () => {
    expect(decomposeTaxon(null)).toEqual({ genre: null, espece: null });
    expect(libelleTaxonomie(null)).toBeNull();
  });

  it('libelleTaxonomie dérive strictement de decomposeTaxon', () => {
    const cas = [
      { niveau: 'espece', nom: 'mariae', parent: { niveau: 'sous_genre', nom: 'Acartomyia', parent: { niveau: 'genre', nom: 'Aedes' } } },
      { niveau: 'genre', nom: 'Culex' },
      { niveau: 'famille', nom: 'Culicidae' },
    ];
    for (const n of cas) {
      const { genre, espece } = decomposeTaxon(n);
      expect(libelleTaxonomie(n)).toBe([genre, espece].filter(Boolean).join(' '));
    }
  });
});
