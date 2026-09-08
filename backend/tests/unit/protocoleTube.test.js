// Contrôle du protocole de conservation en tube.
// Règle SOP : au plus 10 individus par tube, tous de même espèce, sexe, statut
// sanguin, piège, localité et date. Les Anopheles vont en puits de plaque et
// ne sont donc pas concernés.
const { nouveauRegistre, enregistrerTube, tubesHorsProtocole, MAX_INDIVIDUS_PAR_TUBE } =
  require('../../src/utils/protocoleTube');

const ligne = (over = {}) => ({
  box: 'B_1', tube: 'TSR_1', estBoite: true, individus: 1, rn: 2,
  dims: { espece: 'Culex pipiens', piege: 'CDC_1', sexe: 'FEMALE', sang: 'N',
          localite: 'TSR', date: '2026-03-20' },
  ...over,
});

describe('protocoleTube', () => {
  it('un tube conforme ne produit aucun signalement', () => {
    const r = nouveauRegistre();
    enregistrerTube(r, ligne({ individus: 6, rn: 2 }));
    enregistrerTube(r, ligne({ individus: 4, rn: 3 }));
    expect(tubesHorsProtocole(r)).toEqual([]);
  });

  it('signale un tube au-delà de 10 individus', () => {
    const r = nouveauRegistre();
    enregistrerTube(r, ligne({ individus: MAX_INDIVIDUS_PAR_TUBE + 1 }));
    const [t] = tubesHorsProtocole(r);
    expect(t.individus).toBe(11);
    expect(t.raison).toContain('11 individus');
  });

  it('signale chaque dimension divergente, nommée', () => {
    const r = nouveauRegistre();
    enregistrerTube(r, ligne({ rn: 2 }));
    enregistrerTube(r, ligne({ rn: 3, dims: { ...ligne().dims, sexe: 'MALE' } }));
    enregistrerTube(r, ligne({ rn: 4, dims: { ...ligne().dims, piege: 'CDC_2' } }));
    const [t] = tubesHorsProtocole(r);
    expect(t.raison).toContain('non homogène');
    expect(t.raison).toContain('2 pièges');
    expect(t.raison).toContain('2 sexes');
  });

  it('la date fait partie de l\'homogénéité', () => {
    const r = nouveauRegistre();
    enregistrerTube(r, ligne({ rn: 2 }));
    enregistrerTube(r, ligne({ rn: 3, dims: { ...ligne().dims, date: '2026-03-21' } }));
    expect(tubesHorsProtocole(r)[0].raison).toContain('2 dates');
  });

  it('ignore les plaques — un puits par spécimen, règle non applicable', () => {
    const r = nouveauRegistre();
    enregistrerTube(r, ligne({ estBoite: false, individus: 96 }));
    expect(tubesHorsProtocole(r)).toEqual([]);
  });

  it('ignore une ligne sans container ou sans tube', () => {
    const r = nouveauRegistre();
    enregistrerTube(r, ligne({ box: null }));
    enregistrerTube(r, ligne({ tube: null }));
    expect(tubesHorsProtocole(r)).toEqual([]);
  });

  it('une valeur absente n\'est pas une divergence', () => {
    // On ne reproche pas une colonne non remplie : c'est signalé ailleurs.
    const r = nouveauRegistre();
    enregistrerTube(r, ligne({ rn: 2 }));
    enregistrerTube(r, ligne({ rn: 3, dims: { ...ligne().dims, piege: null } }));
    expect(tubesHorsProtocole(r)).toEqual([]);
  });

  it('sépare les tubes par container : même étiquette dans deux boîtes', () => {
    const r = nouveauRegistre();
    enregistrerTube(r, ligne({ box: 'B_1', individus: 9 }));
    enregistrerTube(r, ligne({ box: 'B_2', individus: 9 }));
    expect(tubesHorsProtocole(r)).toEqual([]);
  });

  it('classe les tubes les plus chargés en premier', () => {
    const r = nouveauRegistre();
    enregistrerTube(r, ligne({ tube: 'A', individus: 12 }));
    enregistrerTube(r, ligne({ tube: 'B', individus: 40 }));
    expect(tubesHorsProtocole(r).map(t => t.tube)).toEqual(['B', 'A']);
  });
});
