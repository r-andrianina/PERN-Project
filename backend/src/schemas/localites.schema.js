const { z } = require('zod');

const optFloat = z.coerce.number().optional().nullable();

const contact = z.object({
  id:        z.coerce.number().int().positive().optional(),
  nom:       z.string().min(1).max(150),
  telephone: z.string().max(50).optional().nullable(),
  statut:    z.string().max(100).optional().nullable(),
});

const createLocalite = z.object({
  missionId:  z.coerce.number().int().positive(),
  code:       z.string().regex(/^[A-Z]{3}$/).optional().nullable(),
  // Champ unique côté formulaire — le backend mirroire vers la colonne toponyme.
  nom:        z.string().min(1).max(200),
  pays:       z.string().max(100).optional().default('Madagascar'),
  region:     z.string().max(100).optional().nullable(),
  district:   z.string().max(100).optional().nullable(),
  commune:    z.string().max(100).optional().nullable(),
  fokontany:  z.string().max(100).optional().nullable(),
  contacts:   z.array(contact).optional(),
  latitude:   optFloat,
  longitude:  optFloat,
  altitudeM:  optFloat,
});

const updateLocalite = createLocalite
  .omit({ missionId: true })
  .partial()
  // Sous Zod v4, .partial() sur un champ .default() réinjecte la valeur par
  // défaut pour les clés absentes — on retire .default() ici pour ne pas
  // écraser silencieusement "pays" lors d'une mise à jour partielle.
  .extend({ pays: z.string().max(100).optional() })
  .refine(d => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

module.exports = { createLocalite, updateLocalite };
