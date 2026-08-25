const schema = require('../../src/schemas/containers.schema');

describe('schemas/containers — createContainer', () => {
  it('accepte un container valide', () => {
    const r = schema.createContainer.safeParse({ type: 'PLAQUE', missionId: 1, notes: 'Lot A' });
    expect(r.success).toBe(true);
  });

  it('accepte sans notes (optionnel)', () => {
    expect(schema.createContainer.safeParse({ type: 'BOITE', missionId: 1 }).success).toBe(true);
  });

  it('rejette un type hors énumération', () => {
    expect(schema.createContainer.safeParse({ type: 'TUBE', missionId: 1 }).success).toBe(false);
  });

  it('rejette sans missionId', () => {
    expect(schema.createContainer.safeParse({ type: 'PLAQUE' }).success).toBe(false);
  });
});

describe('schemas/containers — updateContainer', () => {
  it('accepte une mise à jour des notes', () => {
    expect(schema.updateContainer.safeParse({ notes: 'Nouvelle note' }).success).toBe(true);
  });

  it('accepte un objet vide (notes optionnel)', () => {
    expect(schema.updateContainer.safeParse({}).success).toBe(true);
  });

  it('ignore silencieusement type/missionId (non modifiables via update)', () => {
    const r = schema.updateContainer.safeParse({ type: 'BOITE', missionId: 2, notes: 'x' });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ notes: 'x' });
  });
});
