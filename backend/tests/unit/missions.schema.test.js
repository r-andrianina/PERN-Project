// Tests du schéma Zod missions — requis, coercion, refine (aucune modification vide).
const schema = require('../../src/schemas/missions.schema');

describe('schemas/missions', () => {
  describe('createMission', () => {
    it('accepte une mission minimale valide', () => {
      const r = schema.createMission.safeParse({
        ordreMission: 'M2026-001', projetId: 1, dateDebut: '2026-01-15',
      });
      expect(r.success).toBe(true);
    });

    it('rejette ordreMission absent', () => {
      expect(schema.createMission.safeParse({ projetId: 1, dateDebut: '2026-01-15' }).success).toBe(false);
    });

    it('rejette projetId absent', () => {
      expect(schema.createMission.safeParse({ ordreMission: 'M1', dateDebut: '2026-01-15' }).success).toBe(false);
    });

    it('rejette une date mal formée (pas YYYY-MM-DD)', () => {
      const r = schema.createMission.safeParse({ ordreMission: 'M1', projetId: 1, dateDebut: '15/01/2026' });
      expect(r.success).toBe(false);
    });

    it('coerce projetId string → number', () => {
      const r = schema.createMission.safeParse({ ordreMission: 'M1', projetId: '3', dateDebut: '2026-01-15' });
      expect(r.success).toBe(true);
      expect(r.data.projetId).toBe(3);
    });

    it('rejette projetId négatif ou nul', () => {
      expect(schema.createMission.safeParse({ ordreMission: 'M1', projetId: 0, dateDebut: '2026-01-15' }).success).toBe(false);
      expect(schema.createMission.safeParse({ ordreMission: 'M1', projetId: -1, dateDebut: '2026-01-15' }).success).toBe(false);
    });

    it('limite agentIds à 20', () => {
      const agentIds = Array.from({ length: 21 }, (_, i) => i + 1);
      const r = schema.createMission.safeParse({ ordreMission: 'M1', projetId: 1, dateDebut: '2026-01-15', agentIds });
      expect(r.success).toBe(false);
    });

    it('accepte 20 agentIds exactement', () => {
      const agentIds = Array.from({ length: 20 }, (_, i) => i + 1);
      const r = schema.createMission.safeParse({ ordreMission: 'M1', projetId: 1, dateDebut: '2026-01-15', agentIds });
      expect(r.success).toBe(true);
    });
  });

  describe('updateMission', () => {
    it('rejette un objet vide (refine)', () => {
      expect(schema.updateMission.safeParse({}).success).toBe(false);
    });

    it("n'accepte plus ordreMission/projetId (omis)", () => {
      const r = schema.updateMission.safeParse({ observations: 'test' });
      expect(r.success).toBe(true);
      expect(r.data.ordreMission).toBeUndefined();
      expect(r.data.projetId).toBeUndefined();
    });

    it('accepte une modification partielle simple', () => {
      const r = schema.updateMission.safeParse({ objet: 'Nouvelle campagne' });
      expect(r.success).toBe(true);
      expect(r.data.objet).toBe('Nouvelle campagne');
    });
  });
});
