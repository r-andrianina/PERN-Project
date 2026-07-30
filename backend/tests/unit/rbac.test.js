// Tests de la source de vérité RBAC (F2).
const { ROLE_ORDER, ROLE_LEVELS, BYPASS_ROLES, SPECIMEN_TYPES, DEFAULT_SPECIMEN_ACCESS } = require('../../src/config/rbac');

describe('config/rbac', () => {
  it('dérive les niveaux depuis l\'ordre (lecteur = 1)', () => {
    expect(ROLE_LEVELS.lecteur).toBe(1);
    expect(ROLE_LEVELS.admin).toBe(ROLE_ORDER.length);
  });

  it('respecte la hiérarchie admin > superviseur > chercheur > technicien > lecteur', () => {
    expect(ROLE_LEVELS.admin).toBeGreaterThan(ROLE_LEVELS.superviseur);
    expect(ROLE_LEVELS.superviseur).toBeGreaterThan(ROLE_LEVELS.chercheur);
    expect(ROLE_LEVELS.chercheur).toBeGreaterThan(ROLE_LEVELS.technicien);
    expect(ROLE_LEVELS.technicien).toBeGreaterThan(ROLE_LEVELS.lecteur);
  });

  it('inclut le superviseur (régression du bug de blocage superviseur)', () => {
    expect(ROLE_ORDER).toContain('superviseur');
    expect(ROLE_LEVELS.superviseur).toBeDefined();
  });

  it('bypass = admin + superviseur uniquement', () => {
    expect([...BYPASS_ROLES].sort()).toEqual(['admin', 'superviseur']);
    expect(BYPASS_ROLES).not.toContain('chercheur');
  });

  it('les types de spécimens incluent « autre »', () => {
    expect(SPECIMEN_TYPES).toEqual(expect.arrayContaining(['moustique', 'tique', 'puce', 'autre']));
  });

  it('l\'accès par défaut exclut « autre »', () => {
    expect(DEFAULT_SPECIMEN_ACCESS).not.toContain('autre');
    expect(DEFAULT_SPECIMEN_ACCESS).toEqual(['moustique', 'tique', 'puce']);
  });
});
