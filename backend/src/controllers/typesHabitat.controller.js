// backend/src/controllers/typesHabitat.controller.js
const { createReferentielController } = require('./_referentielFactory');

module.exports = createReferentielController({
  entity:   'TypeHabitat',
  delegate: 'typeHabitat',
  fields:   ['nom', 'description'],
  required: ['nom'],
  uniqueField: 'nom',
  relationsCount: { methodes: true },
  label: 'Type d\'habitat',
});
