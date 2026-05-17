// backend/src/middlewares/rateLimiter.js
// Protection contre les attaques par force brute sur les routes d'authentification.

const { rateLimit } = require('express-rate-limit');

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

module.exports = { loginLimiter, publicLimiter };
