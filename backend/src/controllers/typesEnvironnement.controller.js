// backend/src/controllers/typesEnvironnement.controller.js
const { createReferentielController } = require('./_referentielFactory');

module.exports = createReferentielController({
  entity:   'TypeEnvironnement',
  delegate: 'typeEnvironnement',
  fields:   ['nom', 'description'],
  required: ['nom'],
  uniqueField: 'nom',
  relationsCount: { methodes: true },
  label: 'Type d\'environnement',
});
