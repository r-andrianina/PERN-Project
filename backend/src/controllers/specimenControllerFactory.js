// backend/src/controllers/specimenControllerFactory.js
//
// Glue HTTP au-dessus de specimenFactory.js : req/res + logAudit (avec req,
// donc ici et pas dans le service — cf. convention du projet). Les formes de
// réponse JSON (clés "moustiques"/"moustique", "specimens"/"specimen"...)
// sont préservées à l'identique pour ne rien casser côté frontend.

const { logAudit, ACTIONS } = require('../utils/audit');

/**
 * @param {object} service   renvoyé par createSpecimenService(config)
 * @param {object} config
 * @param {string} config.entityLabel   ex: 'Moustique' — pour logAudit
 * @param {string} config.itemsKey      clé de la liste dans la réponse JSON (ex: 'moustiques', 'specimens')
 * @param {string} config.itemKey       clé de l'élément unique dans la réponse JSON (ex: 'moustique', 'specimen')
 * @param {object} config.messages      { created, updated, deleted } — textes exacts avec accord de genre
 */
function createSpecimenController(service, config) {
  const { entityLabel, itemsKey, itemKey, messages } = config;

  const list = async (req, res) => {
    const { total, page, limit, pages, items } = await service.list(req.query, req.user);
    res.json({ total, page, limit, pages, [itemsKey]: items });
  };

  const getOne = async (req, res) => {
    const item = await service.getById(parseInt(req.params.id), req.user);
    res.json({ [itemKey]: item });
  };

  const create = async (req, res) => {
    const result = await service.create(req.body, req.user);
    if (result.split) {
      return res.status(201).json({ message: result.message, count: result.count, positions: result.positions });
    }
    const { item } = result;
    await logAudit({ req, action: ACTIONS.CREATE, entity: entityLabel, entityId: item.id, newValues: service.pickAuditFields(item) });
    return res.status(201).json({ message: messages.created, [itemKey]: item });
  };

  const update = async (req, res) => {
    const id = parseInt(req.params.id);
    const { before, item } = await service.update(id, req.body, req.user);
    await logAudit({ req, action: ACTIONS.UPDATE, entity: entityLabel, entityId: id, oldValues: before, newValues: service.pickAuditFields(item, { includeNotesDate: true }) });
    return res.json({ message: messages.updated, [itemKey]: item });
  };

  const remove = async (req, res) => {
    const id = parseInt(req.params.id);
    const { before } = await service.remove(id, req.user);
    await logAudit({ req, action: ACTIONS.DELETE, entity: entityLabel, entityId: id, oldValues: before });
    return res.json({ message: messages.deleted });
  };

  return { list, getOne, create, update, remove };
}

module.exports = { createSpecimenController };
