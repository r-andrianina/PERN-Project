// DatePicker — calendrier personnalisé (remplace <input type="date">).
//
// Même rationale que Select.jsx : le calendrier natif d'un <input
// type="date"> est dessiné par l'OS/navigateur et ignore le CSS. Ce
// composant reproduit le comportement (clavier, clic extérieur, portail
// vers <body>) avec un rendu maîtrisé — grille de jours, mois précédent/
// suivant en gris cliquables, jour sélectionné mis en avant, "Aujourd'hui"
// souligné.
//
// value / onChange utilisent le même format que l'input natif : une chaîne
// "YYYY-MM-DD" (ou '' si vide). Le parsing passe toujours par les
// composants année/mois/jour (jamais `new Date(stringISO)`) pour éviter le
// décalage de fuseau horaire classique de `new Date("2026-07-25")`.

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

const pad2 = (n) => String(n).padStart(2, '0');
const toKey = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

// Parse "YYYY-MM-DD" en {y, m (0-indexé), d} — jamais via `new Date(str)`.
function parseDateStr(str) {
  if (!str) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (!match) return null;
  return { y: parseInt(match[1]), m: parseInt(match[2]) - 1, d: parseInt(match[3]) };
}

const MONTH_LABEL = (y, m) => {
  const label = new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const DISPLAY_FORMAT = (parsed) => parsed ? `${pad2(parsed.d)}/${pad2(parsed.m + 1)}/${parsed.y}` : '';

export default function DatePicker({
  value, onChange, placeholder = 'jj/mm/aaaa',
  disabled = false, error = false, name, id,
  className = '', wrapperClassName = 'w-full',
}) {
  const selected = parseDateStr(value);
  const today = new Date();
  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({
    y: selected?.y ?? today.getFullYear(),
    m: selected?.m ?? today.getMonth(),
  }));
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const menuRef    = useRef(null);

  const openPicker = () => {
    if (disabled || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 340 && rect.top > spaceBelow;
    setCoords({
      left:   rect.left,
      top:    openUp ? null : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - rect.top + 6 : null,
      width:  Math.max(rect.width, 280),
    });
    setView({ y: selected?.y ?? today.getFullYear(), m: selected?.m ?? today.getMonth() });
    setOpen(true);
  };
  const close = () => setOpen(false);

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
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Grille 6x7 — inclut les jours du mois précédent/suivant (grisés,
  // cliquables) pour toujours remplir 6 lignes complètes comme la capture.
  const cells = useMemo(() => {
    const firstOfMonth = new Date(view.y, view.m, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // Lundi = 0
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const daysInPrevMonth = new Date(view.y, view.m, 0).getDate();

    const out = [];
    for (let i = 0; i < startOffset; i++) {
      const d = daysInPrevMonth - startOffset + 1 + i;
      const m = view.m === 0 ? 11 : view.m - 1;
      const y = view.m === 0 ? view.y - 1 : view.y;
      out.push({ y, m, d, outside: true });
    }
    for (let d = 1; d <= daysInMonth; d++) out.push({ y: view.y, m: view.m, d, outside: false });
    let next = 1;
    while (out.length < 42) {
      const m = view.m === 11 ? 0 : view.m + 1;
      const y = view.m === 11 ? view.y + 1 : view.y;
      out.push({ y, m, d: next++, outside: true });
    }
    return out;
  }, [view]);

  const selectDay = (cell) => {
    onChange(toKey(cell.y, cell.m, cell.d));
    close();
  };

  const goToday = () => {
    setView({ y: today.getFullYear(), m: today.getMonth() });
    onChange(todayKey);
    close();
  };

  const changeMonth = (delta) => {
    setView((v) => {
      let m = v.m + delta, y = v.y;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      return { y, m };
    });
  };

  const baseClass = `
    w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors flex items-center gap-2
    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
    bg-surface text-fg text-left
    ${disabled
      ? 'bg-surface-2 text-fg-subtle cursor-not-allowed'
      : 'cursor-pointer hover:border-primary/40'
    }
    ${error
      ? 'border-danger/50 bg-danger/5 focus:ring-danger/20 focus:border-danger'
      : 'border-border-strong'
    }
    ${open && !disabled ? 'ring-2 ring-primary/30 border-primary' : ''}
    ${className}
  `;

  return (
    <div className={wrapperClassName}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        onClick={() => (open ? close() : openPicker())}
        className={baseClass}
      >
        <Calendar size={15} className="text-fg-subtle flex-shrink-0" />
        <span className={selected ? '' : 'text-fg-subtle'}>
          {selected ? DISPLAY_FORMAT(selected) : placeholder}
        </span>
      </button>

      {open && coords && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: coords.top ?? undefined,
            bottom: coords.bottom ?? undefined,
            left: coords.left,
            width: coords.width,
          }}
          className="z-[9999] bg-surface border border-border rounded-xl shadow-card-lg overflow-hidden p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => changeMonth(-1)}
              className="p-1.5 rounded-lg text-fg-subtle hover:bg-surface-2 hover:text-fg transition-colors">
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-semibold text-fg">{MONTH_LABEL(view.y, view.m)}</p>
            <button type="button" onClick={() => changeMonth(1)}
              className="p-1.5 rounded-lg text-fg-subtle hover:bg-surface-2 hover:text-fg transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-[10px] font-semibold text-fg-subtle text-center py-1 uppercase tracking-wide">
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              const key = toKey(cell.y, cell.m, cell.d);
              const isSelected = selected && key === toKey(selected.y, selected.m, selected.d);
              const isToday = key === todayKey;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(cell)}
                  className={`text-xs rounded-lg h-8 w-8 mx-auto flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-primary text-white font-semibold'
                      : cell.outside
                        ? 'text-fg-subtle/50 hover:bg-surface-2'
                        : `text-fg hover:bg-surface-2 ${isToday ? 'font-bold text-primary ring-1 ring-primary/40' : ''}`
                  }`}
                >
                  {cell.d}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end mt-2 pt-2 border-t border-border">
            <button type="button" onClick={goToday}
              className="text-xs font-medium text-primary-600 hover:text-primary-700">
              Aujourd'hui
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
