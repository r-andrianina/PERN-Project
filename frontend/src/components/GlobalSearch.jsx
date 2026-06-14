// frontend/src/components/GlobalSearch.jsx
// Recherche globale dans la topbar (Ctrl+K ou clic icône).
// Cherche simultanément dans spécimens, missions et projets.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, MapPin, FolderOpen, ArrowRight, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import { useT } from '../lib/i18n';
import useAuthStore from '../store/authStore';
import SpecimenIcon from './SpecimenIcon';

const TYPE_LABEL = { moustique: 'Moustique', tique: 'Tique', puce: 'Puce' };
const TYPE_TONE  = { moustique: '#1D9E75',   tique: '#f59e0b', puce: '#ef4444' };

const STATUT_MISSION = {
  planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée',
};
const STATUT_PROJET = { actif: 'Actif', termine: 'Terminé', suspendu: 'Suspendu' };

// Sélecteur de périmètre (style dropdown) — filtre la recherche par type de résultat.
// Gère son propre état d'ouverture/fermeture, indépendamment de l'instance
// (trigger fermé vs barre du modal) dans laquelle il est rendu.
function ScopeSelector({ scope, setScope, scopes }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);
  const label = scopes.find(s => s.key === scope)?.label;

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
        className="flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg transition-colors whitespace-nowrap"
      >
        {label}
        <ChevronDown size={12} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>
      {menuOpen && (
        <div className="absolute top-full left-0 mt-1.5 min-w-[130px] bg-surface border border-border rounded-xl shadow-card-lg overflow-hidden z-50 py-1">
          {scopes.map(s => (
            <button
              key={s.key} type="button"
              onClick={() => { setScope(s.key); setMenuOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                scope === s.key ? 'text-primary font-semibold bg-primary/5' : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GlobalSearch() {
  const t        = useT();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [scope,   setScope]   = useState('all'); // 'all' | 'specimens' | 'missions' | 'projets'
  const [results, setResults] = useState({ specimens: [], missions: [], projets: [] });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(-1); // index résultat sélectionné au clavier
  const [searchError, setSearchError] = useState(false);

  const inputRef   = useRef(null);
  const debounceRef = useRef(null);

  const SCOPES = [
    { key: 'all',       label: t('topbar.scopeAll') },
    { key: 'specimens', label: t('topbar.specimens') },
    { key: 'missions',  label: t('topbar.missions') },
    { key: 'projets',   label: t('topbar.projets') },
  ];

  // Nettoyage du debounce au démontage — évite setState sur composant démonté
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  // Ctrl+K global
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus l'input quand on ouvre
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults({ specimens: [], missions: [], projets: [] });
      setFocused(-1);
      setSearchError(false);
    }
  }, [open]);

  // Fetch debouncé — restreint aux types pertinents selon le périmètre (scope) sélectionné
  const fetchResults = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) {
      setResults({ specimens: [], missions: [], projets: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    setSearchError(false);
    try {
      const autorises = user?.role === 'admin' ? ['moustique','tique','puce'] : (user?.specimensAutorises || []);
      const wantSpecimens = scope === 'all' || scope === 'specimens';
      const wantMissions  = scope === 'all' || scope === 'missions';
      const wantProjets   = scope === 'all' || scope === 'projets';
      // Quand la recherche est restreinte à un seul type, on affiche davantage de résultats
      const specLimit = scope === 'specimens' ? 8 : 5;
      const missLimit = scope === 'missions'  ? 8 : 3;
      const projLimit = scope === 'projets'   ? 8 : 3;

      const [specRes, missRes, projRes] = await Promise.allSettled([
        wantSpecimens && autorises.length > 0
          ? api.get('/recherche/specimens', { params: { search: q, limit: specLimit, types: autorises.join(',') } })
          : Promise.resolve({ data: { items: [] } }),
        wantMissions
          ? api.get('/missions', { params: { search: q } })
          : Promise.resolve({ data: { missions: [] } }),
        wantProjets
          ? api.get('/projets', { params: { search: q } })
          : Promise.resolve({ data: { projets: [] } }),
      ]);

      const wanted = [
        wantSpecimens ? specRes : null,
        wantMissions  ? missRes : null,
        wantProjets   ? projRes : null,
      ].filter(Boolean);
      const allFailed = wanted.every(r => r.status === 'rejected');
      if (allFailed) { setSearchError(true); return; }

      setResults({
        specimens: specRes.status === 'fulfilled' ? (specRes.value.data.items || []).slice(0, specLimit) : [],
        missions:  missRes.status === 'fulfilled' ? (missRes.value.data.missions || []).slice(0, missLimit) : [],
        projets:   projRes.status === 'fulfilled' ? (projRes.value.data.projets  || []).slice(0, projLimit) : [],
      });
    } catch { setSearchError(true); }
    finally { setLoading(false); }
  }, [user, scope]);

  const handleChange = (val) => {
    setQuery(val);
    setFocused(-1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(val), 300);
  };

  // Relance la recherche si l'utilisateur change le périmètre pendant que le modal est ouvert
  useEffect(() => {
    if (open && query.trim().length >= 2) fetchResults(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  // Liste plate des résultats pour la navigation clavier
  const flatResults = [
    ...results.specimens.map(r => ({ type: 'specimen', data: r })),
    ...results.missions.map(r  => ({ type: 'mission',  data: r })),
    ...results.projets.map(r   => ({ type: 'projet',   data: r })),
  ];

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, flatResults.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
    if (e.key === 'Enter' && focused >= 0) { navigateTo(flatResults[focused]); }
  };

  const navigateTo = ({ type, data }) => {
    setOpen(false);
    if (type === 'specimen') {
      navigate(`/specimens/${data._type}s/${data.id}`);
    } else if (type === 'mission') {
      navigate(`/missions/${data.id}`);
    } else {
      navigate(`/projets/${data.id}`);
    }
  };

  const hasResults = flatResults.length > 0;
  const showEmpty  = query.length >= 2 && !loading && !hasResults && !searchError;

  // Barre de recherche pilule dans la topbar : sélecteur de périmètre + champ de recherche
  const trigger = (
    <div
      className="hidden md:flex items-center w-full bg-surface-2 border border-border-strong
        hover:border-primary/30 transition-colors rounded-full pl-4 pr-1.5 py-1.5 gap-3"
    >
      <ScopeSelector scope={scope} setScope={setScope} scopes={SCOPES} />
      <span className="w-px h-4 bg-border flex-shrink-0" />
      <button
        onClick={() => setOpen(true)}
        className="flex-1 flex items-center gap-2 text-xs text-fg-subtle hover:text-fg transition-colors min-w-0 py-0.5"
        title="Ctrl+K"
      >
        <Search size={14} className="flex-shrink-0" />
        <span className="truncate">{t('topbar.search')}</span>
      </button>
    </div>
  );

  // Bouton mobile (icône seule)
  const mobileTrigger = (
    <button onClick={() => setOpen(true)} className="p-2 rounded-lg text-fg-muted hover:bg-surface-2 md:hidden">
      <Search size={18} />
    </button>
  );

  if (!open) return <>{trigger}{mobileTrigger}</>;

  const modal = (
    <div className="fixed inset-0 z-[9000] flex flex-col items-center pt-16 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden"
        onKeyDown={handleKeyDown}>

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <ScopeSelector scope={scope} setScope={setScope} scopes={SCOPES} />
          <span className="w-px h-5 bg-border flex-shrink-0" />
          {loading
            ? <Loader2 size={16} className="text-primary animate-spin flex-shrink-0" />
            : <Search size={16} className="text-fg-subtle flex-shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder={t('topbar.searchPlaceholder')}
            className="flex-1 text-sm bg-transparent border-none outline-none text-fg placeholder-fg-subtle"
          />
          <div className="flex items-center gap-2">
            {query && (
              <button onClick={() => handleChange('')} className="text-fg-subtle hover:text-fg p-0.5 rounded">
                <X size={14} />
              </button>
            )}
            <kbd className="hidden sm:inline text-[10px] text-fg-subtle bg-surface-2 border border-border rounded px-1.5 py-0.5">Esc</kbd>
          </div>
        </div>

        {/* Résultats */}
        {(hasResults || showEmpty || searchError) && (
          <div className="max-h-[400px] overflow-y-auto py-2">

            {/* Erreur réseau */}
            {searchError && (
              <p className="text-sm text-danger text-center py-6">Impossible de contacter le serveur.</p>
            )}

            {/* Aucun résultat */}
            {showEmpty && (
              <p className="text-sm text-fg-subtle text-center py-6">{t('topbar.noResults')}</p>
            )}

            {/* Spécimens */}
            {results.specimens.length > 0 && (
              <section>
                <p className="px-4 py-1.5 text-[10px] font-semibold text-fg-subtle uppercase tracking-wider">
                  {t('topbar.specimens')}
                </p>
                {results.specimens.map((s, i) => {
                  const idx = i;
                  const taxoNom = s.taxonomie ? (s.taxonomie.parent?.nom ? `${s.taxonomie.parent.nom} ${s.taxonomie.nom}` : s.taxonomie.nom) : '—';
                  return (
                    <button key={`s-${s._type}-${s.id}`} onClick={() => navigateTo({ type: 'specimen', data: s })}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left
                        ${focused === idx ? 'bg-primary/5' : ''}`}>
                      <SpecimenIcon type={s._type} size={15} className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-fg italic truncate">{taxoNom}</p>
                        <p className="text-xs text-fg-subtle truncate">
                          {s.idTerrain || `#${s.id}`} · {s.methode?.localite?.nom || '—'}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0"
                        style={{ color: TYPE_TONE[s._type], borderColor: `${TYPE_TONE[s._type]}40`, background: `${TYPE_TONE[s._type]}12` }}>
                        {TYPE_LABEL[s._type]}
                      </span>
                    </button>
                  );
                })}
              </section>
            )}

            {/* Missions */}
            {results.missions.length > 0 && (
              <section>
                <p className="px-4 py-1.5 text-[10px] font-semibold text-fg-subtle uppercase tracking-wider">
                  {t('topbar.missions')}
                </p>
                {results.missions.map((m, i) => {
                  const idx = results.specimens.length + i;
                  return (
                    <button key={`m-${m.id}`} onClick={() => navigateTo({ type: 'mission', data: m })}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left
                        ${focused === idx ? 'bg-primary/5' : ''}`}>
                      <MapPin size={15} className="text-info flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-fg truncate">{m.ordreMission}</p>
                        <p className="text-xs text-fg-subtle truncate">{m.projet?.nom || m.projet?.code || '—'}</p>
                      </div>
                      <span className="text-[10px] text-fg-subtle flex-shrink-0">{STATUT_MISSION[m.statut] || m.statut}</span>
                    </button>
                  );
                })}
              </section>
            )}

            {/* Projets */}
            {results.projets.length > 0 && (
              <section>
                <p className="px-4 py-1.5 text-[10px] font-semibold text-fg-subtle uppercase tracking-wider">
                  {t('topbar.projets')}
                </p>
                {results.projets.map((p, i) => {
                  const idx = results.specimens.length + results.missions.length + i;
                  return (
                    <button key={`p-${p.id}`} onClick={() => navigateTo({ type: 'projet', data: p })}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left
                        ${focused === idx ? 'bg-primary/5' : ''}`}>
                      <FolderOpen size={15} className="text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-fg truncate">{p.nom}</p>
                        <p className="text-xs text-fg-subtle truncate font-mono">{p.code}</p>
                      </div>
                      <span className="text-[10px] text-fg-subtle flex-shrink-0">{STATUT_PROJET[p.statut] || p.statut}</span>
                    </button>
                  );
                })}
              </section>
            )}

            {/* Voir tout dans la recherche */}
            {hasResults && query.length >= 2 && (
              <div className="px-4 pt-2 pb-1 border-t border-border mt-1">
                <button onClick={() => { navigate(`/recherche?search=${encodeURIComponent(query)}`); setOpen(false); }}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                  <ArrowRight size={12} /> {t('common.seeAll')} dans la recherche
                </button>
              </div>
            )}
          </div>
        )}

        {/* Hint clavier */}
        {!hasResults && !showEmpty && (
          <div className="flex items-center justify-center gap-4 px-4 py-4 text-[11px] text-fg-subtle">
            <span><kbd className="bg-surface-2 border border-border rounded px-1">↑↓</kbd> Naviguer</span>
            <span><kbd className="bg-surface-2 border border-border rounded px-1">↵</kbd> Ouvrir</span>
            <span><kbd className="bg-surface-2 border border-border rounded px-1">Esc</kbd> Fermer</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {trigger}
      {mobileTrigger}
      {createPortal(modal, document.body)}
    </>
  );
}
