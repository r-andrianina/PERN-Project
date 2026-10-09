// backend/src/controllers/personnel.controller.js
// Dictionnaire Personnel : qui peut être chef de mission ou agent de terrain.
//
// CRUD standard de la fabrique, plus deux choses qu'elle ne sait pas faire :
//   · un contrôle de doublon tolérant (accents, casse, ordre des mots — cf.
//     utils/personnelNom.js), là où la fabrique ne compare que la graphie exacte ;
//   · l'import de l'annuaire Excel, qui met à jour les fiches existantes au
//     lieu de les dupliquer.

const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { logAudit, ACTIONS } = require('../utils/audit');
const { createReferentielController } = require('./_referentielFactory');
const { chargerClasseurUtilisateur, premiereFeuille, assertVolumeTraitable } = require('../utils/excelGuards');
const { nettoyerNom, cleNom } = require('../utils/personnelNom');

const base = createReferentielController({
  entity:         'Personnel',
  delegate:       'personnel',
  fields:         ['nom', 'fonction', 'equipe'],
  required:       ['nom'],
  uniqueField:    'nom',
  searchFields:   ['nom', 'fonction', 'equipe'],
  relationsCount: { missionsChef: true, missions: true },
  label:          'Personne',
});

/** Fiche existante portant le même nom (au sens de cleNom), hors `saufId`. */
async function homonyme(nom, saufId) {
  const cle = cleNom(nom);
  const fiches = await prisma.personnel.findMany({ select: { id: true, nom: true } });
  return fiches.find((p) => p.id !== saufId && cleNom(p.nom) === cle) ?? null;
}

const refuserHomonyme = (h) => {
  throw AppError.conflict(`« ${h.nom} » existe déjà dans le dictionnaire — même personne ?`);
};

const create = async (req, res) => {
  if (req.body.nom) {
    req.body.nom = nettoyerNom(req.body.nom);
    const h = await homonyme(req.body.nom);
    if (h) refuserHomonyme(h);
  }
  return base.create(req, res);
};

const update = async (req, res) => {
  if (req.body.nom !== undefined) {
    req.body.nom = nettoyerNom(req.body.nom);
    if (!req.body.nom) throw AppError.badRequest('Le champ "nom" est obligatoire');
    const h = await homonyme(req.body.nom, parseInt(req.params.id));
    if (h) refuserHomonyme(h);
  }
  return base.update(req, res);
};

// ── Import de l'annuaire ──────────────────────────────────────────
// Colonnes positionnelles, en-tête obligatoire (ligne 1, ignorée) :
//   1 Nom complet · 2 Fonction · 3 Équipe · 4 Actif (oui/non)
// Une 5e colonne (remarques de relecture) est tolérée et ignorée.

const cellTexte = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.text != null) return cellTexte(v.text);
    if (v.result != null) return String(v.result);
  }
  return String(v);
};

const lireActif = (v) => {
  const s = cellTexte(v).trim().toLowerCase();
  if (!s) return undefined;                      // vide : on ne touche pas
  if (['oui', 'o', 'yes', 'y', 'true', '1', 'vrai', 'actif'].includes(s)) return true;
  if (['non', 'n', 'no', 'false', '0', 'faux', 'inactif'].includes(s)) return false;
  return null;                                   // valeur illisible
};

const importExcel = async (req, res) => {
  if (!req.file) throw AppError.badRequest('Aucun fichier reçu.');
  const wb = await chargerClasseurUtilisateur(req.file.buffer);
  const ws = premiereFeuille(wb);
  assertVolumeTraitable(ws, 2000);

  const existantes = await prisma.personnel.findMany();
  const parCle = new Map(existantes.map((p) => [cleNom(p.nom), p]));

  const erreurs = [];
  const vues = new Map(); // clé → n° de ligne, pour les doublons internes au fichier
  const aCreer = [];
  const aMettreAJour = [];
  let inchangees = 0;

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const nom = nettoyerNom(cellTexte(row.getCell(1).value));
    const fonction = nettoyerNom(cellTexte(row.getCell(2).value));
    const equipe = nettoyerNom(cellTexte(row.getCell(3).value));
    const actif = lireActif(row.getCell(4).value);

    if (!nom) {
      if (fonction || equipe) erreurs.push({ ligne: n, message: 'nom complet manquant' });
      return;
    }
    if (nom.length > 200) { erreurs.push({ ligne: n, message: 'nom de plus de 200 caractères' }); return; }
    if (fonction.length > 200) { erreurs.push({ ligne: n, message: 'fonction de plus de 200 caractères' }); return; }
    if (equipe.length > 100) { erreurs.push({ ligne: n, message: 'équipe de plus de 100 caractères' }); return; }
    if (actif === null) {
      erreurs.push({ ligne: n, message: `colonne Actif illisible (« ${cellTexte(row.getCell(4).value)} ») — attendu oui ou non` });
      return;
    }

    const cle = cleNom(nom);
    if (vues.has(cle)) {
      erreurs.push({ ligne: n, message: `« ${nom} » figure déjà ligne ${vues.get(cle)} du fichier` });
      return;
    }
    vues.set(cle, n);

    const fiche = parCle.get(cle);
    if (!fiche) {
      aCreer.push({ nom, fonction: fonction || null, equipe: equipe || null, actif: actif ?? true });
      return;
    }
    // Une cellule vide ne vide pas la fiche : elle laisse la valeur en place.
    const patch = {};
    if (fonction && fonction !== fiche.fonction) patch.fonction = fonction;
    if (equipe && equipe !== fiche.equipe) patch.equipe = equipe;
    if (actif !== undefined && actif !== fiche.actif) patch.actif = actif;
    if (Object.keys(patch).length) aMettreAJour.push({ id: fiche.id, nom: fiche.nom, patch });
    else inchangees++;
  });

  // Tout ou rien : une erreur de ligne bloque l'import entier, pour qu'un
  // fichier corrigé puisse être renvoyé tel quel sans créer de demi-état.
  if (erreurs.length) {
    return res.status(400).json({ error: `${erreurs.length} ligne(s) à corriger — rien n'a été importé.`, erreurs });
  }

  const userId = req.user?.id ?? null;
  await prisma.$transaction(async (tx) => {
    if (aCreer.length) {
      await tx.personnel.createMany({
        data: aCreer.map((p) => ({ ...p, createdById: userId, updatedById: userId })),
      });
    }
    for (const { id, patch } of aMettreAJour) {
      await tx.personnel.update({ where: { id }, data: { ...patch, updatedById: userId } });
    }
  });

  const resume = { creees: aCreer.length, misesAJour: aMettreAJour.length, inchangees };
  await logAudit({
    // entity_id est obligatoire et l'import ne vise pas une fiche unique.
    req, action: ACTIONS.CREATE, entity: 'ImportPersonnel', entityId: 0,
    newValues: { import: req.file.originalname, ...resume },
  });

  // Fiches absentes du fichier : souvent un compte repris par la migration sous
  // une autre graphie (« Michaël TANTELY » contre « Michaël Luciano TANTELY »).
  // On les signale pour fusion manuelle plutôt que de deviner.
  const absentes = existantes
    .filter((p) => p.actif && !vues.has(cleNom(p.nom)))
    .map((p) => p.nom)
    .sort((a, b) => a.localeCompare(b, 'fr'));

  return res.json({ message: 'Import terminé', ...resume, absentes });
};

module.exports = { ...base, create, update, importExcel };
