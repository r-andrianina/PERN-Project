// Classement d'une ligne de Dico_Taxo.xlsx vers un type de spécimen.
//
// Le défaut corrigé le 2026-09-23 n'était pas un mauvais classement mais une
// ABSENCE de classement : hors des trois familles connues, la fonction
// renvoyait null et l'import jetait la ligne en silence. Les deux
// contre-épreuves ci-dessous portent donc moins sur les trois cas connus que
// sur ce qui leur échappe.
const { detectType } = require('../../src/utils/taxonomyType');

describe('detectType — classement des lignes du dictionnaire', () => {
  it('Diptera/Culicidae est un moustique', () => {
    expect(detectType('Diptera', 'Culicidae')).toBe('moustique');
  });

  it('Ixodida est une tique, quelle que soit la famille', () => {
    expect(detectType('Ixodida', 'Ixodidae')).toBe('tique');
    expect(detectType('Ixodida', 'Argasidae')).toBe('tique');
    expect(detectType('Ixodida', null)).toBe('tique');
  });

  it('Siphonaptera est une puce, quelle que soit la famille', () => {
    expect(detectType('Siphonaptera', 'Pulicidae')).toBe('puce');
    expect(detectType('Siphonaptera', 'Ceratophyllidae')).toBe('puce');
  });

  it('Culicoides (Diptera/Ceratopogonidae) est classé en "autre", pas rejeté', () => {
    // Le cas qui a motivé le correctif : 1 683 lignes du fichier, absentes
    // du dictionnaire pendant des mois.
    expect(detectType('Diptera', 'Ceratopogonidae')).toBe('autre');
  });

  it('les autres vecteurs diptères tombent aussi en "autre"', () => {
    expect(detectType('Diptera', 'Psychodidae')).toBe('autre'); // phlébotomes
    expect(detectType('Diptera', 'Simuliidae')).toBe('autre');
    expect(detectType('Diptera', 'Tabanidae')).toBe('autre');
    expect(detectType('Diptera', 'Glossinidae')).toBe('autre'); // glossines
  });

  it('une famille inconnue n\'est JAMAIS rejetée — plus aucun null', () => {
    // Contre-épreuve du défaut lui-même : un retour null ferait taire la
    // ligne à l'import. Aucune entrée du fichier ne doit pouvoir produire ça.
    const exotiques = [
      ['Scorpionida', 'Buthidae'],
      ['Araneae',     'Theridiidae'],
      ['Phthiraptera', 'Pediculidae'],
      ['Hemiptera',   'Reduviidae'],
      ['Inconnu',     null],
      [null,          null],
    ];
    exotiques.forEach(([o, f]) => expect(detectType(o, f)).toBe('autre'));
  });

  it('Diptera hors Culicidae n\'est pas un moustique', () => {
    // Contre-épreuve du cas moustique : sans la condition sur la famille,
    // les 2 919 Ceratopogonidae seraient devenues des moustiques — pire que
    // leur absence, puisqu'elles auraient pollué les comptages de densité.
    expect(detectType('Diptera', 'Muscidae')).toBe('autre');
    expect(detectType('Diptera', null)).toBe('autre');
  });
});
