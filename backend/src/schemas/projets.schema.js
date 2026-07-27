const { z } = require('zod');

const CODE_REGEX = /^[A-Za-z0-9\-_]+$/;
const dateField  = z.string().max(50).optional().nullable();

const createProjet = z.object({
  nom:             z.string().min(1, 'Nom requis').max(200).trim(),
  description:     z.string().max(5000).optional().nullable(),
  porteur:         z.string().max(200).trim().optional().nullable(),
  posteAnalytique: z.string().max(150).trim().optional().nullable(),
  responsableId:   z.coerce.number().int().positive().optional().nullable(),
  dateDebut:       dateField,
  dateFin:         dateField,
  statut:          z.enum(['actif', 'termine', 'suspendu']).default('actif'),
});

const updateProjet = z.object({
  nom:             z.string().min(1).max(200).trim().optional(),
  description:     z.string().max(5000).optional().nullable(),
  porteur:         z.string().max(200).trim().optional().nullable(),
  posteAnalytique: z.string().max(150).trim().optional().nullable(),
  responsableId:   z.coerce.number().int().positive().optional().nullable(),
  dateDebut:       dateField,
  dateFin:         dateField,
  statut:          z.enum(['actif', 'termine', 'suspendu']).optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: 'Aucune modification fournie',
});

module.exports = { createProjet, updateProjet };
