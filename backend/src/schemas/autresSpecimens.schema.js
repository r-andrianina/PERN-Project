const { z } = require('zod');

const sexeEnum  = z.enum(['M', 'F', 'inconnu']).default('inconnu');
const sexeEnumOpt = z.enum(['M', 'F', 'inconnu']).optional();
const intId     = z.coerce.number().int().positive();
const optIntId  = intId.optional().nullable();
const dateStr   = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();
const idTerrain = z.string().max(50).optional().nullable();

const createAutreSpecimen = z.object({
  methodeId:      intId,
  typeSpecimenId: intId,
  taxonomieId:    optIntId,
  idTerrain,
  nombre:         z.coerce.number().int().positive().default(1),
  sexe:           sexeEnum,
  stade:          z.string().max(50).optional().nullable(),
  solutionId:     optIntId,
  containerId:    optIntId,
  position:       z.string().max(10).optional().nullable(),
  dateCollecte:   dateStr,
  notes:          z.string().max(5000).optional().nullable(),
  attributs:      z.record(z.unknown()).optional().nullable(),
});

const updateAutreSpecimen = createAutreSpecimen
  .omit({ methodeId: true })
  .partial()
  .extend({ sexe: sexeEnumOpt, nombre: z.coerce.number().int().positive().optional() })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

module.exports = { createAutreSpecimen, updateAutreSpecimen };
