// Cloisonnement par projet appliqué aux pools.
//
// La règle testée ici est FAIL-CLOSED : un pool n'est accessible que si TOUS
// ses membres sont dans des projets accessibles. Les cas qui comptent ne sont
// donc pas les pools « propres » mais ceux qui doivent être REFUSÉS — un pool
// mixte, un pool vide, un membre introuvable. Un contrôle qui se contenterait
// de « au moins un membre accessible » passerait tous les tests positifs.
//
// Seules les fonctions PURES sont testées : le reste du module ne fait que
// charger des lignes. Et il ne peut pas en être autrement ici — le projet est
// en CommonJS, où `vi.mock` n'intercepte pas `require()` : une tentative de
// simuler le client Prisma a silencieusement tapé la vraie base de dev.
const {
  poolEstAccessible,
  filtrerPoolsAccessibles,
  membresInconnus,
} = require('../../src/utils/poolAccess');

const membre = (specimenType, specimenId) => ({ specimenType, specimenId });

// "type:id" → projetId, tel que le produit resoudreProjetIds
const resolus = (paires) => new Map(Object.entries(paires));

describe('poolEstAccessible — la règle fail-closed', () => {
  it('laisse tout passer pour un utilisateur bypass (ids === null)', () => {
    expect(poolEstAccessible([membre('moustique', 1)], resolus({ 'moustique:1': 99 }), null)).toBe(true);
  });

  it('accepte un pool dont tous les membres sont dans le périmètre', () => {
    const membres = [membre('moustique', 1), membre('tique', 2)];
    expect(poolEstAccessible(membres, resolus({ 'moustique:1': 7, 'tique:2': 7 }), [7])).toBe(true);
  });

  it('REFUSE un pool mixte — un seul membre hors périmètre suffit', () => {
    // La contre-épreuve centrale : sans elle, un contrôle « au moins un
    // membre accessible » passerait pour correct.
    const membres = [membre('moustique', 1), membre('puce', 5)];
    expect(poolEstAccessible(membres, resolus({ 'moustique:1': 7, 'puce:5': 8 }), [7])).toBe(false);
  });

  it('REFUSE un pool dont un membre est introuvable (absent de la résolution)', () => {
    const membres = [membre('moustique', 1), membre('moustique', 404)];
    expect(poolEstAccessible(membres, resolus({ 'moustique:1': 7 }), [7])).toBe(false);
  });

  it('REFUSE un membre rattaché à aucun projet (projetId null)', () => {
    expect(poolEstAccessible([membre('autre', 3)], new Map([['autre:3', null]]), [7])).toBe(false);
  });

  it('REFUSE un pool vide plutôt que de le laisser passer par vacuité', () => {
    // [].every() vaut true : sans le cas particulier, un pool sans membre
    // serait visible de tous.
    expect(poolEstAccessible([], new Map(), [7])).toBe(false);
    expect(poolEstAccessible(undefined, new Map(), [7])).toBe(false);
  });

  it('REFUSE tout pool pour un utilisateur membre d\'aucun projet', () => {
    expect(poolEstAccessible([membre('moustique', 1)], resolus({ 'moustique:1': 7 }), [])).toBe(false);
  });
});

describe('filtrerPoolsAccessibles — filtrage de la liste', () => {
  const pools = [
    { id: 10, membres: [membre('moustique', 1), membre('moustique', 2)] }, // tout en projet 7
    { id: 11, membres: [membre('moustique', 1), membre('moustique', 3)] }, // 3 en projet 8
    { id: 12, membres: [] },                                               // vide
    { id: 13, membres: [membre('tique', 9)] },                             // spécimen supprimé
  ];
  const projetParMembre = resolus({
    'moustique:1': 7, 'moustique:2': 7, 'moustique:3': 8,
  });

  it('ne garde que les pools entièrement dans le périmètre', () => {
    expect(filtrerPoolsAccessibles(pools, projetParMembre, [7])).toEqual([10]);
  });

  it('garde tout pour un bypass', () => {
    expect(filtrerPoolsAccessibles(pools, projetParMembre, null)).toEqual([10, 11, 12, 13]);
  });

  it('ne garde rien pour un utilisateur sans projet', () => {
    expect(filtrerPoolsAccessibles(pools, projetParMembre, [])).toEqual([]);
  });

  it('exclut un pool dont le spécimen a été supprimé depuis', () => {
    // PoolMembre ne porte aucune clé étrangère vers les tables de spécimens :
    // supprimer un spécimen laisse un membre orphelin. Le pool devient alors
    // définitivement invisible aux non-bypass — conséquence assumée du
    // fail-closed, pas un accident.
    expect(filtrerPoolsAccessibles(pools, projetParMembre, [7, 8])).not.toContain(13);
  });
});

describe('membresInconnus — contrôle d\'existence à la création', () => {
  it('signale les membres qu\'aucun spécimen ne rattache', () => {
    const membres = [membre('moustique', 1), membre('puce', 404)];
    expect(membresInconnus(membres, resolus({ 'moustique:1': 7 }))).toEqual([membre('puce', 404)]);
  });

  it('ne signale rien quand tout est résolu, projet null compris', () => {
    // Un spécimen SANS projet existe bel et bien : ce n'est pas un inconnu,
    // c'est poolEstAccessible qui le refusera.
    const membres = [membre('moustique', 1)];
    expect(membresInconnus(membres, new Map([['moustique:1', null]]))).toEqual([]);
  });
});
