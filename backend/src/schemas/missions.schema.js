const { z } = require('zod');

const intId    = z.coerce.number().int().positive();
const optIntId = intId.optional().nullable();
const dateStr  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createMission = z.object({
  ordreMission:  z.string().min(1).max(50),
  projetId:      intId,
  chefMissionId: optIntId,
  dateDebut:     dateStr,
  dateFin:       dateStr.optional().nullable(),
  objet:         z.string().max(5000).optional().nullable(),
  observations:  z.string().max(5000).optional().nullable(),
  agentIds:      z.array(intId).max(20).optional(),
});

const updateMission = createMission
  .omit({ ordreMission: true, projetId: true })
  .partial()
  .refine(d => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

module.exports = { createMission, updateMission };
