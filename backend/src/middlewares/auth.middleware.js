// backend/src/middlewares/auth.middleware.js
// Vérification JWT + guards par rôle + contrôle d'accès par type de spécimen

const jwt = require('jsonwebtoken');

// =============================================================
//  VÉRIFICATION DU TOKEN JWT
// =============================================================

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Accès refusé — token manquant' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role, nom, prenom, specimensAutorises }
    next();
  } catch {
    // 401 = non authentifié (token absent/expiré/invalide)
    // L'intercepteur Axios redirige automatiquement vers /login sur 401
    return res.status(401).json({ error: 'Session expirée — veuillez vous reconnecter.' });
  }
};

// Variante SSE : EventSource (navigateur) ne peut pas envoyer de headers personnalisés,
// donc on accepte le token depuis le header Authorization OU depuis ?token= en query param.
const verifyTokenSSE = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) return res.status(401).json({ error: 'Accès refusé — token manquant' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expirée — veuillez vous reconnecter.' });
  }
};

// =============================================================
//  HIÉRARCHIE DES RÔLES
//  admin > chercheur > technicien > lecteur
// =============================================================

const ROLES_HIERARCHY = {
  admin:      4,
  chercheur:  3,
  technicien: 2,
  lecteur:    1,
};

// Guard : autorise uniquement les rôles listés (correspondance exacte)
const requireRole = (...rolesAutorises) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (!rolesAutorises.includes(req.user.role)) {
    return res.status(403).json({
      error: `Accès interdit — rôle requis : ${rolesAutorises.join(' ou ')}`,
      votre_role: req.user.role,
    });
  }
  next();
};

// Guard : autorise si le rôle est >= au niveau minimum
const requireMinRole = (roleMinimum) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
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

// =============================================================
//  CONTRÔLE D'ACCÈS PAR TYPE DE SPÉCIMEN
//
//  Usage : checkSpecimenAccess('moustique') sur la route
//  - Admin        : toujours autorisé (bypass total)
//  - Autres rôles : le type doit figurer dans specimensAutorises du JWT
//
//  Les permissions sont embarquées dans le JWT à la connexion.
//  Un changement de permissions prend effet à la prochaine connexion.
// =============================================================

const checkSpecimenAccess = (type) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (req.user.role === 'admin') return next();

  const autorises = req.user.specimensAutorises || [];
  if (!autorises.includes(type)) {
    return res.status(403).json({
      error: `Accès interdit — vous n'êtes pas autorisé à accéder aux ${type}s`,
      votre_role: req.user.role,
      specimens_autorises: autorises,
    });
  }
  next();
};

module.exports = { verifyToken, verifyTokenSSE, requireRole, requireMinRole, checkSpecimenAccess };
