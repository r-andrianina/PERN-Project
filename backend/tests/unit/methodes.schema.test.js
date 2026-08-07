// Tests du schéma Zod methodes — enum interieur/exterieur, format datetime-local.
const schema = require('../../src/schemas/methodes.schema');

describe('schemas/methodes', () => {
  describe('createMethode', () => {
    it('accepte une méthode minimale valide', () => {
      const r = schema.createMethode.safeParse({ localiteId: 1, typeMethodeId: 2 });
      expect(r.success).toBe(true);
    });

    it('rejette localiteId ou typeMethodeId absents', () => {
      expect(schema.createMethode.safeParse({ typeMethodeId: 2 }).success).toBe(false);
      expect(schema.createMethode.safeParse({ localiteId: 1 }).success).toBe(false);
    });

    it('rejette interieurExterieur hors énumération', () => {
      const r = schema.createMethode.safeParse({ localiteId: 1, typeMethodeId: 2, interieurExterieur: 'dehors' });
      expect(r.success).toBe(false);
    });

    it("accepte interieur et exterieur", () => {
      expect(schema.createMethode.safeParse({ localiteId: 1, typeMethodeId: 2, interieurExterieur: 'interieur' }).success).toBe(true);
      expect(schema.createMethode.safeParse({ localiteId: 1, typeMethodeId: 2, interieurExterieur: 'exterieur' }).success).toBe(true);
    });

    it('valide le format datetime-local pour datePose (avec et sans secondes)', () => {
      expect(schema.createMethode.safeParse({ localiteId: 1, typeMethodeId: 2, datePose: '2026-01-15T08:30' }).success).toBe(true);
      expect(schema.createMethode.safeParse({ localiteId: 1, typeMethodeId: 2, datePose: '2026-01-15T08:30:00' }).success).toBe(true);
    });

    it('rejette un datePose mal formé', () => {
      expect(schema.createMethode.safeParse({ localiteId: 1, typeMethodeId: 2, datePose: '15/01/2026' }).success).toBe(false);
    });

    it('coerce latitude/longitude string → number', () => {
      const r = schema.createMethode.safeParse({ localiteId: 1, typeMethodeId: 2, latitude: '-18.9', longitude: '47.5' });
      expect(r.success).toBe(true);
      expect(r.data.latitude).toBe(-18.9);
      expect(r.data.longitude).toBe(47.5);
    });
  });

  describe('updateMethode', () => {
    it('rejette un objet vide (refine)', () => {
      expect(schema.updateMethode.safeParse({}).success).toBe(false);
    });

    it("n'accepte plus localiteId (omis)", () => {
      const r = schema.updateMethode.safeParse({ notes: 'test' });
      expect(r.success).toBe(true);
      expect(r.data.localiteId).toBeUndefined();
    });
  });
});
