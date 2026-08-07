// Tests du schéma Zod labo — manipulation de base (9 sous-modules scientifiques).
const schema = require('../../src/schemas/labo.schema');

describe('schemas/labo — createManipulation', () => {
  it('accepte une manipulation liée à un spécimen', () => {
    const r = schema.createManipulation.safeParse({
      specimenType: 'moustique', specimenId: 1,
      typeManipulation: 'extraction', dateDebut: '2026-01-15T08:00:00Z',
    });
    expect(r.success).toBe(true);
  });

  it('accepte une manipulation liée à un pool (sans specimenId)', () => {
    const r = schema.createManipulation.safeParse({
      poolId: 3, typeManipulation: 'broyage_pool', dateDebut: '2026-01-15T08:00:00Z',
    });
    expect(r.success).toBe(true);
  });

  it('rejette si ni specimenId ni poolId (refine)', () => {
    const r = schema.createManipulation.safeParse({
      typeManipulation: 'extraction', dateDebut: '2026-01-15T08:00:00Z',
    });
    expect(r.success).toBe(false);
  });

  it('rejette typeManipulation hors énumération (9 protocoles)', () => {
    const r = schema.createManipulation.safeParse({
      specimenId: 1, typeManipulation: 'inconnu', dateDebut: '2026-01-15T08:00:00Z',
    });
    expect(r.success).toBe(false);
  });

  it('accepte les 10 valeurs de typeManipulation', () => {
    for (const typeManipulation of schema.TYPE_MANIPULATION) {
      const r = schema.createManipulation.safeParse({
        specimenId: 1, typeManipulation, dateDebut: '2026-01-15T08:00:00Z',
      });
      expect(r.success).toBe(true);
    }
  });

  it('rejette dateDebut sans offset (datetime strict)', () => {
    const r = schema.createManipulation.safeParse({
      specimenId: 1, typeManipulation: 'extraction', dateDebut: '2026-01-15T08:00:00',
    });
    expect(r.success).toBe(false);
  });
});

describe('schemas/labo — updateManipulation', () => {
  it('rejette un objet vide (refine — toutes les clés undefined)', () => {
    expect(schema.updateManipulation.safeParse({}).success).toBe(false);
  });

  it('accepte une modification partielle simple', () => {
    expect(schema.updateManipulation.safeParse({ notes: 'x' }).success).toBe(true);
  });
});

describe('schemas/labo — validerManipulation', () => {
  it('accepte un motif optionnel', () => {
    expect(schema.validerManipulation.safeParse({}).success).toBe(true);
    expect(schema.validerManipulation.safeParse({ motifInvalidation: 'Contamination suspectée' }).success).toBe(true);
  });
});

describe('schemas/labo — modules scientifiques (enums)', () => {
  it('updateIdentificationMorpho rejette niveauConfiance hors énumération', () => {
    expect(schema.updateIdentificationMorpho.safeParse({ niveauConfiance: 'peut-etre' }).success).toBe(false);
    expect(schema.updateIdentificationMorpho.safeParse({ niveauConfiance: 'certain' }).success).toBe(true);
  });

  it('updateBroyagePool rejette methodeBroyage hors énumération', () => {
    expect(schema.updateBroyagePool.safeParse({ methodeBroyage: 'mixeur' }).success).toBe(false);
    expect(schema.updateBroyagePool.safeParse({ methodeBroyage: 'tissuelyser' }).success).toBe(true);
  });

  it('updateExtraction rejette typeAcideNucleique et methodeExtraction hors énumération', () => {
    expect(schema.updateExtraction.safeParse({ typeAcideNucleique: 'proteine' }).success).toBe(false);
    expect(schema.updateExtraction.safeParse({ methodeExtraction: 'chimique' }).success).toBe(false);
    expect(schema.updateExtraction.safeParse({ typeAcideNucleique: 'adn_arn', methodeExtraction: 'non_destructive' }).success).toBe(true);
  });

  it('updatePcr valide le format de puits (A1–H12)', () => {
    expect(schema.updatePcr.safeParse({ puitsPcr: 'A1' }).success).toBe(true);
    expect(schema.updatePcr.safeParse({ puitsPcr: 'H12' }).success).toBe(true);
    expect(schema.updatePcr.safeParse({ puitsPcr: 'I1' }).success).toBe(false);
    expect(schema.updatePcr.safeParse({ puitsPcr: 'A13' }).success).toBe(false);
  });

  it('updatePcr rejette statutBandeGel hors énumération', () => {
    expect(schema.updatePcr.safeParse({ statutBandeGel: 'douteux' }).success).toBe(false);
    expect(schema.updatePcr.safeParse({ statutBandeGel: 'positif' }).success).toBe(true);
  });

  it('updateQpcr rejette typePcr hors énumération (qPCR/RT-qPCR uniquement)', () => {
    expect(schema.updateQpcr.safeParse({ typePcr: 'PCR' }).success).toBe(false);
    expect(schema.updateQpcr.safeParse({ typePcr: 'RT-qPCR' }).success).toBe(true);
  });

  it('updateNestedPcr accepte les résultats par round indépendamment', () => {
    const r = schema.updateNestedPcr.safeParse({ statutBande1: 'positif', statutBande2: 'negatif', resultatFinal: 'positif' });
    expect(r.success).toBe(true);
  });

  it('updateSequencage rejette methodeSequencage hors énumération', () => {
    expect(schema.updateSequencage.safeParse({ methodeSequencage: 'pyroseq' }).success).toBe(false);
    expect(schema.updateSequencage.safeParse({ methodeSequencage: 'ngs_illumina' }).success).toBe(true);
  });

  it('updateMicroscopie rejette typeExamen hors énumération', () => {
    expect(schema.updateMicroscopie.safeParse({ typeExamen: 'peau' }).success).toBe(false);
    expect(schema.updateMicroscopie.safeParse({ typeExamen: 'glandes_salivaires' }).success).toBe(true);
  });

  it('updateDessication accepte les champs optionnels sans erreur', () => {
    const r = schema.updateDessication.safeParse({ temperatureStockage: '-80°C', dureeDessicationH: 48 });
    expect(r.success).toBe(true);
  });

  it('tous les modules acceptent un objet vide (pas de refine "non vide" sur les sous-modules)', () => {
    expect(schema.updateIdentificationMorpho.safeParse({}).success).toBe(true);
    expect(schema.updateBroyagePool.safeParse({}).success).toBe(true);
    expect(schema.updateExtraction.safeParse({}).success).toBe(true);
  });
});
