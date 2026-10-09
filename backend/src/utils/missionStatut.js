// backend/src/utils/missionStatut.js
// État d'avancement d'une mission, DÉRIVÉ et jamais saisi.
//
// `Mission` n'a pas de colonne `statut`, contrairement à `Projet` — et c'est
// volontaire. Un statut qu'on coche à la main se désynchronise de la réalité :
// il reste dans les notes du projet une mission dont le statut est « à
// revérifier manuellement » depuis juin 2026. Un statut calculé à la lecture
// ne peut pas mentir, et il est juste rétroactivement sur les missions déjà
// enregistrées.
//
// La question à laquelle il répond est opérationnelle : QU'EST-CE QUI TRAÎNE ?
// Une mission rentrée du terrain dont les spécimens ne sont pas saisis
// n'apparaissait nulle part.

const STATUTS = ['planifiee', 'terrain', 'a_saisir', 'partielle', 'complete'];

/** Jour civil au format YYYY-MM-DD, en UTC. */
// Les colonnes sont des `@db.Date` : comparer des instants ferait basculer une
// mission d'un jour selon le fuseau du serveur. On compare donc des chaînes de
// jour, comme le fait déjà le reste du projet pour `dateCollecte`.
const jour = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/**
 * @param {object} mission
 * @param {Date|string}      mission.dateDebut
 * @param {Date|string|null} mission.dateFin
 * @param {number} mission.methodes               nombre de méthodes de collecte
 * @param {number} mission.methodesAvecSpecimens  dont au moins un spécimen saisi
 * @param {Date}   [maintenant]                   injecté pour les tests
 * @returns {'planifiee'|'terrain'|'a_saisir'|'partielle'|'complete'}
 */
function statutMission({ dateDebut, dateFin, methodes = 0, methodesAvecSpecimens = 0 }, maintenant = new Date()) {
  const aujourdhui = jour(maintenant);
  const debut      = jour(dateDebut);
  const fin        = jour(dateFin);

  // Une mission sans date de début n'existe pas en base (colonne NOT NULL),
  // mais la fonction est appelée sur des données d'API : ne pas supposer.
  if (!debut) return 'a_saisir';

  if (debut > aujourdhui) return 'planifiee';

  // Date de fin absente = mission jamais clôturée. Elle reste « sur le
  // terrain » indéfiniment, et c'est le comportement voulu : l'anomalie est la
  // date manquante, et la faire remarquer vaut mieux que de deviner une fin.
  if (!fin || fin >= aujourdhui) return 'terrain';

  // ── Mission terminée : l'avancement se lit dans la saisie ──
  // Aucune méthode du tout : rien n'a encore été enregistré de ce terrain.
  if (methodes === 0)                     return 'a_saisir';
  if (methodesAvecSpecimens === 0)        return 'a_saisir';
  if (methodesAvecSpecimens < methodes)   return 'partielle';
  return 'complete';
}

/**
 * Une méthode sans aucun spécimen n'est pas forcément un oubli de saisie : un
 * piège peut n'avoir rien capturé. « Partielle » signale donc quelque chose à
 * VÉRIFIER, pas une faute — le libellé côté interface doit rester neutre.
 */
const STATUT_EST_INCOMPLET = (s) => s === 'a_saisir' || s === 'partielle';

module.exports = { statutMission, STATUTS, STATUT_EST_INCOMPLET };
