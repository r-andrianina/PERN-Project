import useLangStore from '../../store/languageStore';

const YEAR = new Date().getFullYear();

export default function Footer() {
  const { lang, setLang } = useLangStore();

  return (
    <footer className="border-t border-border bg-surface-2/60 px-4 md:px-6 py-2.5 flex-shrink-0">
      <div className="flex items-center justify-between gap-3">

        <p className="text-[11px] text-fg-subtle">
          © {YEAR} Henintsoa Andrianina
        </p>

        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
          <button
            onClick={() => setLang('fr')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
              lang === 'fr' ? 'bg-primary text-fg-on-primary shadow-sm' : 'text-fg-muted hover:text-fg'
            }`}
          >
            🇫🇷 FR
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
              lang === 'en' ? 'bg-primary text-fg-on-primary shadow-sm' : 'text-fg-muted hover:text-fg'
            }`}
          >
            🇬🇧 EN
          </button>
        </div>

      </div>
    </footer>
  );
}
