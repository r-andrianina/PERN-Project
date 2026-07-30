import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  // Config files (CJS) need node globals
  {
    files: ['tailwind.config.js', 'postcss.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // useEffect(() => { setState(x) }, [dep]) is the standard data-fetching pattern
      'react-hooks/set-state-in-effect': 'off',
      // Règle « React Compiler » (react-hooks v7) : signale les composants définis
      // dans le rendu (ex. petits helpers JSX comme UploadBtn). Le projet n'a pas
      // adopté les contraintes du React Compiler — on garde la visibilité en
      // avertissement sans bloquer la CI, plutôt que de refactorer du code qui marche.
      'react-hooks/static-components': 'warn',
    },
  },
])
