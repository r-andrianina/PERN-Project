// Tests de l'identité d'une fiche Personnel — cas tirés de l'annuaire UEM 2026.
const { nettoyerNom, cleNom, nomInclus } = require('../../src/utils/personnelNom');

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

  describe('nomInclus', () => {
    it("rapproche un compte repris de son nom complet dans l'annuaire", () => {
      // Le cas qui a produit un doublon en base de dev le 2026-10-09.
      expect(nomInclus('Henintsoa Andrianina', 'RAZANAKOTO Henintsoa Andrianina')).toBe(true);
      expect(nomInclus('Michaël TANTELY', 'Michaël Luciano TANTELY')).toBe(true);
    });

    it("ignore accents, casse et ordre des mots, comme cleNom", () => {
      expect(nomInclus('tantely michael', 'Michaël Luciano TANTELY')).toBe(true);
    });

    it('compare des mots entiers, jamais des morceaux de mot', () => {
      expect(nomInclus('Henintsoa Andrianina', 'Mihajatiana Henintsoanirina RAKOTOMALALA')).toBe(false);
    });

    it("n'est pas symétrique : le nom long n'est pas inclus dans le court", () => {
      expect(nomInclus('RAZANAKOTO Henintsoa Andrianina', 'Henintsoa Andrianina')).toBe(false);
    });

    it('un nom identique ne relève pas du rapprochement (cleNom suffit)', () => {
      expect(nomInclus('Etienne TATA', 'TATA Etienne')).toBe(false);
    });

    it("un seul mot ne suffit jamais à identifier quelqu'un", () => {
      expect(nomInclus('TANTELY', 'Michaël Luciano TANTELY')).toBe(false);
    });

    it("refuse dès qu'un mot du nom court manque au long", () => {
      expect(nomInclus('Michaël RABE', 'Michaël Luciano TANTELY')).toBe(false);
    });
  });
});
