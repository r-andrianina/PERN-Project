// Champ texte libre avec auto-suggestion depuis une liste d'utilisateurs.
// La saisie peut être validée même si elle ne correspond à aucun utilisateur
// (ex: porteur externe sans compte).

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function AutocompleteUser({
  value, onChange, users = [], label, placeholder, hint, required, error,
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = (users || []).filter((u) => {
    if (!value) return true;
    const v = value.toLowerCase();
    return `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(v);
  }).slice(0, 8);

  const select = (u) => {
    onChange(`${u.prenom} ${u.nom}`, u.id);
    setOpen(false);
  };

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHover((h) => Math.min(h + 1, filtered.length - 1)); setOpen(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHover((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && open && filtered[hover]) { e.preventDefault(); select(filtered[hover]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const inputCls = `
    w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors pr-9
    focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400
    ${error ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}
  `;

  return (
    <div className="space-y-1.5 relative" ref={ref}>
      {label && (
        <label className="block text-xs font-semibold text-gray-600 tracking-wide">
          {label} {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value || ''}
          onChange={(e) => { onChange(e.target.value, null); setOpen(true); setHover(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          required={required}
          className={inputCls}
        />
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-30 w-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Suggestions ({filtered.length} utilisateur{filtered.length > 1 ? 's' : ''})
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.map((u, i) => (
              <button
                key={u.id}
                type="button"
                onClick={() => select(u)}
                onMouseEnter={() => setHover(i)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  i === hover ? 'bg-primary-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {u.prenom?.[0]}{u.nom?.[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 truncate">{u.prenom} {u.nom}</p>
                  <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                </div>
                <span className="text-[10px] font-medium text-gray-400 capitalize">{u.role}</span>
                {value && `${u.prenom} ${u.nom}` === value && <Check size={12} className="text-primary-500" />}
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 italic">
              Ou continuez à taper pour saisir un porteur externe (non utilisateur)
            </p>
          </div>
        </div>
      )}

      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
