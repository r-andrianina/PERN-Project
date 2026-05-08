// Wrapper qui capture les rejets des fonctions async et les passe à next()
// → élimine le try/catch répété dans chaque contrôleur.
//
// Usage :
//   router.get('/', asyncHandler(ctrl.list));
//   // au lieu de
//   router.get('/', async (req, res) => { try { ... } catch(err) { next(err) } });

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
