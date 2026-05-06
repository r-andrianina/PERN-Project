// backend/src/controllers/solutionsConservation.controller.js
const { createReferentielController } = require('./_referentielFactory');

module.exports = createReferentielController({
  entity:   'SolutionConservation',
  delegate: 'solutionConservation',
  fields:   ['nom', 'description', 'temperature'],
  required: ['nom'],
  uniqueField: 'nom',
  relationsCount: { moustiques: true, tiques: true, puces: true },
  label: 'Solution de conservation',
});
