/** @type {import('tailwindcss').Config} */
//
// Stratégie design system :
// - Les couleurs **sémantiques** (bg, surface, fg, success...) pointent vers
//   des CSS variables définies dans index.css → permettent le dark mode
//   en switchant la classe `dark` sur <html>.
// - Les couleurs **brand** (primary) gardent une palette tonale figée car le
//   vert IPM est notre identité, mais sa nuance s'adapte légèrement en
//   sombre via une variable `--primary` (par défaut → 500).
// - Les couleurs **domaine** (specimen.*, role.*) restent en classes statiques
//   car leur sémantique est partout la même, et elles n'ont pas besoin de
//   variations dark — on les utilise sur fonds clairs/foncés explicitement.
//
// Avec la syntaxe `rgb(var(--token) / <alpha-value>)`, Tailwind gère
// automatiquement les classes type `bg-surface/50`.

module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  // Classes générées dynamiquement (template literals) — Tailwind ne peut pas les
  // détecter à la compilation, on les liste explicitement.
  safelist: [
    // Spécimens
    'bg-specimen-moustique', 'text-specimen-moustique', 'border-specimen-moustique',
    'bg-specimen-tique',     'text-specimen-tique',     'border-specimen-tique',
    'bg-specimen-puce',      'text-specimen-puce',      'border-specimen-puce',
    'bg-specimen-moustique/10', 'bg-specimen-tique/10', 'bg-specimen-puce/10',
    // Rôles
    'bg-role-admin',     'text-role-admin',     'border-role-admin',
    'bg-role-chercheur', 'text-role-chercheur', 'border-role-chercheur',
    'bg-role-terrain',   'text-role-terrain',   'border-role-terrain',
    'bg-role-lecteur',   'text-role-lecteur',   'border-role-lecteur',
    'bg-role-admin/10', 'bg-role-chercheur/10', 'bg-role-terrain/10', 'bg-role-lecteur/10',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // ── Brand ─────────────────────────────────────────────
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          fg:  'rgb(var(--primary-fg) / <alpha-value>)',
          50:  '#E8F8F2',
          100: '#C2EDDB',
          200: '#9BE3C4',
          300: '#65D4A5',
          400: '#2EC285',
          500: '#1D9E75',
          600: '#0F6E56',
          700: '#085041',
          800: '#053328',
          900: '#021814',
        },

        // ── Surfaces (s'adaptent au thème) ────────────────────
        bg:          'rgb(var(--bg) / <alpha-value>)',
        surface:     'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        border:      'rgb(var(--border) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',

        // ── Texte (s'adapte au thème) ─────────────────────────
        fg:          'rgb(var(--fg) / <alpha-value>)',
        'fg-muted':  'rgb(var(--fg-muted) / <alpha-value>)',
        'fg-subtle': 'rgb(var(--fg-subtle) / <alpha-value>)',
        'fg-on-primary': 'rgb(var(--fg-on-primary) / <alpha-value>)',

        // ── États sémantiques ─────────────────────────────────
        success: { DEFAULT: 'rgb(var(--success) / <alpha-value>)',  bg: 'rgb(var(--success-bg) / <alpha-value>)' },
        warning: { DEFAULT: 'rgb(var(--warning) / <alpha-value>)',  bg: 'rgb(var(--warning-bg) / <alpha-value>)' },
        danger:  { DEFAULT: 'rgb(var(--danger) / <alpha-value>)',   bg: 'rgb(var(--danger-bg) / <alpha-value>)'  },
        info:    { DEFAULT: 'rgb(var(--info) / <alpha-value>)',     bg: 'rgb(var(--info-bg) / <alpha-value>)'    },

        // ── Domaine : types de spécimens (palettes figées) ────
        specimen: {
          moustique: '#10b981', // emerald-500
          tique:     '#f43f5e', // rose-500
          puce:      '#f59e0b', // amber-500
        },
        // ── Domaine : rôles utilisateurs ──────────────────────
        role: {
          admin:     '#8b5cf6', // violet-500
          chercheur: '#06b6d4', // cyan-500
          terrain:   '#f97316', // orange-500
          lecteur:   '#64748b', // slate-500
        },
      },
      boxShadow: {
        card:     '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-md':'0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
        'card-lg':'0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
      },
      borderRadius: {
        // Échelle uniforme — ne plus utiliser rounded-md ou rounded-3xl
        token: '0.625rem',  // 10px
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
};
