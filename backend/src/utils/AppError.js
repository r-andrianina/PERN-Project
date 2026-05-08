// Erreur métier typée — portée par les services et propagée jusqu'à l'error handler global.
// statusCode détermine le code HTTP renvoyé.

class AppError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.name       = 'AppError';
    this.statusCode = statusCode;
    this.details    = details;
  }

  static badRequest(message, details) { return new AppError(message, 400, details); }
  static unauthorized(message = 'Non authentifié')  { return new AppError(message, 401); }
  static forbidden(message = 'Accès interdit')      { return new AppError(message, 403); }
  static notFound(message = 'Ressource introuvable') { return new AppError(message, 404); }
  static conflict(message)   { return new AppError(message, 409); }
  static internal(message = 'Erreur interne') { return new AppError(message, 500); }
}

module.exports = AppError;
