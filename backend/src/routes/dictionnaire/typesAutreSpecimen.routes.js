const { createReferentielController } = require('../../controllers/_referentielFactory');
const { buildSimpleRouter }           = require('./_simple.routes');

const ctrl = createReferentielController({
  entity:        'TypeAutreSpecimen',
  delegate:      'typeAutreSpecimen',
  fields:        ['code', 'nom', 'description'],
  required:      ['code', 'nom'],
  relationsCount: { specimens: true },
  label:         'Type de spécimen',
  uniqueField:   'code',
});

module.exports = buildSimpleRouter(ctrl);
