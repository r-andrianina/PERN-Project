// Tests des schémas Zod spécimens (Moustique/Tique/Puce) — dont la régression
// Zod v4 sur sexe/nombre/repasSang/gorge (défauts réinjectés par .partial()
// sur des champs .default() si les workarounds cassent).
const schema = require('../../src/schemas/specimens.schema');

describe('schemas/specimens — Moustique', () => {
  describe('createMoustique', () => {
    it('accepte un moustique minimal valide', () => {
      const r = schema.createMoustique.safeParse({ methodeId: 1, taxonomieId: 2 });
      expect(r.success).toBe(true);
    });

    it('applique les défauts (nombre=1, sexe=inconnu, repasSang=N, insertMode=single)', () => {
      const r = schema.createMoustique.safeParse({ methodeId: 1, taxonomieId: 2 });
      expect(r.success).toBe(true);
      expect(r.data.nombre).toBe(1);
      expect(r.data.sexe).toBe('inconnu');
      expect(r.data.repasSang).toBe('N');
      expect(r.data.insertMode).toBe('single');
    });

    it('rejette methodeId ou taxonomieId absents', () => {
      expect(schema.createMoustique.safeParse({ taxonomieId: 2 }).success).toBe(false);
      expect(schema.createMoustique.safeParse({ methodeId: 1 }).success).toBe(false);
    });

    it('rejette parite hors énumération (jargon entomologique — Nulle/Paucie/Multi uniquement)', () => {
      expect(schema.createMoustique.safeParse({ methodeId: 1, taxonomieId: 2, parite: 'Semi' }).success).toBe(false);
    });

    it('accepte les 3 valeurs de parité', () => {
      for (const parite of ['Nulle', 'Paucie', 'Multi']) {
        expect(schema.createMoustique.safeParse({ methodeId: 1, taxonomieId: 2, parite }).success).toBe(true);
      }
    });

    it('rejette repasSang hors énumération SOP', () => {
      expect(schema.createMoustique.safeParse({ methodeId: 1, taxonomieId: 2, repasSang: 'X' }).success).toBe(false);
    });

    it('accepte les 5 statuts sanguins SOP (N/G/Gr/SGr/NC)', () => {
      for (const repasSang of schema.STATUT_SANGUIN) {
        expect(schema.createMoustique.safeParse({ methodeId: 1, taxonomieId: 2, repasSang }).success).toBe(true);
      }
    });

    it('rejette insertMode hors énumération', () => {
      expect(schema.createMoustique.safeParse({ methodeId: 1, taxonomieId: 2, insertMode: 'multi' }).success).toBe(false);
    });

    it('rejette nombre négatif ou nul', () => {
      expect(schema.createMoustique.safeParse({ methodeId: 1, taxonomieId: 2, nombre: 0 }).success).toBe(false);
    });
  });

  describe('updateMoustique — régression Zod v4', () => {
    it('ne réinjecte pas sexe/nombre/repasSang par défaut sur une maj partielle', () => {
      const r = schema.updateMoustique.safeParse({ notes: 'observation' });
      expect(r.success).toBe(true);
      expect(r.data.sexe).toBeUndefined();
      expect(r.data.nombre).toBeUndefined();
      expect(r.data.repasSang).toBeUndefined();
    });

    it("n'accepte plus methodeId/insertMode (omis)", () => {
      const r = schema.updateMoustique.safeParse({ notes: 'x' });
      expect(r.data.methodeId).toBeUndefined();
      expect(r.data.insertMode).toBeUndefined();
    });

    it('rejette un objet vide (refine)', () => {
      expect(schema.updateMoustique.safeParse({}).success).toBe(false);
    });
  });
});

describe('schemas/specimens — Tique', () => {
  describe('createTique', () => {
    it('accepte une tique minimale valide, applique les défauts', () => {
      const r = schema.createTique.safeParse({ methodeId: 1, taxonomieId: 2 });
      expect(r.success).toBe(true);
      expect(r.data.gorge).toBe('N');
      expect(r.data.sexe).toBe('inconnu');
    });

    it('accepte hoteId optionnel', () => {
      expect(schema.createTique.safeParse({ methodeId: 1, taxonomieId: 2, hoteId: 5 }).success).toBe(true);
    });

    it('rejette gorge hors énumération SOP', () => {
      expect(schema.createTique.safeParse({ methodeId: 1, taxonomieId: 2, gorge: 'Full' }).success).toBe(false);
    });
  });

  describe('updateTique — régression Zod v4', () => {
    it('ne réinjecte pas gorge par défaut sur une maj partielle', () => {
      const r = schema.updateTique.safeParse({ notes: 'x' });
      expect(r.success).toBe(true);
      expect(r.data.gorge).toBeUndefined();
    });

    it('rejette un objet vide (refine)', () => {
      expect(schema.updateTique.safeParse({}).success).toBe(false);
    });
  });
});

describe('schemas/specimens — Puce', () => {
  describe('createPuce', () => {
    it('accepte une puce minimale valide, applique les défauts', () => {
      const r = schema.createPuce.safeParse({ methodeId: 1, taxonomieId: 2 });
      expect(r.success).toBe(true);
      expect(r.data.nombre).toBe(1);
      expect(r.data.sexe).toBe('inconnu');
    });

    it('rejette methodeId ou taxonomieId absents', () => {
      expect(schema.createPuce.safeParse({ taxonomieId: 2 }).success).toBe(false);
    });
  });

  describe('updatePuce — régression Zod v4', () => {
    it('ne réinjecte pas sexe/nombre par défaut sur une maj partielle', () => {
      const r = schema.updatePuce.safeParse({ notes: 'x' });
      expect(r.success).toBe(true);
      expect(r.data.sexe).toBeUndefined();
      expect(r.data.nombre).toBeUndefined();
    });

    it('rejette un objet vide (refine)', () => {
      expect(schema.updatePuce.safeParse({}).success).toBe(false);
    });
  });
});
