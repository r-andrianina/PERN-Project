// frontend/src/components/layout/Footer.jsx
import { FlaskConical, Shield, Globe } from 'lucide-react';
import { useT } from '../../lib/i18n';
import useLangStore from '../../store/languageStore';

const VERSION = '2.0.0';
const YEAR    = new Date().getFullYear();

export default function Footer() {
  const t             = useT();
  const { lang, setLang } = useLangStore();

  return (
    <footer className="border-t border-border bg-surface-2/60 px-4 md:px-6 py-3 flex-shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-3 max-w-6xl">

        {/* Gauche — identité */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <FlaskConical size={12} className="text-fg-on-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-fg leading-tight">{t('footer.institute')}</p>
            <p className="text-[10px] text-fg-subtle leading-tight">{t('footer.subtitle')}</p>
          </div>
        </div>

        {/* Centre — copyright + mention légale */}
        <div className="flex flex-col items-center gap-0.5 text-center">
          <p className="text-[10px] text-fg-subtle">
            © {YEAR} — {t('footer.rights')}
          </p>
          <div className="flex items-center gap-1 text-[10px] text-fg-subtle">
            <Shield size={9} className="text-warning" />
            {t('footer.restricted')}
          </div>
        </div>

        {/* Droite — version + langue */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-fg-subtle font-mono">
            {t('footer.version')} {VERSION}
          </span>

          {/* Toggle langue */}
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
            <button
              onClick={() => setLang('fr')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                lang === 'fr'
                  ? 'bg-primary text-fg-on-primary shadow-sm'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              🇫🇷 FR
            </button>
            <button
              onClick={() => setLang('en')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                lang === 'en'
                  ? 'bg-primary text-fg-on-primary shadow-sm'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              🇬🇧 EN
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
}
