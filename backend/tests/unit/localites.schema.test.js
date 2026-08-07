// Tests du schéma Zod localites — dont la régression Zod v4 sur "pays" (défaut
// réinjecté par .partial() sur un champ .default() si le workaround casse).
const schema = require('../../src/schemas/localites.schema');

describe('schemas/localites', () => {
  describe('createLocalite', () => {
    it('accepte une localité minimale valide', () => {
      const r = schema.createLocalite.safeParse({ missionId: 1, nom: 'Ambohimanga' });
      expect(r.success).toBe(true);
    });

    it('applique le défaut pays = Madagascar à la création', () => {
      const r = schema.createLocalite.safeParse({ missionId: 1, nom: 'Ambohimanga' });
      expect(r.success).toBe(true);
      expect(r.data.pays).toBe('Madagascar');
    });

    it('rejette un code localité qui ne fait pas 3 lettres majuscules', () => {
      expect(schema.createLocalite.safeParse({ missionId: 1, nom: 'X', code: 'ab' }).success).toBe(false);
      expect(schema.createLocalite.safeParse({ missionId: 1, nom: 'X', code: 'ABCD' }).success).toBe(false);
      expect(schema.createLocalite.safeParse({ missionId: 1, nom: 'X', code: 'abc' }).success).toBe(false);
    });

    it('accepte un code localité valide (3 lettres majuscules)', () => {
      expect(schema.createLocalite.safeParse({ missionId: 1, nom: 'X', code: 'ABC' }).success).toBe(true);
    });

    it('rejette nom absent', () => {
      expect(schema.createLocalite.safeParse({ missionId: 1 }).success).toBe(false);
    });

    it('valide un tableau de contacts', () => {
      const r = schema.createLocalite.safeParse({
        missionId: 1, nom: 'X',
        contacts: [{ nom: 'Rakoto', telephone: '032...' }],
      });
      expect(r.success).toBe(true);
    });

    it('rejette un contact sans nom', () => {
      const r = schema.createLocalite.safeParse({
        missionId: 1, nom: 'X',
        contacts: [{ telephone: '032...' }],
      });
      expect(r.success).toBe(false);
    });
  });

  describe('updateLocalite — régression Zod v4 (.omit().partial() + .default())', () => {
    it('ne réinjecte PAS pays="Madagascar" sur une mise à jour partielle ne le touchant pas', () => {
      const r = schema.updateLocalite.safeParse({ region: 'Analamanga' });
      expect(r.success).toBe(true);
      expect(r.data.pays).toBeUndefined();
    });

    it('accepte explicitement de changer pays', () => {
      const r = schema.updateLocalite.safeParse({ pays: 'Comores' });
      expect(r.success).toBe(true);
      expect(r.data.pays).toBe('Comores');
    });

    it('rejette un objet vide (refine)', () => {
      expect(schema.updateLocalite.safeParse({}).success).toBe(false);
    });

    it("n'accepte plus missionId (omis)", () => {
      const r = schema.updateLocalite.safeParse({ nom: 'Nouveau nom' });
      expect(r.success).toBe(true);
      expect(r.data.missionId).toBeUndefined();
    });
  });
});
