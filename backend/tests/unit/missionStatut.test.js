// Statut d'avancement d'une mission, dérivé des dates et de la saisie.
//
// Les cas qui comptent ne sont pas les trois états évidents mais les
// frontières : le jour même du début, le jour même de la fin, une date de fin
// absente, et la distinction entre « rien n'est saisi » et « tout est saisi
// mais certains pièges n'ont rien pris ».

const { statutMission, STATUT_EST_INCOMPLET } = require('../../src/utils/missionStatut');

const LE = (iso) => new Date(`${iso}T12:00:00Z`);
const AUJ = LE('2026-10-09');

describe('statutMission — avant et pendant le terrain', () => {
  it('une mission à venir est planifiée', () => {
    expect(statutMission({ dateDebut: '2026-10-20', dateFin: '2026-10-25' }, AUJ)).toBe('planifiee');
  });

  it('le JOUR du début, la mission est déjà sur le terrain', () => {
    // Frontière : un `>` mal placé la laisserait « planifiée » alors que
    // l'équipe est partie le matin même.
    expect(statutMission({ dateDebut: '2026-10-09', dateFin: '2026-10-12' }, AUJ)).toBe('terrain');
  });

  it('le JOUR de la fin, la mission est encore sur le terrain', () => {
    expect(statutMission({ dateDebut: '2026-10-05', dateFin: '2026-10-09' }, AUJ)).toBe('terrain');
  });

  it('commencée sans date de fin : on signale la date manquante, pas « sur le terrain »', () => {
    // La saisie ne change rien : tant que la fin manque, c'est elle qu'il faut
    // compléter — même si tous les pièges ont produit.
    expect(statutMission({ dateDebut: '2026-01-05', dateFin: null, methodes: 3, methodesAvecSpecimens: 3 }, AUJ))
      .toBe('sans_fin');
    expect(statutMission({ dateDebut: '2026-10-09', dateFin: null }, AUJ)).toBe('sans_fin');
  });

  it('à venir sans date de fin : planifiée, la fin peut encore attendre', () => {
    expect(statutMission({ dateDebut: '2026-10-20', dateFin: null }, AUJ)).toBe('planifiee');
  });

  it('les dates priment sur la saisie : une mission en cours n\'est jamais « à saisir »', () => {
    // On ne réclame pas la saisie d'une équipe encore sur place.
    expect(statutMission({ dateDebut: '2026-10-08', dateFin: '2026-10-11', methodes: 5, methodesAvecSpecimens: 0 }, AUJ))
      .toBe('terrain');
  });
});

describe('statutMission — mission terminée', () => {
  const terminee = { dateDebut: '2026-09-01', dateFin: '2026-09-05' };

  it('aucune méthode enregistrée → à saisir', () => {
    expect(statutMission({ ...terminee, methodes: 0, methodesAvecSpecimens: 0 }, AUJ)).toBe('a_saisir');
  });

  it('des méthodes mais aucun spécimen → à saisir', () => {
    // Le cas visé par la fonctionnalité : le terrain est rentré, les pièges
    // sont décrits, et personne n'a saisi les captures.
    expect(statutMission({ ...terminee, methodes: 6, methodesAvecSpecimens: 0 }, AUJ)).toBe('a_saisir');
  });

  it('une partie des méthodes a produit → partielle', () => {
    expect(statutMission({ ...terminee, methodes: 6, methodesAvecSpecimens: 4 }, AUJ)).toBe('partielle');
  });

  it('toutes les méthodes ont produit → complète', () => {
    expect(statutMission({ ...terminee, methodes: 6, methodesAvecSpecimens: 6 }, AUJ)).toBe('complete');
  });

  it('une seule méthode, un seul spécimen → complète', () => {
    expect(statutMission({ ...terminee, methodes: 1, methodesAvecSpecimens: 1 }, AUJ)).toBe('complete');
  });
});

describe('statutMission — robustesse', () => {
  it('sans date de début, on ne devine pas : à saisir', () => {
    expect(statutMission({ dateDebut: null, dateFin: null }, AUJ)).toBe('a_saisir');
  });

  it('accepte des Date comme des chaînes ISO', () => {
    const avecChaines = statutMission({ dateDebut: '2026-09-01', dateFin: '2026-09-05', methodes: 2, methodesAvecSpecimens: 2 }, AUJ);
    const avecDates   = statutMission({ dateDebut: LE('2026-09-01'), dateFin: LE('2026-09-05'), methodes: 2, methodesAvecSpecimens: 2 }, AUJ);
    expect(avecDates).toBe(avecChaines);
  });

  it('une date ISO complète ne décale pas le jour', () => {
    // Contre-épreuve du piège de fuseau : comparer des instants ferait basculer
    // la mission d'un jour selon l'heure locale du serveur.
    expect(statutMission({ dateDebut: '2026-10-09T23:30:00.000Z', dateFin: '2026-10-09T23:30:00.000Z' }, AUJ))
      .toBe('terrain');
  });
});

describe('STATUT_EST_INCOMPLET', () => {
  it('ne retient que ce qui demande une action de saisie', () => {
    expect(STATUT_EST_INCOMPLET('sans_fin')).toBe(true);
    expect(STATUT_EST_INCOMPLET('a_saisir')).toBe(true);
    expect(STATUT_EST_INCOMPLET('partielle')).toBe(true);
    expect(STATUT_EST_INCOMPLET('complete')).toBe(false);
    expect(STATUT_EST_INCOMPLET('terrain')).toBe(false);
    expect(STATUT_EST_INCOMPLET('planifiee')).toBe(false);
  });
});
