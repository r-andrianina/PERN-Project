const { z } = require('zod');

const intId    = z.coerce.number().int().positive();
const optIntId = intId.optional().nullable();
const dateStr  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createMission = z.object({
  ordreMission:  z.string().min(1).max(50),
  projetId:      intId,
  chefMissionId: optIntId,
  // Chef extérieur à l'application (option « personne externe » du formulaire).
  // Le champ manquait au schéma : Zod supprimant les clés non déclarées, la
  // valeur était retirée avant d'atteindre le service et n'arrivait jamais en
  // base — 0 mission sur 8 avait un chefMissionNom malgré l'option proposée.
  chefMissionNom: z.string().max(200).optional().nullable(),
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
