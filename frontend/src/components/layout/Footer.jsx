import useLangStore from '../../store/languageStore';

const YEAR = new Date().getFullYear();

export default function Footer() {
  const { lang, setLang } = useLangStore();

  return (
    <footer className="border-t border-border bg-surface-2/60 px-4 md:px-6 py-2.5 flex-shrink-0">
      <div className="grid grid-cols-3 items-center gap-3">

        {/* Gauche — vide pour équilibre */}
        <div />

        {/* Centre — copyright */}
        <p className="text-[11px] text-fg-subtle text-center whitespace-nowrap">
          © {YEAR} Henintsoa Andrianina
        </p>

        {/* Droite — sélecteur de langue */}
        <div className="flex items-center justify-end gap-1">
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

      </div>
    </footer>
  );
}
