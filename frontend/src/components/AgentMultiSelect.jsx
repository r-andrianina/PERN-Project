// Multi-select d'agents de terrain — chips + dropdown filtré, max N agents.
// value     : tableau d'ids
// onChange  : (ids[]) => void
// users     : tableau d'utilisateurs disponibles
// max       : limite (défaut 5)

import { useState, useMemo } from 'react';
import { X, UserPlus, Search } from 'lucide-react';

const ROLE_COLOR = {
  admin:     'bg-purple-100 text-purple-700 border-purple-200',
  chercheur: 'bg-blue-100 text-blue-700 border-blue-200',
  terrain:   'bg-amber-100 text-amber-700 border-warning/20',
  lecteur:   'bg-surface-3 text-fg-muted border-border-strong',
};

export default function AgentMultiSelect({ value = [], onChange, users = [], max = 5, label = 'Agents de terrain', hint }) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedSet = useMemo(() => new Set(value.map((v) => parseInt(v))), [value]);
  const selectedUsers = users.filter((u) => selectedSet.has(u.id));
  const available = users.filter((u) => !selectedSet.has(u.id));
  const filtered = available.filter((u) =>
    !search || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const isMax = value.length >= max;

  const add = (uid) => {
    if (isMax) return;
    onChange([...value, uid]);
    setSearch('');
    setShowDropdown(false);
  };
  const remove = (uid) => onChange(value.filter((v) => parseInt(v) !== uid));

  return (
    <div className="space-y-1.5 relative">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-fg-muted tracking-wide">{label}</label>
        <span className={`text-[10px] font-medium ${isMax ? 'text-warning' : 'text-fg-subtle'}`}>
          {value.length} / {max}
        </span>
      </div>

      {/* Chips des sélectionnés */}
      <div className="min-h-[44px] px-3 py-2 rounded-xl border border-border-strong bg-surface flex flex-wrap items-center gap-2">
        {selectedUsers.map((u) => (
          <span
            key={u.id}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${ROLE_COLOR[u.role] || 'bg-surface-3 text-fg-muted border-border-strong'}`}
          >
            <span className="w-4 h-4 rounded-full bg-surface/70 flex items-center justify-center text-[9px] font-bold">
              {u.prenom?.[0]}{u.nom?.[0]}
            </span>
            {u.prenom} {u.nom}
            <button
              type="button"
              onClick={() => remove(u.id)}
              className="ml-0.5 -mr-0.5 hover:bg-surface/50 rounded-full p-0.5"
            >
              <X size={10} />
            </button>
          </span>
        ))}

        {!isMax && (
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded-lg"
          >
            <UserPlus size={12} /> Ajouter un agent
          </button>
        )}
      </div>

      {hint && <p className="text-xs text-fg-subtle">{hint}</p>}

      {/* Dropdown */}
      {showDropdown && !isMax && (
        <div className="absolute z-20 w-full mt-1 bg-surface rounded-xl shadow-xl border border-border-strong overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Search size={13} className="text-fg-subtle" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un utilisateur…"
              className="flex-1 text-sm bg-transparent border-none outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-fg-subtle text-center">Aucun utilisateur disponible</p>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => add(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-primary/10 transition-colors"
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${ROLE_COLOR[u.role] || 'bg-surface-3 text-fg-muted'}`}>
                    {u.prenom?.[0]}{u.nom?.[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg truncate">{u.prenom} {u.nom}</p>
                    <p className="text-[10px] text-fg-subtle truncate">{u.email}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ROLE_COLOR[u.role] || 'bg-surface-3 text-fg-muted border-border-strong'}`}>
                    {u.role}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
