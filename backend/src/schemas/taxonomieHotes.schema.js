// Schéma Zod du référentiel taxonomie-hotes.
// Miroir de schemas/taxonomieSpecimens.schema.js, sans les champs absents du
// modèle TaxonomieHote (type, auteur, annee, paysType) — voir schema.prisma.
// La validation hiérarchique (parent compatible, doublons) reste dans le
// contrôleur car elle nécessite des accès base.
//
// NB : schémas create/update explicites (pas de omit().partial()) — évite le bug
// Zod v4 où .partial().default() réinjecte les défauts sur les updates. Et
// .trim() AVANT .min() sur nom — sinon un nom fait uniquement d'espaces passe
// min(1) (longueur brute > 0) puis est tronqué à '' (bug déjà rencontré et
// corrigé sur auth/projets, évité ici dès l'écriture).

const { z } = require('zod');

const NIVEAUX = ['ordre', 'famille', 'sous_famille', 'genre', 'sous_genre', 'espece', 'sous_espece'];

const emptyToNull = (v) => (v === '' ? null : v);

const parentIdField = z.preprocess(
  emptyToNull,
  z.coerce.number().int().positive().nullable().optional(),
);

const createTaxonomieHote = z.object({
  niveau:      z.enum(NIVEAUX),
  nom:         z.string().trim().min(1, 'Nom requis').max(150),
  parentId:    parentIdField,
  nomCommun:   z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
});

// niveau non modifiable après création (le contrôleur ne le lit pas en update).
const updateTaxonomieHote = z.object({
  nom:         z.string().trim().min(1).max(150).optional(),
  parentId:    parentIdField,
  nomCommun:   z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: 'Aucune modification fournie',
});

module.exports = { createTaxonomieHote, updateTaxonomieHote };
