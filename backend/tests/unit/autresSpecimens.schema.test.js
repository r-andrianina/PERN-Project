// Tests du schéma Zod autresSpecimens (Phlébotomes, Culicoïdes, etc.) — dont
// la régression Zod v4 sur sexe/nombre.
const schema = require('../../src/schemas/autresSpecimens.schema');

describe('schemas/autresSpecimens', () => {
  describe('createAutreSpecimen', () => {
    it('accepte un spécimen minimal valide', () => {
      const r = schema.createAutreSpecimen.safeParse({ methodeId: 1, typeSpecimenId: 2 });
      expect(r.success).toBe(true);
    });

    it('applique les défauts (nombre=1, sexe=inconnu)', () => {
      const r = schema.createAutreSpecimen.safeParse({ methodeId: 1, typeSpecimenId: 2 });
      expect(r.data.nombre).toBe(1);
      expect(r.data.sexe).toBe('inconnu');
    });

    it('rejette methodeId ou typeSpecimenId absents', () => {
      expect(schema.createAutreSpecimen.safeParse({ typeSpecimenId: 2 }).success).toBe(false);
      expect(schema.createAutreSpecimen.safeParse({ methodeId: 1 }).success).toBe(false);
    });

    it('taxonomieId reste optionnel (contrairement aux 3 types principaux)', () => {
      const r = schema.createAutreSpecimen.safeParse({ methodeId: 1, typeSpecimenId: 2 });
      expect(r.success).toBe(true);
    });

    it('accepte un objet attributs libre (record)', () => {
      const r = schema.createAutreSpecimen.safeParse({
        methodeId: 1, typeSpecimenId: 2, attributs: { longueur_mm: 3.2, couleur: 'brun' },
      });
      expect(r.success).toBe(true);
      expect(r.data.attributs).toEqual({ longueur_mm: 3.2, couleur: 'brun' });
    });
  });

  describe('updateAutreSpecimen — régression Zod v4', () => {
    it('ne réinjecte pas sexe/nombre par défaut sur une maj partielle', () => {
      const r = schema.updateAutreSpecimen.safeParse({ notes: 'x' });
      expect(r.success).toBe(true);
      expect(r.data.sexe).toBeUndefined();
      expect(r.data.nombre).toBeUndefined();
    });

    it("n'accepte plus methodeId (omis)", () => {
      const r = schema.updateAutreSpecimen.safeParse({ notes: 'x' });
      expect(r.data.methodeId).toBeUndefined();
    });

    it('rejette un objet vide (refine)', () => {
      expect(schema.updateAutreSpecimen.safeParse({}).success).toBe(false);
    });
  });
});
