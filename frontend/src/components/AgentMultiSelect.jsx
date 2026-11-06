// Multi-select d'agents de terrain — chips + dropdown filtré, max N agents.
// value     : tableau d'ids de fiches Personnel
// onChange  : (ids[]) => void
// annuaire  : résultat de usePersonnel()
// max       : limite (défaut 20, plafond du backend)
//
// Les agents sont des fiches du dictionnaire Personnel, plus des comptes
// utilisateurs (2026-10-09) : un chauffeur ou un guide n'a pas de compte.

import { useState, useMemo } from 'react';
import { X, UserPlus, Search, Plus, Users } from 'lucide-react';
import AjoutPersonnelModal from './personnel/AjoutPersonnelModal';
import { useT, interpolate } from '../lib/i18n';

const initiales = (nom) => nom.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const sansAccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function AgentMultiSelect({ value = [], onChange, annuaire, max = 20, label, hint }) {
  const t = useT();
  label ??= t('agentMultiSelect.defaultLabel');
  const { actifs, parId, equipes, refetch } = annuaire;
  const [search, setSearch] = useState('');
  const [equipe, setEquipe] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [ajout, setAjout] = useState(null); // nom pré-rempli, ou null

  const selectedSet = useMemo(() => new Set(value.map((v) => parseInt(v))), [value]);

  // Les pastilles se construisent depuis `value` — la sélection fait foi — et
  // non depuis le catalogue (2026-09-18) : une fiche désactivée après
  // l'affectation reste affichée, comptée, et retirable.
  const selected = useMemo(() => [...selectedSet].map(
    (id) => parId.get(id) ?? { id, introuvable: true },
  ), [selectedSet, parId]);

  const q = sansAccent(search.trim());
  const filtered = actifs.filter((p) =>
    !selectedSet.has(p.id)
    && (!equipe || p.equipe === equipe)
    && (!q || sansAccent(`${p.nom} ${p.fonction ?? ''} ${p.equipe ?? ''}`).includes(q)),
  );

  const isMax = value.length >= max;

  const add = (id) => {
    if (isMax) return;
    onChange([...value, id]);
    setSearch('');
    setShowDropdown(false);
  };
  const remove = (id) => onChange(value.filter((v) => parseInt(v) !== id));

  return (
    <div className="space-y-1.5 relative">
      {/* min-h : même hauteur d'en-tête que ChefMissionSelect, posé à côté. */}
      <div className="flex items-center justify-between gap-2 min-h-[28px]">
        <label className="text-xs font-semibold text-fg-muted tracking-wide flex items-center gap-1.5">
          <Users size={12} /> {label}
        </label>
        <span className={`text-2xs font-medium ${isMax ? 'text-warning' : 'text-fg-subtle'}`}>
          {value.length} / {max}
        </span>
      </div>

      {/* Chips des sélectionnés */}
      <div className="min-h-[42px] px-3 py-1.5 rounded-xl border border-border-strong bg-surface flex flex-wrap items-center gap-2">
        {selected.map((p) => (
          <span
            key={p.id}
            title={p.introuvable ? undefined : [p.fonction, p.equipe].filter(Boolean).join(' · ')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${
              p.introuvable || !p.actif ? 'bg-surface-3 text-fg-muted border-border-strong' : 'bg-primary/10 text-primary border-primary/20'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-surface/70 flex items-center justify-center text-2xs font-bold">
              {p.introuvable ? '?' : initiales(p.nom)}
            </span>
            {p.introuvable
              ? <span className="italic">{interpolate(t('agentMultiSelect.ficheIntrouvable'), { id: p.id })}</span>
              : <>{p.nom}{!p.actif && <span className="italic">{t('personnel.inactiveSuffix')}</span>}</>}
            <button
              type="button"
              onClick={() => remove(p.id)}
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
            <UserPlus size={12} /> {t('agentMultiSelect.addAgent')}
          </button>
        )}
      </div>

      {hint && <p className="text-xs text-fg-subtle">{hint}</p>}

      {/* Dropdown */}
      {showDropdown && !isMax && (
        <div className="absolute z-20 w-full mt-1 bg-surface rounded-xl shadow-xl border border-border-strong overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex flex-wrap items-center gap-2">
            <Search size={13} className="text-fg-subtle" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('agentMultiSelect.searchPerson')}
              className="flex-1 min-w-[140px] text-sm bg-transparent border-none outline-none"
            />
            {equipes.length > 0 && (
              <select
                value={equipe} onChange={(e) => setEquipe(e.target.value)}
                aria-label={t('personnel.fieldEquipe')}
                className="text-xs rounded-lg border border-border-strong bg-surface text-fg py-1 pl-2 pr-7"
              >
                <option value="">{t('personnel.allTeams')}</option>
                {equipes.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-fg-subtle text-center">{t('agentMultiSelect.noPersonAvailable')}</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => add(p.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-primary/10 transition-colors"
                >
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-2xs font-bold flex-shrink-0 bg-primary/10 text-primary">
                    {initiales(p.nom)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg truncate">{p.nom}</p>
                    {p.fonction && <p className="text-2xs text-fg-subtle truncate">{p.fonction}</p>}
                  </div>
                  {p.equipe && (
                    <span className="text-2xs font-semibold px-1.5 py-0.5 rounded border bg-surface-3 text-fg-muted border-border-strong truncate max-w-[40%]">
                      {p.equipe}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => { setAjout(search.trim()); setShowDropdown(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-primary border-t border-border hover:bg-primary/10"
          >
            <Plus size={13} /> {t('personnel.addPerson')}
          </button>
        </div>
      )}

      {ajout !== null && (
        <AjoutPersonnelModal
          nomInitial={ajout}
          equipes={equipes}
          onClose={() => setAjout(null)}
          onCreated={async (item) => {
            setAjout(null);
            await refetch();
            if (value.length < max) onChange([...value, item.id]);
          }}
        />
      )}
    </div>
  );
}
