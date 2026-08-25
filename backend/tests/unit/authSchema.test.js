// Tests des schémas Zod d'auth — garantissent que la validation déléguée aux
// routes (validate(schema.*)) couvre bien ce que les contrôleurs ne vérifient
// plus manuellement (B7) : requis, longueurs, enums, defaults, transforms.
const schema = require('../../src/schemas/auth.schema');

// Mot de passe valide selon la politique 2026-08-17 : ≥10 caractères, ≥1 lettre, ≥1 chiffre.
const VALID_PW = 'Abcdef1234';

describe('schemas/auth', () => {
  describe('register', () => {
    it('rejette un mot de passe < 10 caractères', () => {
      expect(schema.register.safeParse({ nom: 'A', prenom: 'B', email: 'a@b.co', password: 'Ab1' }).success).toBe(false);
    });
    it('rejette un mot de passe sans lettre', () => {
      expect(schema.register.safeParse({ nom: 'A', prenom: 'B', email: 'a@b.co', password: '1234567890' }).success).toBe(false);
    });
    it('rejette un mot de passe sans chiffre', () => {
      expect(schema.register.safeParse({ nom: 'A', prenom: 'B', email: 'a@b.co', password: 'abcdefghij' }).success).toBe(false);
    });
    it('accepte un mot de passe conforme (≥10, lettre + chiffre)', () => {
      expect(schema.register.safeParse({ nom: 'A', prenom: 'B', email: 'a@b.co', password: VALID_PW }).success).toBe(true);
    });
    it('rejette un email mal formé', () => {
      expect(schema.register.safeParse({ nom: 'A', prenom: 'B', email: 'pas-un-email', password: VALID_PW }).success).toBe(false);
    });
    it('normalise email (minuscules) et nom (trim)', () => {
      const r = schema.register.safeParse({ nom: '  Rakoto ', prenom: 'B', email: 'X@Y.CO', password: VALID_PW });
      expect(r.success).toBe(true);
      expect(r.data.email).toBe('x@y.co');
      expect(r.data.nom).toBe('Rakoto');
    });
    it('rejette un nom ou prénom composé uniquement d\'espaces (trim avant min)', () => {
      expect(schema.register.safeParse({ nom: '   ', prenom: 'B', email: 'a@b.co', password: VALID_PW }).success).toBe(false);
      expect(schema.register.safeParse({ nom: 'A', prenom: '  ', email: 'a@b.co', password: VALID_PW }).success).toBe(false);
    });
  });

  describe('createUser', () => {
    it('applique les defaults (role, actif, specimensAutorises)', () => {
      const r = schema.createUser.safeParse({ nom: 'A', prenom: 'B', email: 'a@b.co', password: VALID_PW });
      expect(r.success).toBe(true);
      expect(r.data.role).toBe('lecteur');
      expect(r.data.actif).toBe(true);
      expect(r.data.specimensAutorises).toEqual(['moustique', 'tique', 'puce']);
    });
    it('rejette un rôle inconnu', () => {
      expect(schema.createUser.safeParse({ nom: 'A', prenom: 'B', email: 'a@b.co', password: VALID_PW, role: 'root' }).success).toBe(false);
    });
    it('accepte « autre » dans specimensAutorises (B5)', () => {
      const r = schema.createUser.safeParse({ nom: 'A', prenom: 'B', email: 'a@b.co', password: VALID_PW, specimensAutorises: ['autre'] });
      expect(r.success).toBe(true);
      expect(r.data.specimensAutorises).toEqual(['autre']);
    });
  });

  describe('updateUser', () => {
    it('rejette un corps vide', () => {
      expect(schema.updateUser.safeParse({}).success).toBe(false);
    });
    it('accepte une modification partielle', () => {
      expect(schema.updateUser.safeParse({ role: 'chercheur' }).success).toBe(true);
    });
  });

  describe('activateUser', () => {
    it('exige au moins actif ou role', () => {
      expect(schema.activateUser.safeParse({}).success).toBe(false);
      expect(schema.activateUser.safeParse({ actif: true }).success).toBe(true);
      expect(schema.activateUser.safeParse({ role: 'technicien' }).success).toBe(true);
    });
  });

  describe('changePassword', () => {
    it('exige un nouveau mot de passe ≥ 10 avec lettre et chiffre', () => {
      expect(schema.changePassword.safeParse({ currentPassword: 'x', newPassword: 'court' }).success).toBe(false);
      expect(schema.changePassword.safeParse({ currentPassword: 'x', newPassword: '1234567890' }).success).toBe(false);
      expect(schema.changePassword.safeParse({ currentPassword: 'x', newPassword: VALID_PW }).success).toBe(true);
    });
  });
});
