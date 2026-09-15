import { defineConfig } from 'vitest/config';

// Tests unitaires backend — logique pure, SANS base de données (les modules
// testés n'importent pas config/prisma, qui ouvre une connexion à l'import).
// C'est ce qui permet à cette campagne de tourner en quelques secondes n'importe
// où : la garder ainsi est délibéré.
//
// L'intégration est couverte à part, et exige PostgreSQL :
//   npm run test:integration  → vitest.integration.config.mjs (import Excel)
//   npm run test:smoke        → scripts/smoke-test.js (parcours API)
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
  },
});
