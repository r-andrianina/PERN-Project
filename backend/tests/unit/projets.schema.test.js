// Tests du schéma Zod projets — trim, enum statut, refine (update non vide).
const schema = require('../../src/schemas/projets.schema');

describe('schemas/projets', () => {
  describe('createProjet', () => {
    it('accepte un projet minimal valide', () => {
      const r = schema.createProjet.safeParse({ nom: 'Surveillance vecteurs' });
      expect(r.success).toBe(true);
    });

    it('applique le défaut statut="actif" à la création', () => {
      const r = schema.createProjet.safeParse({ nom: 'X' });
      expect(r.success).toBe(true);
      expect(r.data.statut).toBe('actif');
    });

    it('rejette nom absent, vide ou uniquement des espaces (trim avant min)', () => {
      expect(schema.createProjet.safeParse({}).success).toBe(false);
      expect(schema.createProjet.safeParse({ nom: '' }).success).toBe(false);
      expect(schema.createProjet.safeParse({ nom: '   ' }).success).toBe(false);
    });

    it('trim le nom et le porteur', () => {
      const r = schema.createProjet.safeParse({ nom: '  Projet X  ', porteur: '  Dr Rakoto  ' });
      expect(r.success).toBe(true);
      expect(r.data.nom).toBe('Projet X');
      expect(r.data.porteur).toBe('Dr Rakoto');
    });

    it('rejette un statut hors énumération', () => {
      expect(schema.createProjet.safeParse({ nom: 'X', statut: 'archive' }).success).toBe(false);
    });

    it('accepte les 3 statuts valides', () => {
      for (const statut of ['actif', 'termine', 'suspendu']) {
        expect(schema.createProjet.safeParse({ nom: 'X', statut }).success).toBe(true);
      }
    });

    it('coerce responsableId string → number', () => {
      const r = schema.createProjet.safeParse({ nom: 'X', responsableId: '5' });
      expect(r.success).toBe(true);
      expect(r.data.responsableId).toBe(5);
    });
  });

  describe('updateProjet', () => {
    it("ne redéfinit pas de défaut pour statut (schéma manuel, pas d'omit().partial())", () => {
      const r = schema.updateProjet.safeParse({ nom: 'Nouveau nom' });
      expect(r.success).toBe(true);
      expect(r.data.statut).toBeUndefined();
    });

    it('rejette un objet vide (refine — toutes les clés undefined)', () => {
      expect(schema.updateProjet.safeParse({}).success).toBe(false);
    });

    it('accepte une modification partielle simple', () => {
      const r = schema.updateProjet.safeParse({ statut: 'termine' });
      expect(r.success).toBe(true);
      expect(r.data.statut).toBe('termine');
    });
  });
});
