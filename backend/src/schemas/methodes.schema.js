const { z } = require('zod');

const intId    = z.coerce.number().int().positive();
const optIntId = intId.optional().nullable();
const optFloat = z.coerce.number().optional().nullable();
const dateStr  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();

const createMethode = z.object({
  localiteId:          intId,
  typeMethodeId:       intId,
  typeHabitatId:       optIntId,
  typeEnvironnementId: optIntId,
  latitude:            optFloat,
  longitude:           optFloat,
  dateCollecte:        dateStr,
  heureDebut:          z.string().max(10).optional().nullable(),
  heureFin:            z.string().max(10).optional().nullable(),
  notes:               z.string().max(5000).optional().nullable(),
});

const updateMethode = createMethode
  .omit({ localiteId: true })
  .partial()
  .refine(d => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

module.exports = { createMethode, updateMethode };
