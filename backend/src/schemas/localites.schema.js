const { z } = require('zod');

const optFloat = z.coerce.number().optional().nullable();

const createLocalite = z.object({
  missionId:  z.coerce.number().int().positive(),
  code:       z.string().regex(/^[A-Z]{3}$/).optional().nullable(),
  nom:        z.string().min(1).max(200),
  toponyme:   z.string().max(200).optional().nullable(),
  pays:       z.string().max(100).optional().default('Madagascar'),
  region:     z.string().max(100).optional().nullable(),
  district:   z.string().max(100).optional().nullable(),
  commune:    z.string().max(100).optional().nullable(),
  fokontany:  z.string().max(100).optional().nullable(),
  latitude:   optFloat,
  longitude:  optFloat,
  altitudeM:  optFloat,
});

const updateLocalite = createLocalite
  .omit({ missionId: true })
  .partial()
  .refine(d => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

module.exports = { createLocalite, updateLocalite };
