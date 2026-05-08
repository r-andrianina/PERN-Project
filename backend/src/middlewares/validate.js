// Middleware de validation Zod v4 (utilise .issues — v3 utilisait .errors).
// Valide req.body contre le schéma et remplace req.body par les données parsées/coercées.

const validate = (schema, target = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[target]);
  if (!result.success) {
    // Zod v4 → .issues   |   Zod v3 → .errors (fallback)
    const issues = result.error?.issues ?? result.error?.errors ?? [];
    const details = issues.map((e) => ({
      field:   (e.path ?? []).join('.') || target,
      message: e.message,
      code:    e.code,
    }));
    return res.status(400).json({ error: 'Données invalides', details });
  }
  req[target] = result.data;
  next();
};

const validateQuery = (schema) => validate(schema, 'query');

module.exports = { validate, validateQuery };
