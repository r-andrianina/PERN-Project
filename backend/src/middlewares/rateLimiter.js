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

// /import/* : de loin l'endpoint le plus coûteux de l'API — jusqu'à 25 Mo
// téléversés, un classeur entier chargé en RAM, puis une transaction qui écrit
// des milliers de lignes. Il n'avait aucun throttling, alors que les routes de
// recherche et d'export en ont un depuis longtemps : un seul compte pouvait
// saturer la mémoire et le pool de connexions du backend.
// Quota volontairement large pour l'usage réel (on importe quelques fichiers par
// séance, pas quelques dizaines par minute) mais suffisant pour couper une boucle.
const importLimiter = rateLimit({
  windowMs:        10 * 60 * 1000, // 10 minutes
  max:             20,
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  // Clé par utilisateur : l'institut est derrière un NAT, plusieurs comptes
  // partagent la même IP publique (cf. searchLimiter).
  keyGenerator:    (req) => (req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip)),
  message: { error: "Trop d'imports lancés — patientez quelques minutes avant de réessayer." },
});

module.exports = { loginLimiter, publicLimiter, searchLimiter, exportLimiter, importLimiter };
