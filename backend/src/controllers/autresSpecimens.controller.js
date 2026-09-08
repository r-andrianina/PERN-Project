// backend/src/controllers/autresSpecimens.controller.js
// CRUD des Autres Spécimens (Phlébotomes, Culicoïdes, etc.) factorisé via
// specimenFactory/specimenControllerFactory (voir ces fichiers pour le socle
// partagé avec moustiques/tiques/puces).
// Particularités de ce type : taxonomie optionnelle (jamais vérifiée par
// type), typeSpecimenId (référentiel) obligatoire, attributs libres (JSON),
// split sans restriction de type de container, pas d'import/export Excel.

const { refsReason } = require('../utils/specimenRefs');
const { createSpecimenService }    = require('../services/specimenFactory');
const { createSpecimenController } = require('./specimenControllerFactory');

const includeBase = {
  methode: {
    select: {
      id: true, numero: true,
      typeMethode: { select: { id: true, code: true, nom: true } },
      localite: {
        select: {
          id: true, nom: true, fokontany: true, region: true, district: true, commune: true,
          mission: {
            select: {
              id: true, ordreMission: true, projetId: true,
              projet: { select: { code: true, nom: true } },
            },
          },
        },
      },
    },
  },
  typeSpecimen: { select: { id: true, code: true, nom: true } },
  taxonomie:    { include: { parent: { include: { parent: { include: { parent: true } } } } } },
  solution:     { select: { id: true, nom: true, temperature: true } },
  container:    { select: { id: true, code: true, type: true } },
};

const service = createSpecimenService({
  model: 'autreSpecimen',
  entityLabel: 'AutreSpecimen',
  labelLower: 'spécimen',
  refsKey: 'autre',
  includeBase,
  searchClauses: (search) => [
    { typeSpecimen: { nom: { contains: search, mode: 'insensitive' } } },
    { taxonomie:    { nom: { contains: search, mode: 'insensitive' } } },
    { idTerrain:    { contains: search, mode: 'insensitive' } },
    { notes:        { contains: search, mode: 'insensitive' } },
  ],
  taxonomieRequired: false,
  taxoType: null,
  hasHoteId: false,
  hasTypeSpecimen: true,
  splitContainerTypes: null,
  extraFields: ['attributs'],
  deleteBlockedMessage: (refs) =>
    `Suppression impossible : ce spécimen est référencé par ${refsReason(refs)}. Détachez-le du laboratoire / du pool avant de le supprimer.`,
});

const {
  list: listAutresSpecimens, getOne: getAutreSpecimen, create: createAutreSpecimen,
  update: updateAutreSpecimen, remove: deleteAutreSpecimen,
} = createSpecimenController(service, {
  entityLabel: 'AutreSpecimen',
  itemsKey: 'specimens',
  itemKey: 'specimen',
  messages: { created: 'Spécimen enregistré', updated: 'Spécimen mis à jour', deleted: 'Spécimen supprimé' },
});

module.exports = { listAutresSpecimens, getAutreSpecimen, createAutreSpecimen, updateAutreSpecimen, deleteAutreSpecimen };
