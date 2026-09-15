import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';

// Tests d'intégration : vrai fichier Excel, vraie route HTTP, vraie base.
//
// Séparés de `npm test` À DESSEIN. La campagne unitaire tourne en ~6 s sans
// aucune dépendance ; c'est ce qui fait qu'on la lance souvent. Y mêler des
// tests qui exigent PostgreSQL la rendrait ininstallable ailleurs et plus
// lente — on cesserait de la lancer, et on perdrait les deux.

const require = createRequire(import.meta.url);
const { urlTest } = require('./tests/integration/setup/testDatabase.js');

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    include:     ['tests/integration/**/*.test.js'],
    globalSetup: ['./tests/integration/setup/globalSetup.js'],
    // `src/config/prisma.js` lit DATABASE_URL à l'import : la variable doit être
    // posée AVANT que le moindre module applicatif soit chargé. `env` est injecté
    // par Vitest avant les fichiers de test, ce que ne permettrait pas un simple
    // require() en tête de test.
    env: {
      DATABASE_URL: urlTest,
      // app.js ne charge pas dotenv (c'est server.js qui le fait) : sans ceci,
      // la signature des jetons échouerait.
      JWT_SECRET:   'secret-de-test-sans-valeur-en-production',
      NODE_ENV:     'test',
    },
    // Les fichiers partagent une base : en parallèle ils se marcheraient dessus
    // (mêmes ordres de mission, mêmes codes de localité).
    fileParallelism: false,
    testTimeout:     30000,
    hookTimeout:     60000,
  },
});
