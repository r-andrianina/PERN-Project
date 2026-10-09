// Tests de l'identité d'une fiche Personnel — cas tirés de l'annuaire UEM 2026.
const { nettoyerNom, cleNom } = require('../../src/utils/personnelNom');

describe('utils/personnelNom', () => {
  describe('nettoyerNom', () => {
    it('supprime les espaces superflus, sans toucher à la casse', () => {
      expect(nettoyerNom('  Rico Andriniaina   RANDRENJARISON ')).toBe('Rico Andriniaina RANDRENJARISON');
    });

    it('tolère null et undefined', () => {
      expect(nettoyerNom(null)).toBe('');
      expect(nettoyerNom(undefined)).toBe('');
    });
  });

  describe('cleNom', () => {
    it("ignore l'ordre des mots (« NOM Prénom » contre « Prénom NOM »)", () => {
      expect(cleNom('MIARINJARA Adelaide')).toBe(cleNom('Adélaide MIARINJARA'));
    });

    it('ignore les accents et la casse', () => {
      expect(cleNom('Matéo JARRY')).toBe(cleNom('mateo jarry'));
    });

    it('ignore les espaces superflus', () => {
      expect(cleNom('Etienne  TATA ')).toBe(cleNom('Etienne TATA'));
    });

    it('distingue deux personnes de noms différents', () => {
      expect(cleNom('Michaël TANTELY')).not.toBe(cleNom('Michaël Luciano TANTELY'));
    });
  });
});
