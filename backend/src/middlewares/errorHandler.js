// Gestionnaire d'erreurs global — à monter EN DERNIER dans app.js.
// Intercepte tout ce qui est passé à next(err) ou lancé dans un asyncHandler.
//
// Codes Prisma traités :
//   P2025 — enregistrement introuvable
//   P2002 — contrainte unique violée
//   P2003 — contrainte de clé étrangère violée
//   P2016 — enregistrement requis introuvable

const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars

  // ── AppError — erreur métier intentionnelle ──
  if (err.name === 'AppError') {
    return res.status(err.statusCode).json({
      error:   err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // ── ZodError — fallback (Zod v4 utilise .issues, v3 utilisait .errors) ──
  if (err.name === 'ZodError') {
    const issues = err.issues ?? err.errors ?? [];
    return res.status(400).json({
      error:   'Données invalides',
      details: issues.map((e) => ({ field: (e.path ?? []).join('.'), message: e.message })),
    });
  }

  // ── Erreurs Prisma ──
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Ressource introuvable' });
  }
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] ?? 'champ';
    return res.status(409).json({ error: `Valeur déjà existante (${field})` });
  }
  if (err.code === 'P2003') {
    return res.status(400).json({ error: 'Référence invalide — ressource liée introuvable' });
  }
  if (err.code === 'P2016') {
    return res.status(404).json({ error: 'Enregistrement requis introuvable' });
  }

  // ── JWT ──
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }

  // ── Erreur interne non gérée ──
  console.error(`[${new Date().toISOString()}] Erreur non gérée :`, err.stack ?? err.message);
  return res.status(500).json({
    error: 'Erreur interne du serveur',
    ...(process.env.NODE_ENV === 'development' && { message: err.message }),
  });
};

module.exports = errorHandler;
