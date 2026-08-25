// backend/src/middlewares/rateLimiter.js
// Protection contre les attaques par force brute sur les routes d'authentification.

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// 5 tentatives max par IP toutes les 15 minutes sur /auth/login
const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              5,
  standardHeaders:  'draft-7',       // envoie Retry-After + RateLimit-* headers
  legacyHeaders:    false,
  skipSuccessfulRequests: true,       // une connexion réussie ne consomme pas le quota
  message: {
    error: 'Trop de tentatives de connexion — réessayez dans 15 minutes.',
    retryAfter: '15 minutes',
  },
  handler: (req, res, next, options) => {
    const retryAfterSec = Math.ceil(options.windowMs / 1000);
    res.set('Retry-After', String(retryAfterSec));
    res.status(429).json(options.message);
  },
});

// Rate limit général pour les routes publiques (inscription, etc.)
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max:      20,
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  message: { error: 'Trop de requêtes — réessayez dans une minute.' },
});

// /recherche/specimens : requête non paginée côté DB (charge puis tranche en
// mémoire), sans throttling jusqu'ici — un compte peut la spammer sans coût.
// Clé par utilisateur (pas par IP) car ces routes sont toujours authentifiées
// et plusieurs comptes peuvent partager une IP (institut derrière un NAT).
const searchLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             60,
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  // ipKeyGenerator() normalise l'IPv6 (évite le contournement par variation
  // de suffixe) — requis par express-rate-limit dès qu'un keyGenerator
  // personnalisé peut retomber sur l'IP brute.
  keyGenerator:    (req) => (req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip)),
  message: { error: 'Trop de requêtes de recherche — réessayez dans une minute.' },
});

// /recherche/specimens/export : génère un classeur Excel complet à partir de
// l'intégralité des résultats filtrés — plus coûteux, quota plus serré.
const exportLimiter = rateLimit({
  windowMs:        5 * 60 * 1000, // 5 minutes
  max:             10,
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  // ipKeyGenerator() normalise l'IPv6 (évite le contournement par variation
  // de suffixe) — requis par express-rate-limit dès qu'un keyGenerator
  // personnalisé peut retomber sur l'IP brute.
  keyGenerator:    (req) => (req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip)),
  message: { error: 'Trop d\'exports — réessayez dans quelques minutes.' },
});

module.exports = { loginLimiter, publicLimiter, searchLimiter, exportLimiter };
