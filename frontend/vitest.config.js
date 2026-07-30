import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tests frontend — Vitest + React Testing Library dans un DOM jsdom.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
});
