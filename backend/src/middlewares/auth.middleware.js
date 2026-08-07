// backend/src/middlewares/auth.middleware.js
// Vérification JWT + guards par rôle + contrôle d'accès par type de spécimen

const jwt    = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { ROLE_LEVELS, BYPASS_ROLES } = require('../config/rbac');

// =============================================================
//  RÉVOCATION DE SESSION (B2)
//  Le JWT seul (durée 8 h) ne suffit pas : désactiver, rétrograder
//  ou supprimer un compte doit couper l'accès sans attendre l'expiration.
//  On revérifie donc l'état du compte en base, avec un cache court (30 s)
//  pour éviter une requête à chaque appel API.
// =============================================================

const _userStatusCache   = new Map(); // userId -> { actif, role, expiresAt }
const USER_STATUS_TTL_MS = 30_000;

async function loadUserStatus(userId) {
  const now    = Date.now();
  const cached = _userStatusCache.get(userId);
  if (cached && cached.expiresAt > now) return cached;

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { actif: true, role: true, passwordChangedAt: true, specimensAutorises: true },
  });
  const status = user
    ? { actif: user.actif, role: user.role, passwordChangedAt: user.passwordChangedAt, specimensAutorises: user.specimensAutorises, expiresAt: now + USER_STATUS_TTL_MS }
    : { actif: false, role: null, passwordChangedAt: null, specimensAutorises: [], expiresAt: now + USER_STATUS_TTL_MS };
  _userStatusCache.set(userId, status);
  return status;
}

// Appelée après désactivation / changement de rôle / suppression d'un compte.
const invalidateUserStatus = (userId) => _userStatusCache.delete(userId);

// Enforce la révocation. Renvoie true si la requête peut continuer.
// Fail-open en cas d'indisponibilité DB : on retombe sur le JWT signé
// (disponibilité préservée ; la révocation reste best-effort).
async function enforceAccountActive(req, res) {
  try {
    const status = await loadUserStatus(req.user.id);
    if (!status.actif) {
      res.status(401).json({ error: 'Compte désactivé ou introuvable — veuillez vous reconnecter.' });
      return false;
    }
    // Révocation sur changement de mot de passe : un token émis AVANT le dernier
    // changement (reset admin ou self-service) est refusé. iat est en secondes ;
    // on tronque passwordChangedAt à la seconde pour ne pas révoquer par erreur
    // un token fraîchement ré-émis dans la même seconde que le changement.
    if (status.passwordChangedAt && req.user.iat &&
        Math.floor(status.passwordChangedAt.getTime() / 1000) > req.user.iat) {
      res.status(401).json({ error: 'Mot de passe modifié — veuillez vous reconnecter.' });
      return false;
    }
    if (status.role) req.user.role = status.role; // rôle rafraîchi (≤ 30 s)
    // specimensAutorises rafraîchi (≤ 30 s) : carte/dashboard/recherche lisent
    // req.user.specimensAutorises pour filtrer — sans ce refresh, un changement
    // d'accès par l'admin ne s'y reflèterait qu'à la reconnexion (le JWT est figé).
    if (status.specimensAutorises) req.user.specimensAutorises = status.specimensAutorises;
    return true;
  } catch (err) {
    console.error('[auth] statut compte indisponible, repli sur le JWT :', err.message);
    return true;
  }
}

// =============================================================
//  VÉRIFICATION DU TOKEN JWT
// =============================================================

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Accès refusé — token manquant' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    // 401 = non authentifié (token absent/expiré/invalide)
    // L'intercepteur Axios redirige automatiquement vers /login sur 401
    return res.status(401).json({ error: 'Session expirée — veuillez vous reconnecter.' });
  }

  req.user = decoded; // { id, email, role, nom, prenom, specimensAutorises }
  if (!(await enforceAccountActive(req, res))) return;
  next();
};

// Variante SSE : EventSource (navigateur) ne peut pas envoyer de headers personnalisés,
// donc on accepte le token depuis le header Authorization OU depuis ?token= en query param.
const verifyTokenSSE = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) return res.status(401).json({ error: 'Accès refusé — token manquant' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Session expirée — veuillez vous reconnecter.' });
  }

  req.user = decoded;
  if (!(await enforceAccountActive(req, res))) return;
  next();
};

// =============================================================
//  HIÉRARCHIE DES RÔLES — source unique dans config/rbac.js (F2)
//  admin > superviseur > chercheur > technicien > lecteur
// =============================================================

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
  const niveauUser = ROLE_LEVELS[req.user.role] || 0;
  const niveauMin  = ROLE_LEVELS[roleMinimum]   || 0;
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
//  - Admin / Superviseur : toujours autorisés (bypass total)
//  - Autres rôles        : vérification en BDD (cache 60s) pour refléter
//                          immédiatement les changements faits par l'admin
//                          sans forcer la reconnexion.
// =============================================================

// Cache in-memory : userId → { autorises: string[], expiresAt: number }
const _specimenCache = new Map();
const CACHE_TTL_MS   = 60_000; // 1 minute

const checkSpecimenAccess = (type) => async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (BYPASS_ROLES.includes(req.user.role)) return next();

    const userId = req.user.id;
    const now    = Date.now();
    const cached = _specimenCache.get(userId);

    let autorises;
    if (cached && cached.expiresAt > now) {
      autorises = cached.autorises;
    } else {
      const user = await prisma.user.findUnique({
        where:  { id: userId },
        select: { specimensAutorises: true, actif: true },
      });
      if (!user || !user.actif) {
        return res.status(401).json({ error: 'Compte inactif ou introuvable' });
      }
      autorises = user.specimensAutorises;
      _specimenCache.set(userId, { autorises, expiresAt: now + CACHE_TTL_MS });
    }

    if (!autorises.includes(type)) {
      return res.status(403).json({
        error: `Accès interdit — vous n'êtes pas autorisé à accéder aux ${type}s`,
        votre_role:          req.user.role,
        specimens_autorises: autorises,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

// Invalidation du cache pour un utilisateur (appelée après updateSpecimenAccess).
const invalidateSpecimenCache = (userId) => _specimenCache.delete(userId);

module.exports = { verifyToken, verifyTokenSSE, requireRole, requireMinRole, checkSpecimenAccess, invalidateSpecimenCache, invalidateUserStatus };
