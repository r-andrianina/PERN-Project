// Tests du schéma Zod hotes — dont la régression Zod v4 sur "sexe" (défaut
// réinjecté par .partial() sur un champ .default() si le workaround casse).
const schema = require('../../src/schemas/hotes.schema');

describe('schemas/hotes', () => {
  describe('createHote', () => {
    it('accepte un hôte minimal valide', () => {
      const r = schema.createHote.safeParse({ methodeId: 1, taxonomieHoteId: 2 });
      expect(r.success).toBe(true);
    });

    it('applique le défaut sexe="inconnu" à la création', () => {
      const r = schema.createHote.safeParse({ methodeId: 1, taxonomieHoteId: 2 });
      expect(r.success).toBe(true);
      expect(r.data.sexe).toBe('inconnu');
    });

    it('rejette methodeId ou taxonomieHoteId absents', () => {
      expect(schema.createHote.safeParse({ taxonomieHoteId: 2 }).success).toBe(false);
      expect(schema.createHote.safeParse({ methodeId: 1 }).success).toBe(false);
    });

    it('rejette un sexe hors énumération', () => {
      expect(schema.createHote.safeParse({ methodeId: 1, taxonomieHoteId: 2, sexe: 'X' }).success).toBe(false);
    });

    it('accepte M et F', () => {
      expect(schema.createHote.safeParse({ methodeId: 1, taxonomieHoteId: 2, sexe: 'M' }).success).toBe(true);
      expect(schema.createHote.safeParse({ methodeId: 1, taxonomieHoteId: 2, sexe: 'F' }).success).toBe(true);
    });
  });

  describe('updateHote — régression Zod v4 (.omit().partial() + .default())', () => {
    it('ne réinjecte PAS sexe="inconnu" sur une mise à jour partielle ne le touchant pas', () => {
      const r = schema.updateHote.safeParse({ etatSante: 'Bon' });
      expect(r.success).toBe(true);
      expect(r.data.sexe).toBeUndefined();
    });

    it('accepte explicitement de changer sexe', () => {
      const r = schema.updateHote.safeParse({ sexe: 'M' });
      expect(r.success).toBe(true);
      expect(r.data.sexe).toBe('M');
    });

    it('rejette un objet vide (refine)', () => {
      expect(schema.updateHote.safeParse({}).success).toBe(false);
    });

    it("n'accepte plus methodeId/taxonomieHoteId (omis)", () => {
      const r = schema.updateHote.safeParse({ notes: 'test' });
      expect(r.success).toBe(true);
      expect(r.data.methodeId).toBeUndefined();
      expect(r.data.taxonomieHoteId).toBeUndefined();
    });
  });
});
