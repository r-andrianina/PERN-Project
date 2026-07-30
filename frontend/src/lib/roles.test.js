import { describe, it, expect } from 'vitest';
import { hasMinRole, canBypass, hydrateRbac, getRoleLevels } from './roles';

describe('lib/roles', () => {
  it('hasMinRole respecte la hiérarchie (repli statique)', () => {
    expect(hasMinRole('admin', 'chercheur')).toBe(true);
    expect(hasMinRole('chercheur', 'chercheur')).toBe(true);
    expect(hasMinRole('lecteur', 'chercheur')).toBe(false);
  });

  it('superviseur ≥ chercheur (régression du bug de blocage superviseur)', () => {
    expect(hasMinRole('superviseur', 'chercheur')).toBe(true);
    expect(hasMinRole('superviseur', 'admin')).toBe(false);
  });

  it('canBypass = admin + superviseur uniquement', () => {
    expect(canBypass('admin')).toBe(true);
    expect(canBypass('superviseur')).toBe(true);
    expect(canBypass('chercheur')).toBe(false);
    expect(canBypass('lecteur')).toBe(false);
  });

  it('hydrateRbac remplace les niveaux depuis le backend (F2)', () => {
    hydrateRbac({
      roleLevels:  { lecteur: 1, technicien: 2, chercheur: 3, superviseur: 4, admin: 5 },
      bypassRoles: ['admin', 'superviseur'],
    });
    expect(getRoleLevels().admin).toBe(5);
    expect(hasMinRole('superviseur', 'chercheur')).toBe(true);
  });

  it('hydrateRbac ignore une config vide (repli conservé)', () => {
    hydrateRbac({});
    expect(hasMinRole('admin', 'lecteur')).toBe(true);
    expect(canBypass('admin')).toBe(true);
  });
});
