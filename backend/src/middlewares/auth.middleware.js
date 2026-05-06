// backend/src/middlewares/auth.middleware.js
// Vérification JWT + guards par rôle

const jwt = require('jsonwebtoken');

// =============================================================
//  VÉRIFICATION DU TOKEN JWT
// =============================================================

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Accès refusé — token manquant' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role, nom, prenom }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token invalide ou expiré' });
  }
};

// =============================================================
//  HIÉRARCHIE DES RÔLES
//  admin > chercheur > terrain > lecteur
// =============================================================

const ROLES_HIERARCHY = {
  admin:      4,
  chercheur:  3,
  terrain:    2,
  lecteur:    1,
};

// Guard : autorise uniquement les rôles listés
const requireRole = (...rolesAutorises) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const roleUser = req.user.role;

    if (!rolesAutorises.includes(roleUser)) {
      return res.status(403).json({
        error: `Accès interdit — rôle requis : ${rolesAutorises.join(' ou ')}`,
        votre_role: roleUser,
      });
    }

    next();
  };
};

// Guard : autorise si le rôle est >= au niveau minimum
const requireMinRole = (roleMinimum) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const niveauUser = ROLES_HIERARCHY[req.user.role] || 0;
    const niveauMin  = ROLES_HIERARCHY[roleMinimum]   || 0;

    if (niveauUser < niveauMin) {
      return res.status(403).json({
        error: `Accès interdit — niveau minimum requis : ${roleMinimum}`,
        votre_role: req.user.role,
      });
    }

    next();
  };
};

module.exports = { verifyToken, requireRole, requireMinRole };
