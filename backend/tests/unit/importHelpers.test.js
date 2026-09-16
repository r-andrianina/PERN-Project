// Helpers purs de l'import Excel (import.controller.js).
//
// Régressions couvertes (2026-09-09) :
//   - toDate() interprétait un numéro de série Excel comme des millisecondes
//     depuis l'epoch : une colonne de dates non formatée « date » enregistrait
//     1970-01-01 pour TOUTES les lignes, sans le moindre avertissement ;
//   - aucun plafond ne bornait le rapport renvoyé : un fichier entièrement
//     fautif produisait une réponse JSON de plusieurs dizaines de Mo ;
//   - les longueurs VarChar n'étaient pas vérifiées avant insertion.

const { __test__ } = require('../../src/controllers/import.controller');
const { toDate, tronquer, nouveauJournal, parLots, datePoseParDefaut, LONGUEURS_MAX } = __test__;

describe('toDate — dates Excel', () => {
  it('conserve un objet Date tel quel', () => {
    const d = new Date('2024-03-15T00:00:00Z');
    expect(toDate(d)).toBe(d);
  });

  it('convertit un numéro de série Excel, pas des millisecondes', () => {
    // 45366 = 2024-03-15 dans le calendrier Excel (référence 1899-12-30).
    const d = toDate(45366);
    expect(d.toISOString().slice(0, 10)).toBe('2024-03-15');
    // Le bug : new Date(45366) donnait 1970-01-01.
    expect(d.getUTCFullYear()).not.toBe(1970);
  });

  it('ignore la fraction horaire du numéro de série', () => {
    expect(toDate(45366.75).toISOString().slice(0, 10)).toBe('2024-03-15');
  });

  it('rejette un nombre hors de la plage des dates Excel', () => {
    expect(toDate(0)).toBeNull();
    expect(toDate(-5)).toBeNull();
    expect(toDate(99999999)).toBeNull();
  });

  it('accepte une date ISO en texte', () => {
    expect(toDate('2024-03-15').toISOString().slice(0, 10)).toBe('2024-03-15');
  });

  it('renvoie null sur une valeur vide ou illisible', () => {
    for (const v of [null, undefined, '', 'pas une date', new Date('nawak')]) {
      expect(toDate(v)).toBeNull();
    }
  });
});

describe('tronquer — gabarits VarChar', () => {
  it('laisse passer une valeur dans les clous, sans signaler', () => {
    const vus = [];
    expect(tronquer('MPM-2024-0001', 'idTerrain', (...a) => vus.push(a))).toBe('MPM-2024-0001');
    expect(vus).toEqual([]);
  });

  it('tronque et signale au-delà du gabarit', () => {
    const vus = [];
    const long = 'X'.repeat(80);
    const out  = tronquer(long, 'idTerrain', (niveau, code) => vus.push([niveau, code]));
    expect(out).toHaveLength(LONGUEURS_MAX.idTerrain);
    expect(vus).toEqual([['avertissement', 'VALEUR_TRONQUEE']]);
  });

  it('laisse null intact', () => {
    expect(tronquer(null, 'position', () => {})).toBeNull();
  });
});

describe('nouveauJournal — bornage du rapport', () => {
  it('borne le détail mais garde des compteurs exacts', () => {
    const j = nouveauJournal(3);
    for (let i = 0; i < 10; i++) {
      j.push({ ligne: i, idTerrain: null, niveau: 'erreur', code: 'DOUBLON', raison: 'x' });
    }
    expect(j.entrees).toHaveLength(3);
    expect(j.omis).toBe(7);
    // Le compteur, lui, n'est pas tronqué : c'est ce que lit l'utilisateur.
    expect(j.resume.DOUBLON).toBe(10);
    expect(j.compteurs.erreur).toBe(10);
  });

  it('annonce la troncature dans le rapport', () => {
    const j = nouveauJournal(1);
    j.push({ niveau: 'erreur', code: 'A', raison: '1' });
    j.push({ niveau: 'erreur', code: 'B', raison: '2' });
    const entrees = j.finaliser();
    expect(entrees.at(-1).code).toBe('RAPPORT_TRONQUE');
    expect(entrees.at(-1).raison).toMatch(/1 message/);
  });

  it('ne signale rien quand rien n\'est tronqué', () => {
    const j = nouveauJournal(10);
    j.push({ niveau: 'info', code: 'A', raison: '1' });
    expect(j.finaliser().map((e) => e.code)).toEqual(['A']);
  });
});

describe('parLots — découpage des listes passées à un `in:` Prisma', () => {
  it('découpe sans perdre ni dupliquer', () => {
    const src = Array.from({ length: 10 }, (_, i) => i);
    const lots = parLots(src, 3);
    expect(lots.map((l) => l.length)).toEqual([3, 3, 3, 1]);
    expect(lots.flat()).toEqual(src);
  });

  it('renvoie une liste vide pour une entrée vide', () => {
    expect(parLots([], 100)).toEqual([]);
  });
});

describe('datePoseParDefaut — nuit-piège', () => {
  // Contexte (2026-09-16) : la date du fichier IPM (DATE_OF_COLLECTION) est le
  // matin où le piège a été RELEVÉ. Elle alimente dateReleve, et la pose est
  // déduite à J-1. Auparavant c'était l'inverse — la date allait dans datePose
  // et le relevé était déduit à J+1 — ce qui datait toute la base d’un jour
  // trop tard. Inverser ce sens à nouveau ferait échouer la recherche de
  // méthode existante et dupliquerait chaque méthode à l'import.
  const veille = (s) => datePoseParDefaut(new Date(s)).toISOString().slice(0, 10);

  it('renvoie la veille du relevé', () => {
    expect(veille('2026-02-24T00:00:00Z')).toBe('2026-02-23');
  });

  it('traverse un début de mois', () => {
    expect(veille('2026-03-01T00:00:00Z')).toBe('2026-02-28');
  });

  it('traverse un début d’année', () => {
    expect(veille('2026-01-01T00:00:00Z')).toBe('2025-12-31');
  });

  it('gère le 29 février d’une année bissextile', () => {
    expect(veille('2024-03-01T00:00:00Z')).toBe('2024-02-29');
  });

  it('travaille en UTC — une date proche de minuit ne dérive pas d’un jour', () => {
    // Le serveur peut tourner sur un fuseau décalé (UTC+3 à Madagascar) :
    // setDate/getDate en heure locale décalerait le résultat d’un jour.
    expect(veille('2026-05-20T23:59:59Z')).toBe('2026-05-19');
    expect(veille('2026-05-20T00:00:00Z')).toBe('2026-05-19');
  });

  it('ne renvoie rien sans date de relevé', () => {
    expect(datePoseParDefaut(null)).toBeNull();
    expect(datePoseParDefaut(undefined)).toBeNull();
  });

  it('ne modifie pas la date reçue', () => {
    const d = new Date('2026-02-24T00:00:00Z');
    datePoseParDefaut(d);
    expect(d.toISOString().slice(0, 10)).toBe('2026-02-24');
  });

  it('pose et relevé encadrent exactement une nuit', () => {
    const releve = new Date('2026-02-24T00:00:00Z');
    const pose   = datePoseParDefaut(releve);
    expect((releve - pose) / 86400000).toBe(1);
  });
});
