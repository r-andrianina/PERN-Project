// Select — dropdown personnalisé (remplace <select> natif).
//
// Le popup natif d'un <select> est dessiné par l'OS/navigateur et ignore
// quasiment tout le CSS (couleurs de survol, scrollbar...). Ce composant
// reproduit le comportement (clavier, clic extérieur, recherche pour les
// longues listes) avec un rendu entièrement maîtrisé, via un portail vers
// <body> pour ne jamais être tronqué par un parent `overflow-hidden`.
//
// Usage :
//   <Select value={v} onChange={(val) => ...} options={[{ value: 'a', label: 'A' }]} />
//
// Pour un style de déclencheur entièrement personnalisé (ex: pastille
// colorée), passer `buttonClassName` (remplace le style par défaut).

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';
import { useT } from '../../lib/i18n';

const DEFAULT_TRIGGER = 'w-full flex items-center justify-between gap-2 text-left text-sm rounded-xl border px-3.5 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30';

export default function Select({
  value,
  onChange,
  options = [],
  placeholder,
  disabled = false,
  error = false,
  name,
  id,
  className = '',
  buttonClassName = '',
  chevronClassName = 'text-fg-subtle',
  hideChevron = false,
  wrapperClassName = 'w-full',
  align = 'left',
  searchable,
  searchPlaceholder,
  emptyLabel,
  // ── Recherche CÔTÉ SERVEUR (optionnelle) ────────────────────
  // `loadOptions(query)` renvoie une promesse d'options. Quand elle est
  // fournie, la liste n'est plus filtrée côté client : elle est redemandée au
  // serveur à chaque frappe (temporisée). Prévu pour les référentiels qu'on
  // ne peut plus précharger — la taxonomie compte 12 904 nœuds, soit 5,7 Mo
  // par ouverture d'écran avant ce changement.
  //
  // `selectedOption` porte le libellé de la valeur courante : elle n'est
  // presque jamais dans la page chargée (on affiche 50 résultats sur 12 904),
  // et sans elle le champ afficherait le placeholder alors qu'un filtre est
  // actif — le pire des deux mondes.
  loadOptions,
  selectedOption,
}) {
  const t = useT();
  placeholder        ??= `— ${t('common.select')} —`;
  searchPlaceholder ??= `${t('common.search')}…`;
  emptyLabel         ??= t('common.noResults');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const asynchrone = typeof loadOptions === 'function';
  const [optionsServeur, setOptionsServeur] = useState([]);
  const [chargement, setChargement] = useState(false);

  // `asynchrone` est un booléen, jamais null : un `??` de plus ici aurait
  // renvoyé `false` pour tous les selects ordinaires et supprimé leur champ
  // de recherche au passage.
  const showSearch = searchable ?? (asynchrone || options.length > 8);

  // Interrogation du serveur : temporisée, et on ignore la réponse d'une
  // requête devancée par une plus récente (sinon une réponse lente écrase la
  // liste d'une frappe plus tardive).
  useEffect(() => {
    if (!asynchrone || !open) return;
    let abandonnee = false;
    setChargement(true);
    const tid = setTimeout(async () => {
      try {
        const res = await loadOptions(query.trim());
        if (!abandonnee) setOptionsServeur(res || []);
      } catch {
        if (!abandonnee) setOptionsServeur([]);
      } finally {
        if (!abandonnee) setChargement(false);
      }
    }, query.trim() ? 250 : 0);
    return () => { abandonnee = true; clearTimeout(tid); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, asynchrone]);

  const filtered = useMemo(() => {
    // Le serveur a déjà filtré : re-filtrer ici masquerait des résultats
    // légitimes (il cherche aussi sur le genre parent, pas seulement le label).
    if (asynchrone) return optionsServeur;
    if (!showSearch || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    // `keywords` (optionnel) élargit la recherche à du texte non affiché
    // dans le label — ex: un code technique masqué de l'UI mais toujours
    // recherchable ("CDC" retrouve "CDC_LIGHT_TRAP" même si le label
    // affiché est juste "Piège lumineux CDC").
    return options.filter((o) =>
      o.label.toLowerCase().includes(q) || o.keywords?.toLowerCase().includes(q)
    );
  }, [options, query, showSearch, asynchrone, optionsServeur]);

  const selected =
    options.find((o) => String(o.value) === String(value ?? ''))
    ?? filtered.find((o) => String(o.value) === String(value ?? ''))
    ?? (selectedOption && String(selectedOption.value) === String(value ?? '') ? selectedOption : undefined);

  const openMenu = () => {
    if (disabled || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 300 && rect.top > spaceBelow;
    setCoords({
      left:     align === 'right' ? null : rect.left,
      right:    align === 'right' ? window.innerWidth - rect.right : null,
      top:      openUp ? null : rect.bottom + 6,
      bottom:   openUp ? window.innerHeight - rect.top + 6 : null,
      minWidth: rect.width,
      maxWidth: Math.max(window.innerWidth - rect.left - 16, rect.width),
    });
    setQuery('');
    setHighlight(options.findIndex((o) => String(o.value) === String(value ?? '')));
    setOpen(true);
  };

  const close = () => setOpen(false);

  // Fermeture : clic extérieur, scroll de la page, redimensionnement
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      close();
    };
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // Focus auto du champ de recherche à l'ouverture
  useEffect(() => {
    if (open && showSearch) {
      const tid = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(tid);
    }
  }, [open, showSearch]);

  // Maintient l'option survolée visible lors de la navigation clavier
  useEffect(() => {
    if (open && highlight >= 0) {
      listRef.current?.children[highlight]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlight, open]);

  const commit = (val) => {
    onChange(val);
    close();
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e) => {
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      if (!open) openMenu();
    } else if (e.key === 'Escape' && open) {
      close();
    }
  };

  const handleMenuKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) commit(filtered[highlight].value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
      triggerRef.current?.focus();
    }
  };

  const triggerClass = buttonClassName
    ? `${buttonClassName} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`
    : `${DEFAULT_TRIGGER} ${
        disabled
          ? 'bg-surface-2 text-fg-subtle border-border cursor-not-allowed'
          : `bg-surface text-fg cursor-pointer hover:border-primary/40 ${error ? 'border-danger' : 'border-border-strong'}`
      } ${open && !disabled ? 'ring-2 ring-primary/30 border-primary' : ''} ${className}`;

  return (
    <div className={wrapperClassName}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        className={triggerClass}
      >
        <span className={`truncate ${!selected ? 'text-fg-subtle' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        {!hideChevron && (
          <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${chevronClassName}`} />
        )}
      </button>

      {open && coords && createPortal(
        <div
          ref={menuRef}
          onKeyDown={handleMenuKeyDown}
          style={{
            position: 'fixed',
            top: coords.top ?? undefined,
            bottom: coords.bottom ?? undefined,
            left: coords.left ?? undefined,
            right: coords.right ?? undefined,
            minWidth: coords.minWidth,
            maxWidth: coords.maxWidth,
          }}
          className="z-[9999] w-max bg-surface border border-border rounded-xl shadow-card-lg overflow-hidden"
        >
          {showSearch && (
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
                  placeholder={searchPlaceholder}
                  className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border border-border-strong bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}
          <div ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {/* « Aucun résultat » pendant que la requête est en vol dirait
                faux : on annonce l'attente tant qu'elle dure. */}
            {chargement && filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-fg-subtle text-center">{t('common.loading')}</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-fg-subtle text-center">{emptyLabel}</p>
            ) : filtered.map((opt, i) => {
              const isSelected = String(opt.value) === String(value ?? '');
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => commit(opt.value)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-sm transition-colors ${
                    isSelected
                      ? 'text-primary font-semibold bg-primary/5'
                      : i === highlight
                        ? 'bg-surface-2 text-fg'
                        : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={14} className="flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
