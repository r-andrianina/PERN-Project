// Cohérence du modèle Excel téléchargeable avec ce que l'import sait lire.
//
// Régression du 2026-08-27 : le template n'exposait ni GPS, ni NUMBER, ni
// REMARKS — un utilisateur suivant scrupuleusement le modèle fourni ne pouvait
// donc PAS transmettre de coordonnées, et sans GPS l'appariement de localité par
// proximité (seuil 2 km) ne s'exécutait jamais.
const { TEMPLATE_COLUMNS } = require('../../src/controllers/import.controller');
const { KNOWN_COLUMNS, FIELD_COLUMNS, canonicalHeader } = require('../../src/utils/importMappings');

describe('template d\'import — cohérence avec FIELD_COLUMNS', () => {
  it('toute colonne du template est effectivement lue par l\'import', () => {
    const inconnues = TEMPLATE_COLUMNS
      .map(c => c.header)
      .filter(h => !KNOWN_COLUMNS.has(canonicalHeader(h)));
    expect(inconnues).toEqual([]);
  });

  it('expose les colonnes GPS, dont dépend l\'appariement de localité', () => {
    const headers = TEMPLATE_COLUMNS.map(c => c.header);
    for (const c of ['DECIMAL_LATITUDE', 'DECIMAL_LONGITUDE', 'ELEVATION']) {
      expect(headers).toContain(c);
    }
  });

  it('expose NUMBER, dont dépend la répartition automatique en plaque', () => {
    expect(TEMPLATE_COLUMNS.map(c => c.header)).toContain('NUMBER');
  });

  it('expose les colonnes obligatoires de checkRequiredHeaders', () => {
    const requises = TEMPLATE_COLUMNS.filter(c => c.requis).map(c => c.header);
    expect(requises).toEqual(
      expect.arrayContaining([FIELD_COLUMNS.idTerrain[0], FIELD_COLUMNS.ordreMission[0], FIELD_COLUMNS.nomScientifique[0]]),
    );
  });

  it('n\'a ni doublon de colonne ni clé dupliquée', () => {
    const headers = TEMPLATE_COLUMNS.map(c => c.header);
    const keys    = TEMPLATE_COLUMNS.map(c => c.key);
    expect(new Set(headers).size).toBe(headers.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('chaque colonne porte une note, sauf COLLECTION_METHOD (issue du référentiel)', () => {
    const sansNote = TEMPLATE_COLUMNS.filter(c => !c.note && c.header !== 'COLLECTION_METHOD');
    expect(sansNote.map(c => c.header)).toEqual([]);
  });
});

// ── Cohérence backend ↔ interface d'import ───────────────────────────
// Vérifié le 2026-09-04 : NOMBRE_INVALIDE (51 messages sur un fichier réel)
// s'affichait en code brut faute de libellé, et 8 colonnes lues manquaient à la
// barre latérale. Ces tests lisent le frontend depuis le backend — inhabituel,
// mais c'est le seul endroit où les deux listes peuvent être confrontées.
const fs   = require('fs');
const path = require('path');

const PAGE_IMPORT = path.join(__dirname, '../../../frontend/src/pages/import/ImportPage.jsx');
const lirePage = () => fs.readFileSync(PAGE_IMPORT, 'utf8');

// Replis d'autres colonnes : volontairement absents de la barre latérale, les
// afficher laisserait croire à des champs distincts.
const REPLIS = new Set(['COLLECTOR_SAMPLE_ID', 'OTHER_INFORMATIONS', 'MISC_METADATA']);

describe('import — cohérence avec la page frontend', () => {
  it('tout code de log émis a un libellé dans l\'interface', () => {
    const backend = fs.readFileSync(path.join(__dirname, '../../src/controllers/import.controller.js'), 'utf8');
    const codes = new Set([...backend.matchAll(/code: '([A-Z_]+)'/g)].map((m) => m[1]));
    for (const m of backend.matchAll(/addLog\('[a-z]+', '([A-Z_]+)'/g)) codes.add(m[1]);

    const page = lirePage();
    const libelles = new Set([...page.matchAll(/^ {2}([A-Z_]+):\s+t\('importPage\./gm)].map((m) => m[1]));
    expect([...codes].filter((c) => !libelles.has(c)).sort()).toEqual([]);
  });

  it('aucun libellé ne référence un code que le backend n\'émet plus', () => {
    const backend = fs.readFileSync(path.join(__dirname, '../../src/controllers/import.controller.js'), 'utf8');
    const codes = new Set([...backend.matchAll(/code: '([A-Z_]+)'/g)].map((m) => m[1]));
    for (const m of backend.matchAll(/addLog\('[a-z]+', '([A-Z_]+)'/g)) codes.add(m[1]);

    const page = lirePage();
    const libelles = [...page.matchAll(/^ {2}([A-Z_]+):\s+t\('importPage\./gm)].map((m) => m[1]);
    expect(libelles.filter((c) => !codes.has(c)).sort()).toEqual([]);
  });

  it('toute colonne lue figure dans la barre latérale, sauf les replis', () => {
    const page = lirePage();
    const bloc = page.slice(page.indexOf('const getCols'), page.indexOf('function ColRow'));
    const listees = new Set([...bloc.matchAll(/col: '([A-Z_0-9]+)'/g)].map((m) => m[1]));
    const attendues = [...KNOWN_COLUMNS].filter((c) => !REPLIS.has(c));
    expect(attendues.filter((c) => !listees.has(c)).sort()).toEqual([]);
  });
});

// ── Référentiel : mapping ↔ seed ─────────────────────────────────────
// Vérifié le 2026-09-04 : GITES pointait vers un code absent du référentiel
// (toute ligne l'employant échouait), et le seed proposait CDC-LT/BG-SENT/GITES
// alors que les données utilisent CDC/BG/LC — une installation neuve n'aurait eu
// aucun des codes réellement employés.
describe('référentiel des méthodes — mapping et seed', () => {
  const codesDuSeed = () => {
    const seed = fs.readFileSync(path.join(__dirname, '../../prisma/seed.js'), 'utf8');
    const bloc = seed.slice(seed.indexOf('const typesMethode'), seed.indexOf('for (const t of typesMethode'));
    return new Set([...bloc.matchAll(/code: '([A-Z0-9-]+)'/g)].map((m) => m[1]));
  };

  it('tout code visé par COLLECTION_METHOD est créé par le seed', () => {
    const { COLLECTION_METHOD } = require('../../src/utils/importMappings');
    const seed = codesDuSeed();
    const orphelins = [...new Set(Object.values(COLLECTION_METHOD))].filter((c) => !seed.has(c));
    expect(orphelins.sort()).toEqual([]);
  });

  it('GITES mène à LC — même opération, code qui existe', () => {
    const { COLLECTION_METHOD, normalizeKey } = require('../../src/utils/importMappings');
    expect(COLLECTION_METHOD[normalizeKey('GITES')]).toBe('LC');
    expect(COLLECTION_METHOD[normalizeKey('LARVAL_COLLECTION')]).toBe('LC');
  });

  it('le seed ne ressuscite pas les codes SOP écartés', () => {
    const seed = codesDuSeed();
    for (const ecarte of ['CDC-LT', 'BG-SENT', 'GITES', 'MHT']) {
      expect(seed.has(ecarte)).toBe(false);
    }
  });
});
