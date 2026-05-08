// ThemeToggle — bascule clair/sombre. Persiste le choix dans localStorage
// et applique la classe `dark` sur <html>.

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

const STORAGE_KEY = 'sm-theme';
const THEMES = ['light', 'dark', 'system'];

function applyTheme(theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'system';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  return [theme, setThemeState];
}

const ICON  = { light: Sun, dark: Moon, system: Monitor };
const LABEL = { light: 'Clair', dark: 'Sombre', system: 'Système' };

export default function ThemeToggle({ compact = false }) {
  const [theme, setTheme] = useTheme();

  if (compact) {
    // Mode compact : un seul bouton qui cycle light → dark → system
    const Icon = ICON[theme];
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    return (
      <button
        onClick={() => setTheme(next)}
        title={`Thème : ${LABEL[theme]} — clic pour passer à ${LABEL[next]}`}
        className="p-2 text-fg-muted hover:text-fg hover:bg-surface-2 rounded-lg transition-colors"
      >
        <Icon size={16} />
      </button>
    );
  }

  // Mode trio : 3 boutons côte-à-côte (light/dark/system)
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-border">
      {THEMES.map((t) => {
        const Icon = ICON[t];
        const active = theme === t;
        return (
          <button
            key={t}
            onClick={() => setTheme(t)}
            title={LABEL[t]}
            className={`p-1.5 rounded-md transition-colors ${
              active
                ? 'bg-surface text-fg shadow-card'
                : 'text-fg-subtle hover:text-fg-muted'
            }`}
          >
            <Icon size={13} />
          </button>
        );
      })}
    </div>
  );
}
