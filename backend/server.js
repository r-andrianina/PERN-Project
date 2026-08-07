// backend/server.js
// Point d'entrée principal du serveur SpécimenManager

require('dotenv').config();

// Fail-fast : sans JWT_SECRET, la signature/vérification des tokens échouerait
// silencieusement au premier login. On arrête au démarrage plutôt que de
// laisser un serveur en apparence sain refuser toute authentification.
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant — définissez-le dans backend/.env. Arrêt.');
  process.exit(1);
}

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📋 Environnement : ${process.env.NODE_ENV || 'development'}`);
});
