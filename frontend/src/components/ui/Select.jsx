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

const DEFAULT_TRIGGER = 'w-full flex items-center justify-between gap-2 text-left text-sm rounded-xl border px-3.5 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30';

export default function Select({
  value,
  onChange,
  options = [],
  placeholder = '— Sélectionner —',
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
  searchPlaceholder = 'Rechercher…',
  emptyLabel = 'Aucun résultat',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const showSearch = searchable ?? options.length > 8;

  const filtered = useMemo(() => {
    if (!showSearch || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, showSearch]);

  const selected = options.find((o) => String(o.value) === String(value ?? ''));

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
          className="z-[100] w-max bg-surface border border-border rounded-xl shadow-card-lg overflow-hidden"
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
            {filtered.length === 0 ? (
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
