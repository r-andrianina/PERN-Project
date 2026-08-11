// Tests du schéma Zod taxonomie-hotes — bornes de longueur, enums, coercition
// parentId, et la distinction '' → null vs undefined préservé (un update sans
// parentId ne doit PAS déplacer le nœud à la racine).
const schema = require('../../src/schemas/taxonomieHotes.schema');

describe('schemas/taxonomieHotes', () => {
  describe('createTaxonomieHote', () => {
    it('accepte une entrée minimale valide (niveau + nom)', () => {
      const r = schema.createTaxonomieHote.safeParse({ niveau: 'genre', nom: 'Rattus' });
      expect(r.success).toBe(true);
    });

    it('rejette un niveau invalide', () => {
      expect(schema.createTaxonomieHote.safeParse({ niveau: 'royaume', nom: 'X' }).success).toBe(false);
    });

    it('rejette un nom absent, vide ou uniquement des espaces', () => {
      expect(schema.createTaxonomieHote.safeParse({ niveau: 'genre' }).success).toBe(false);
      expect(schema.createTaxonomieHote.safeParse({ niveau: 'genre', nom: '' }).success).toBe(false);
      expect(schema.createTaxonomieHote.safeParse({ niveau: 'genre', nom: '   ' }).success).toBe(false);
    });

    it('trim le nom', () => {
      const r = schema.createTaxonomieHote.safeParse({ niveau: 'genre', nom: '  Rattus  ' });
      expect(r.success).toBe(true);
      expect(r.data.nom).toBe('Rattus');
    });

    it('borne nom à 150 caractères (→ 400 plutôt que 500 P2000)', () => {
      const long = 'x'.repeat(151);
      expect(schema.createTaxonomieHote.safeParse({ niveau: 'genre', nom: long }).success).toBe(false);
    });

    it('coerce parentId chaîne → nombre', () => {
      const r = schema.createTaxonomieHote.safeParse({ niveau: 'espece', nom: 'norvegicus', parentId: '3' });
      expect(r.success).toBe(true);
      expect(r.data.parentId).toBe(3);
    });

    it('traite parentId chaîne vide comme null (pas de parent)', () => {
      const r = schema.createTaxonomieHote.safeParse({ niveau: 'ordre', nom: 'Rodentia', parentId: '' });
      expect(r.success).toBe(true);
      expect(r.data.parentId).toBeNull();
    });
  });

  describe('updateTaxonomieHote', () => {
    it('rejette un update vide (aucune modification)', () => {
      expect(schema.updateTaxonomieHote.safeParse({}).success).toBe(false);
    });

    it('accepte un update partiel', () => {
      const r = schema.updateTaxonomieHote.safeParse({ nom: 'Mus' });
      expect(r.success).toBe(true);
    });

    it('CRITIQUE : parentId absent reste undefined (ne PAS déplacer à la racine)', () => {
      const r = schema.updateTaxonomieHote.safeParse({ nom: 'Mus' });
      expect(r.success).toBe(true);
      expect(r.data.parentId).toBeUndefined();
    });

    it('parentId chaîne vide ou null → null (déplacement explicite à la racine)', () => {
      const empty = schema.updateTaxonomieHote.safeParse({ parentId: '' });
      expect(empty.success).toBe(true);
      expect(empty.data.parentId).toBeNull();

      const nul = schema.updateTaxonomieHote.safeParse({ parentId: null });
      expect(nul.success).toBe(true);
      expect(nul.data.parentId).toBeNull();
    });
  });
});
