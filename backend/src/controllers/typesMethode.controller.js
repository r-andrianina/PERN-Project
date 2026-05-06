// backend/src/controllers/typesMethode.controller.js
const { createReferentielController } = require('./_referentielFactory');

module.exports = createReferentielController({
  entity:   'TypeMethodeCollecte',
  delegate: 'typeMethodeCollecte',
  fields:   ['code', 'nom', 'description'],
  required: ['code', 'nom'],
  uniqueField: 'code',
  relationsCount: { methodes: true },
  label: 'Type de méthode',
});
