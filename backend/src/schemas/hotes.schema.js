const { z } = require('zod');

const intId = z.coerce.number().int().positive();

const createHote = z.object({
  methodeId:       intId,
  taxonomieHoteId: intId,
  especeLocale:    z.string().max(200).optional().nullable(),
  age:             z.string().max(50).optional().nullable(),
  sexe:            z.enum(['M', 'F', 'inconnu']).default('inconnu'),
  etatSante:       z.string().max(200).optional().nullable(),
  vaccination:     z.string().max(200).optional().nullable(),
  notes:           z.string().max(5000).optional().nullable(),
});

const updateHote = createHote
  .omit({ methodeId: true, taxonomieHoteId: true })
  .partial()
  .refine(d => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

module.exports = { createHote, updateHote };
