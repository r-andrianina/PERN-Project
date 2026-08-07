// Tests du schéma Zod taxonomie-specimens — bornes de longueur, enums,
// coercition annee/parentId, et surtout la distinction '' → null vs undefined
// préservé (un update sans parentId ne doit PAS déplacer le nœud à la racine).
const schema = require('../../src/schemas/taxonomieSpecimens.schema');

describe('schemas/taxonomieSpecimens', () => {
  describe('createTaxonomieSpecimen', () => {
    it('accepte une entrée minimale valide (niveau + nom)', () => {
      const r = schema.createTaxonomieSpecimen.safeParse({ niveau: 'genre', nom: 'Anopheles' });
      expect(r.success).toBe(true);
    });

    it('rejette un niveau invalide', () => {
      expect(schema.createTaxonomieSpecimen.safeParse({ niveau: 'royaume', nom: 'X' }).success).toBe(false);
    });

    it('rejette un nom absent, vide ou uniquement des espaces', () => {
      expect(schema.createTaxonomieSpecimen.safeParse({ niveau: 'genre' }).success).toBe(false);
      expect(schema.createTaxonomieSpecimen.safeParse({ niveau: 'genre', nom: '' }).success).toBe(false);
      expect(schema.createTaxonomieSpecimen.safeParse({ niveau: 'genre', nom: '   ' }).success).toBe(false);
    });

    it('trim le nom', () => {
      const r = schema.createTaxonomieSpecimen.safeParse({ niveau: 'genre', nom: '  Aedes  ' });
      expect(r.success).toBe(true);
      expect(r.data.nom).toBe('Aedes');
    });

    it('borne nom et paysType à 150 caractères (→ 400 plutôt que 500 P2000)', () => {
      const long = 'x'.repeat(151);
      expect(schema.createTaxonomieSpecimen.safeParse({ niveau: 'genre', nom: long }).success).toBe(false);
      expect(schema.createTaxonomieSpecimen.safeParse({ niveau: 'genre', nom: 'Ok', paysType: long }).success).toBe(false);
    });

    it('coerce parentId chaîne → nombre', () => {
      const r = schema.createTaxonomieSpecimen.safeParse({ niveau: 'espece', nom: 'gambiae', parentId: '42' });
      expect(r.success).toBe(true);
      expect(r.data.parentId).toBe(42);
    });

    it('traite parentId chaîne vide comme null (pas de parent)', () => {
      const r = schema.createTaxonomieSpecimen.safeParse({ niveau: 'ordre', nom: 'Diptera', parentId: '' });
      expect(r.success).toBe(true);
      expect(r.data.parentId).toBeNull();
    });

    it('coerce et borne annee ; rejette hors 1700–2100', () => {
      const ok = schema.createTaxonomieSpecimen.safeParse({ niveau: 'espece', nom: 'gambiae', annee: '1998' });
      expect(ok.success).toBe(true);
      expect(ok.data.annee).toBe(1998);
      expect(schema.createTaxonomieSpecimen.safeParse({ niveau: 'espece', nom: 'x', annee: 1500 }).success).toBe(false);
      expect(schema.createTaxonomieSpecimen.safeParse({ niveau: 'espece', nom: 'x', annee: 'abcd' }).success).toBe(false);
    });

    it('annee chaîne vide → null', () => {
      const r = schema.createTaxonomieSpecimen.safeParse({ niveau: 'espece', nom: 'x', annee: '' });
      expect(r.success).toBe(true);
      expect(r.data.annee).toBeNull();
    });

    it('rejette un type hors enum', () => {
      expect(schema.createTaxonomieSpecimen.safeParse({ niveau: 'ordre', nom: 'X', type: 'oiseau' }).success).toBe(false);
      expect(schema.createTaxonomieSpecimen.safeParse({ niveau: 'ordre', nom: 'X', type: 'autre' }).success).toBe(true);
    });
  });

  describe('updateTaxonomieSpecimen', () => {
    it('rejette un update vide (aucune modification)', () => {
      expect(schema.updateTaxonomieSpecimen.safeParse({}).success).toBe(false);
    });

    it('accepte un update partiel', () => {
      const r = schema.updateTaxonomieSpecimen.safeParse({ nom: 'Culex' });
      expect(r.success).toBe(true);
    });

    it('CRITIQUE : parentId absent reste undefined (ne PAS déplacer à la racine)', () => {
      const r = schema.updateTaxonomieSpecimen.safeParse({ nom: 'Culex' });
      expect(r.success).toBe(true);
      expect(r.data.parentId).toBeUndefined();
    });

    it('parentId chaîne vide ou null → null (déplacement explicite à la racine)', () => {
      const empty = schema.updateTaxonomieSpecimen.safeParse({ parentId: '' });
      expect(empty.success).toBe(true);
      expect(empty.data.parentId).toBeNull();

      const nul = schema.updateTaxonomieSpecimen.safeParse({ parentId: null });
      expect(nul.success).toBe(true);
      expect(nul.data.parentId).toBeNull();
    });
  });
});
