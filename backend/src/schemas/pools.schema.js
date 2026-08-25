const { z } = require('zod');

const intId = z.coerce.number().int().positive();

const SPECIMEN_TYPES = ['moustique', 'tique', 'puce', 'autre'];

const poolMembre = z.object({
  specimenType: z.enum(SPECIMEN_TYPES),
  specimenId:   intId,
});

const createPool = z.object({
  code:    z.string().trim().max(50).optional().nullable(),
  notes:   z.string().max(2000).optional().nullable(),
  membres: z.array(poolMembre).min(1, 'Au moins un spécimen requis'),
});

module.exports = { createPool, SPECIMEN_TYPES };
