const { z } = require('zod');

const intId    = z.coerce.number().int().positive();
const optIntId = intId.optional().nullable();
const optFloat = z.coerce.number().optional().nullable();
// Format natif d'un <input type="datetime-local"> : "YYYY-MM-DDTHH:mm"
const datetimeStr = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/).optional().nullable();

const INTERIEUR_EXTERIEUR = ['interieur', 'exterieur'];

const createMethode = z.object({
  localiteId:          intId,
  typeMethodeId:       intId,
  typeHabitatId:       optIntId,
  typeEnvironnementId: optIntId,
  interieurExterieur:  z.enum(INTERIEUR_EXTERIEUR).optional().nullable(),
  latitude:            optFloat,
  longitude:           optFloat,
  altitudeM:           optFloat,
  datePose:            datetimeStr,
  dateReleve:          datetimeStr,
  notes:               z.string().max(5000).optional().nullable(),
});

const updateMethode = createMethode
  .omit({ localiteId: true })
  .partial()
  .refine(d => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

module.exports = { createMethode, updateMethode };
