const { projetScopeWhere, assertProjetAccessible } = require('../../src/utils/access');

describe('utils/access — projetScopeWhere', () => {
  it('renvoie {} (aucune restriction) pour un utilisateur bypass', () => {
    expect(projetScopeWhere(['methode', 'localite', 'mission'], null)).toEqual({});
  });

  it('construit la clause imbriquée dans le bon ordre', () => {
    const clause = projetScopeWhere(['methode', 'localite', 'mission'], [1, 2, 3]);
    expect(clause).toEqual({
      methode: { localite: { mission: { projetId: { in: [1, 2, 3] } } } },
    });
  });

  it('gère un chemin à un seul niveau (ex: Container → mission)', () => {
    expect(projetScopeWhere(['mission'], [5])).toEqual({ mission: { projetId: { in: [5] } } });
  });

  it('gère une liste de projets vide (aucun accès)', () => {
    expect(projetScopeWhere(['mission'], [])).toEqual({ mission: { projetId: { in: [] } } });
  });
});

describe('utils/access — assertProjetAccessible', () => {
  it('ne lève rien pour un utilisateur bypass (null)', () => {
    expect(() => assertProjetAccessible(42, null)).not.toThrow();
  });

  it('ne lève rien si le projet est dans la liste accessible', () => {
    expect(() => assertProjetAccessible(2, [1, 2, 3])).not.toThrow();
  });

  it('lève AppError 403 si le projet est hors périmètre', () => {
    try {
      assertProjetAccessible(99, [1, 2, 3]);
      throw new Error('aurait dû lever');
    } catch (err) {
      expect(err.statusCode).toBe(403);
    }
  });

  it('lève si la liste accessible est vide', () => {
    expect(() => assertProjetAccessible(1, [])).toThrow();
  });
});
