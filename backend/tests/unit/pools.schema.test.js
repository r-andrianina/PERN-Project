const schema = require('../../src/schemas/pools.schema');

describe('schemas/pools — createPool', () => {
  it('accepte un pool avec un membre', () => {
    const r = schema.createPool.safeParse({ membres: [{ specimenType: 'moustique', specimenId: 1 }] });
    expect(r.success).toBe(true);
  });

  it('accepte code/notes optionnels', () => {
    const r = schema.createPool.safeParse({
      code: 'POOL-ABC', notes: 'Pool test',
      membres: [{ specimenType: 'tique', specimenId: 5 }],
    });
    expect(r.success).toBe(true);
  });

  it('rejette un tableau de membres vide', () => {
    expect(schema.createPool.safeParse({ membres: [] }).success).toBe(false);
  });

  it('rejette sans membres', () => {
    expect(schema.createPool.safeParse({}).success).toBe(false);
  });

  it('rejette un specimenType hors énumération', () => {
    const r = schema.createPool.safeParse({ membres: [{ specimenType: 'rat', specimenId: 1 }] });
    expect(r.success).toBe(false);
  });

  it('accepte les 4 types de spécimen', () => {
    for (const specimenType of schema.SPECIMEN_TYPES) {
      const r = schema.createPool.safeParse({ membres: [{ specimenType, specimenId: 1 }] });
      expect(r.success).toBe(true);
    }
  });
});
