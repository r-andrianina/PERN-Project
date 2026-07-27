const { createReferentielController } = require('../../controllers/_referentielFactory');
const { buildSimpleRouter }           = require('./_simple.routes');

const ctrl = createReferentielController({
  entity:        'PathogeneCible',
  delegate:      'pathogeneCible',
  fields:        ['code', 'nom', 'famille', 'typeOrg', 'typeAN', 'description'],
  required:      ['code', 'nom'],
  relationsCount: {},
  label:         'Pathogène cible',
  uniqueField:   'code',
});

module.exports = buildSimpleRouter(ctrl);
