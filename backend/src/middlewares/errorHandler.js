// Gestionnaire d'erreurs global — à monter EN DERNIER dans app.js.
// Intercepte tout ce qui est passé à next(err) ou lancé dans un asyncHandler.
//
// Codes Prisma traités :
//   P2025 — enregistrement introuvable
//   P2002 — contrainte unique violée
//   P2003 — contrainte de clé étrangère violée
//   P2016 — enregistrement requis introuvable

const AppError = require('../utils/AppError');

// Messages des erreurs Multer. Sans cette table, une limite d'upload dépassée
// remontait en 500 « Erreur interne du serveur » : l'utilisateur ne pouvait pas
// deviner que son fichier était simplement trop gros.
const MULTER_ERREURS = {
  LIMIT_FILE_SIZE:       [413, 'Fichier trop volumineux'],
  LIMIT_FILE_COUNT:      [400, 'Un seul fichier à la fois'],
  LIMIT_UNEXPECTED_FILE: [400, 'Champ de fichier inattendu — le fichier doit être envoyé sous le nom « file »'],
  LIMIT_PART_COUNT:      [400, 'Requête multipart trop complexe'],
  LIMIT_FIELD_KEY:       [400, 'Nom de champ trop long'],
  LIMIT_FIELD_VALUE:     [400, 'Valeur de champ trop longue'],
  LIMIT_FIELD_COUNT:     [400, 'Trop de champs dans la requête'],
};

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars

  // ── Réponse déjà commencée ──
  // Cas réel : getTemplateMoustiques écrit le classeur directement dans `res`
  // (`workbook.xlsx.write(res)`). Une erreur survenue APRÈS l'envoi des en-têtes
  // faisait planter le process sur ERR_HTTP_HEADERS_SENT en tentant d'écrire un
  // JSON par-dessus. On délègue alors à Express, qui coupe proprement la socket.
  if (res.headersSent) {
    console.error(`[${new Date().toISOString()}] Erreur après envoi des en-têtes :`, err.stack ?? err.message);
    return next(err);
  }

  // ── Multer — upload rejeté ──
  if (err.name === 'MulterError') {
    const [status, message] = MULTER_ERREURS[err.code] ?? [400, 'Fichier rejeté'];
    // `req.uploadMaxBytes` est posé par la route juste avant multer : il permet
    // d'annoncer la limite réelle plutôt qu'un message vague.
    const limite = err.code === 'LIMIT_FILE_SIZE' && req.uploadMaxBytes
      ? ` — la taille maximale autorisée est de ${Math.round(req.uploadMaxBytes / 1024 / 1024)} Mo`
      : '';
    return res.status(status).json({ error: `${message}${limite}.` });
  }

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
