// backend/src/routes/rbac.routes.js
// Expose la configuration RBAC (source unique config/rbac.js) au frontend, qui
// l'hydrate au démarrage pour éviter la dérive back/front (F2).

const express = require('express');
const router  = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { ROLE_ORDER, ROLE_LEVELS, BYPASS_ROLES, SPECIMEN_TYPES, DEFAULT_SPECIMEN_ACCESS } = require('../config/rbac');

router.get('/config', verifyToken, (req, res) => {
  res.json({
    roleOrder:             ROLE_ORDER,
    roleLevels:            ROLE_LEVELS,
    bypassRoles:           BYPASS_ROLES,
    specimenTypes:         SPECIMEN_TYPES,
    defaultSpecimenAccess: DEFAULT_SPECIMEN_ACCESS,
  });
});

module.exports = router;
