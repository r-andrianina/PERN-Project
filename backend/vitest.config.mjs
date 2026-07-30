import { defineConfig } from 'vitest/config';

// Tests unitaires backend — logique pure, SANS base de données (les modules
// testés n'importent pas config/prisma, qui ouvre une connexion à l'import).
// L'intégration bout-en-bout reste couverte par scripts/smoke-test.js (npm run test:smoke).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
  },
});
