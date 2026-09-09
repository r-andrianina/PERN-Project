// Garde-fous appliqués aux classeurs Excel reçus d'un utilisateur.
//
// Régression couverte (2026-09-09) : l'import ne vérifiait que le `mimetype`
// annoncé par le client. Un binaire renommé en .xlsx atteignait ExcelJS, qui
// levait une erreur brute remontée en 500 « Erreur interne du serveur » — sans
// message exploitable, et sans aucune protection contre une archive piégée.

const ExcelJS = require('exceljs');
const {
  chargerClasseurUtilisateur, premiereFeuille, assertVolumeTraitable,
  estSignatureXlsx, tailleDecompresseeAnnoncee,
} = require('../../src/utils/excelGuards');

/** Classeur .xlsx réel, en mémoire. */
async function classeur(lignes = [['SERIES', 'MISSION_ORDER_NUMBER'], ['A-1', 'OM-1']]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Données');
  for (const l of lignes) ws.addRow(l);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('excelGuards — signature de contenu', () => {
  it('reconnaît une archive ZIP (donc un .xlsx)', async () => {
    expect(estSignatureXlsx(await classeur())).toBe(true);
  });

  it('rejette un contenu qui n\'est pas une archive', () => {
    expect(estSignatureXlsx(Buffer.from('MZ\x90\x00 exécutable renommé'))).toBe(false);
    expect(estSignatureXlsx(Buffer.from('genre;espece\nAnopheles;gambiae'))).toBe(false);
    expect(estSignatureXlsx(Buffer.from([0x50, 0x4b]))).toBe(false); // trop court
    expect(estSignatureXlsx(null)).toBe(false);
  });
});

describe('excelGuards — chargement encapsulé', () => {
  it('charge un classeur valide', async () => {
    const wb = await chargerClasseurUtilisateur(await classeur());
    expect(wb.worksheets[0].getCell(1, 1).value).toBe('SERIES');
  });

  it('refuse un fichier vide avec un message métier (400, pas 500)', async () => {
    await expect(chargerClasseurUtilisateur(Buffer.alloc(0)))
      .rejects.toMatchObject({ name: 'AppError', statusCode: 400 });
  });

  it('refuse un binaire déguisé en .xlsx', async () => {
    const faux = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(2048, 0x41)]);
    await expect(chargerClasseurUtilisateur(faux))
      .rejects.toMatchObject({ name: 'AppError', statusCode: 400 });
  });

  it('refuse une archive ZIP qui n\'est pas un classeur, sans fuiter le parseur', async () => {
    // Signature ZIP valide mais contenu tronqué : ExcelJS échoue.
    const zipCasse = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(512, 0)]);
    await expect(chargerClasseurUtilisateur(zipCasse)).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 400,
      // Le message doit rester générique : pas de détail interne du parseur.
      message: expect.stringContaining('illisible ou corrompu'),
    });
  });

  it('refuse un fichier au-delà de la limite de taille', async () => {
    const gros = await classeur();
    await expect(chargerClasseurUtilisateur(gros, { maxOctets: 10 }))
      .rejects.toMatchObject({ name: 'AppError', statusCode: 400 });
  });

  it('refuse une archive dont la taille décompressée annoncée dépasse la limite', async () => {
    // Le classeur de test se décompresse en quelques Ko : une limite de 1 octet
    // suffit à déclencher la garde anti « zip-bomb ».
    await expect(chargerClasseurUtilisateur(await classeur(), { maxDecompresse: 1 }))
      .rejects.toMatchObject({ name: 'AppError', statusCode: 400 });
  });
});

describe('excelGuards — taille décompressée annoncée', () => {
  it('lit une taille strictement positive sur une archive réelle', async () => {
    const taille = tailleDecompresseeAnnoncee(await classeur());
    expect(taille).toBeGreaterThan(0);
  });

  it('renvoie null (indéterminé) plutôt que de bloquer sur un contenu non-ZIP', () => {
    expect(tailleDecompresseeAnnoncee(Buffer.from('pas une archive'))).toBeNull();
    expect(tailleDecompresseeAnnoncee(Buffer.alloc(4))).toBeNull();
  });
});

describe('excelGuards — feuille et volume', () => {
  it('refuse un classeur sans ligne de données sous l\'en-tête', async () => {
    const wb = await chargerClasseurUtilisateur(await classeur([['SERIES', 'MISSION_ORDER_NUMBER']]));
    expect(() => premiereFeuille(wb)).toThrow(/aucune ligne de données/i);
  });

  it('refuse un classeur au-delà du plafond de lignes', async () => {
    const lignes = [['SERIES']];
    for (let i = 0; i < 12; i++) lignes.push([`A-${i}`]);
    const wb = await chargerClasseurUtilisateur(await classeur(lignes));
    const ws = premiereFeuille(wb);
    expect(() => assertVolumeTraitable(ws, 5)).toThrow(/trop volumineux/i);
    expect(assertVolumeTraitable(ws, 100)).toBe(12);
  });
});
