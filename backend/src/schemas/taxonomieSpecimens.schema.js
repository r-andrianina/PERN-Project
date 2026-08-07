// Schéma Zod du référentiel taxonomie-specimens.
// Aligne ce contrôleur (jusqu'ici validé « à la main ») sur le reste du backend :
// bornes de longueur (→ 400 propre au lieu d'un 500 P2000 quand un champ dépasse
// la colonne), enums niveau/type, année plausible. La validation hiérarchique
// (parent d'un niveau compatible, propagation du type, doublons) reste dans le
// contrôleur car elle nécessite des accès base.
//
// NB : schémas create/update explicites (pas de omit().partial()) — évite le bug
// Zod v4 où .partial().default() réinjecte les défauts sur les updates.

const { z } = require('zod');

const NIVEAUX = ['ordre', 'famille', 'sous_famille', 'genre', 'sous_genre', 'espece', 'sous_espece'];
const TYPES   = ['moustique', 'tique', 'puce', 'autre'];

// parentId / annee arrivent souvent en chaîne vide depuis un formulaire :
// on la traite comme "pas de valeur" (null), MAIS on laisse `undefined`
// intact — en update, undefined = « ne pas toucher », null = « mettre à la
// racine / vider », deux sémantiques différentes qu'il ne faut pas confondre.
const emptyToNull = (v) => (v === '' ? null : v);

const parentIdField = z.preprocess(
  emptyToNull,
  z.coerce.number().int().positive().nullable().optional(),
);

const anneeField = z.preprocess(
  emptyToNull,
  z.coerce.number().int().gte(1700).lte(2100).nullable().optional(),
);

// .trim() AVANT .min()/.max() : sinon un nom composé uniquement d'espaces
// passerait le min(1) (longueur brute > 0) puis serait tronqué à '' — un nom
// vide en base. Le trim doit précéder les contraintes de longueur.
const createTaxonomieSpecimen = z.object({
  niveau:      z.enum(NIVEAUX),
  nom:         z.string().trim().min(1, 'Nom requis').max(150),
  parentId:    parentIdField,
  type:        z.enum(TYPES).optional().nullable(),
  auteur:      z.string().trim().max(100).optional().nullable(),
  annee:       anneeField,
  paysType:    z.string().trim().max(150).optional().nullable(),
  nomCommun:   z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
});

// niveau non modifiable après création (le contrôleur ne le lit pas en update).
const updateTaxonomieSpecimen = z.object({
  nom:         z.string().trim().min(1).max(150).optional(),
  parentId:    parentIdField,
  type:        z.enum(TYPES).optional().nullable(),
  auteur:      z.string().trim().max(100).optional().nullable(),
  annee:       anneeField,
  paysType:    z.string().trim().max(150).optional().nullable(),
  nomCommun:   z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: 'Aucune modification fournie',
});

module.exports = { createTaxonomieSpecimen, updateTaxonomieSpecimen };
