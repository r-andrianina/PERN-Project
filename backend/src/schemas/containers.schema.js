const { z } = require('zod');

const intId = z.coerce.number().int().positive();

const TYPES = ['PLAQUE', 'BOITE'];

const createContainer = z.object({
  type:      z.enum(TYPES),
  missionId: intId,
  notes:     z.string().max(2000).optional().nullable(),
});

// service.update() ne persiste que "notes" — voir containers.service.js:64-68.
const updateContainer = z.object({
  notes: z.string().max(2000).optional().nullable(),
});

module.exports = { createContainer, updateContainer, TYPES };
