// backend/src/utils/protocoleTube.js
// Contrôle du protocole de conservation en TUBE (containers de type BOITE).
//
// Règle SOP (arbitrage utilisateur 2026-09-04) :
//   « un tube ne doit pas contenir plus de 10 individus, tous de même espèce,
//     sexe, statut sanguin, piège, localité et date »
//
// Les Anopheles vont en puits de plaque (un spécimen par puits) : la règle ne
// les concerne pas. Seuls les autres genres sont mis en tube.
//
// Partagé entre l'import et la validation à sec pour que l'aperçu annonce
// exactement ce que fera l'import.
//
// Portée : AVERTISSEMENT, jamais blocage. Ce qui rejette réellement une ligne
// reste l'unicité de l'identifiant terrain — règle structurelle. Le protocole
// est une règle métier : on la signale, on ne l'impose pas.

const MAX_INDIVIDUS_PAR_TUBE = 10;

// Ordre d'affichage des divergences dans le message.
const DIMENSIONS = [
  ['espece',  'espèce',         'espèces'],
  ['piege',   'piège',          'pièges'],
  ['sexe',    'sexe',           'sexes'],
  ['sang',    'statut sanguin', 'statuts sanguins'],
  ['localite', 'localité',      'localités'],
  ['date',    'date',           'dates'],
];

/**
 * Enregistre une ligne de fichier dans le registre des tubes.
 * Sans effet si la ligne ne concerne pas un tube (plaque, ou pas de container).
 *
 * @param {Map} registre       accumulateur, créé par `nouveauRegistre()`
 * @param {object} ligne
 * @param {string} ligne.box       code du container
 * @param {string} ligne.tube      position/étiquette du tube
 * @param {boolean} ligne.estBoite false pour une plaque → ignoré
 * @param {number} ligne.individus valeur de NUMBER
 * @param {number} ligne.rn        numéro de ligne Excel
 * @param {object} ligne.dims      { espece, piege, sexe, sang, localite, date }
 */
function enregistrerTube(registre, { box, tube, estBoite, individus, rn, dims }) {
  if (!estBoite || !box || !tube) return;
  const cle = `${box}|${tube}`;
  if (!registre.has(cle)) {
    registre.set(cle, { box, tube, individus: 0, lignes: [], valeurs: new Map() });
  }
  const t = registre.get(cle);
  t.individus += individus || 0;
  t.lignes.push(rn);
  for (const [champ] of DIMENSIONS) {
    // Une valeur absente n'est pas une divergence : on ne reproche pas à
    // l'opérateur une colonne qu'il n'a pas remplie, c'est signalé ailleurs.
    const v = dims?.[champ];
    if (v === null || v === undefined || v === '') continue;
    if (!t.valeurs.has(champ)) t.valeurs.set(champ, new Set());
    t.valeurs.get(champ).add(String(v));
  }
}

const nouveauRegistre = () => new Map();

/**
 * Analyse le registre et renvoie un message par tube hors protocole.
 * @returns {Array<{ box, tube, individus, lignes, raison }>}
 */
function tubesHorsProtocole(registre) {
  const sorties = [];
  for (const t of registre.values()) {
    const surcharge = t.individus > MAX_INDIVIDUS_PAR_TUBE;
    const divergences = DIMENSIONS
      .filter(([champ]) => (t.valeurs.get(champ)?.size ?? 0) > 1)
      .map(([champ, sing, plur]) => {
        const n = t.valeurs.get(champ).size;
        return `${n} ${n > 1 ? plur : sing}`;
      });
    if (!surcharge && !divergences.length) continue;

    const morceaux = [];
    if (surcharge) {
      morceaux.push(`${t.individus} individus (maximum ${MAX_INDIVIDUS_PAR_TUBE})`);
    }
    if (divergences.length) morceaux.push(`contenu non homogène : ${divergences.join(', ')}`);

    sorties.push({
      box: t.box,
      tube: t.tube,
      individus: t.individus,
      lignes: t.lignes,
      raison: `Tube "${t.tube}" (${t.box}) sur ${t.lignes.length} ligne(s) — ${morceaux.join(' ; ')}.`
            + ' Un tube doit contenir au plus 10 individus de même espèce, sexe, statut sanguin, piège, localité et date.',
    });
  }
  // Les cas les plus graves d'abord.
  return sorties.sort((a, b) => b.individus - a.individus);
}

module.exports = { nouveauRegistre, enregistrerTube, tubesHorsProtocole, MAX_INDIVIDUS_PAR_TUBE };
