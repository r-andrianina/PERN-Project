// Recherche unifiée multi-critères des spécimens (Moustiques + Tiques + Puces).
// Filtres synchronisés dans l'URL pour partage/persistance.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Download, Filter, X, Loader2, ChevronDown, ChevronUp,
  Bug, Calendar, MapPin, Layers, RotateCcw, FlaskConical, PawPrint,
  TrendingUp, Hash,
} from 'lucide-react';
import api from '../../api/axios';

// ── Constantes UI ─────────────────────────────────────────────
const TYPE_INFO = {
  moustique: { label: 'Moustique', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  tique:     { label: 'Tique',     color: 'bg-rose-100 text-rose-700 border-rose-200' },
  puce:      { label: 'Puce',      color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const SEXE_INFO = {
  M:       { label: 'Mâle',    color: 'bg-blue-50 text-blue-700 border-blue-100' },
  F:       { label: 'Femelle', color: 'bg-pink-50 text-pink-700 border-pink-100' },
  inconnu: { label: 'Inconnu', color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const PARITE_OPTIONS  = ['Nulle', 'Paucie', 'Multi'];
const STADE_SUGGEST   = ['Adulte', 'Larve', 'Nymphe', 'Oeuf'];

// Helper : libellé taxonomie "Genre espèce"
const taxoLabel = (t) => {
  if (!t) return '—';
  if (t.parent?.nom) return `${t.parent.nom} ${t.nom}`;
  return t.nom;
};

// ── Composant section repliable de filtres ────────────────────
function FilterSection({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-2.5">{children}</div>}
    </div>
  );
}

// ── Champ de filtre simple ────────────────────────────────────
const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400';

// ── Page ──────────────────────────────────────────────────────
export default function RecherchePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── État dérivé des params URL ──────────────────────────────
  const f = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);

  // ── Données pour les selects (référentiels + cascade) ───────
  const [projets,         setProjets]         = useState([]);
  const [missions,        setMissions]        = useState([]);
  const [localites,       setLocalites]       = useState([]);
  const [methodes,        setMethodes]        = useState([]);
  const [taxonomies,      setTaxonomies]      = useState([]);  // tree flatten
  const [taxonomiesHote,  setTaxonomiesHote]  = useState([]);
  const [solutions,       setSolutions]       = useState([]);

  // ── Résultats ───────────────────────────────────────────────
  const [items,   setItems]   = useState([]);
  const [stats,   setStats]   = useState(null);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true); // mobile collapse

  // ── Initial load des référentiels ───────────────────────────
  useEffect(() => {
    Promise.all([
      api.get('/projets').catch(() => ({ data: { projets: [] } })),
      api.get('/missions'),
      api.get('/dictionnaire/taxonomie-specimens', { params: { actif: 'true' } }),
      api.get('/dictionnaire/taxonomie-hotes',     { params: { actif: 'true' } }),
      api.get('/dictionnaire/solutions-conservation', { params: { actif: 'true' } }),
    ]).then(([p, m, t, th, s]) => {
      setProjets(p.data.projets   || []);
      setMissions(m.data.missions || []);
      setTaxonomies(t.data.items   || []);
      setTaxonomiesHote(th.data.items || []);
      setSolutions(s.data.items    || []);
    });
  }, []);

  // ── Cascade Mission → Localités ─────────────────────────────
  useEffect(() => {
    if (!f.missionId) { setLocalites([]); return; }
    api.get('/localites', { params: { missionId: f.missionId } })
      .then((r) => setLocalites(r.data.localites || []));
  }, [f.missionId]);

  // ── Cascade Localité → Méthodes ─────────────────────────────
  useEffect(() => {
    if (!f.localiteId) { setMethodes([]); return; }
    api.get('/methodes', { params: { localiteId: f.localiteId } })
      .then((r) => setMethodes(r.data.methodes || []));
  }, [f.localiteId]);

  // ── Lancement de la recherche à chaque changement d'URL ─────
  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries());
    setLoading(true);
    api.get('/recherche/specimens', { params })
      .then((r) => {
        setItems(r.data.items);
        setStats(r.data.stats);
        setTotal(r.data.total);
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  // ── Helpers de mise à jour des filtres ──────────────────────
  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === '' || value === null || value === undefined) next.delete(key);
    else next.set(key, value);
    // Reset des cascades en aval
    if (key === 'projetId')   { next.delete('missionId'); next.delete('localiteId'); next.delete('methodeId'); }
    if (key === 'missionId')  { next.delete('localiteId'); next.delete('methodeId'); }
    if (key === 'localiteId') { next.delete('methodeId'); }
    setSearchParams(next);
  };

  const reset = () => setSearchParams({});

  const toggleType = (type) => {
    const current = (f.types || 'moustique,tique,puce').split(',');
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    setFilter('types', next.length === 3 ? '' : next.join(','));
  };

  const activeTypes = (f.types || 'moustique,tique,puce').split(',');
  const hasActiveFilters = Object.keys(f).length > 0;
  const filterCount = Object.keys(f).filter((k) => k !== 'types' && f[k]).length;

  const exportUrl = () => {
    const params = new URLSearchParams(searchParams);
    return `${api.defaults.baseURL}/recherche/specimens/export?${params}&_t=${Date.now()}`;
  };

  const handleExport = () => {
    // Récupérer le token et déclencher un download
    const token = localStorage.getItem('token');
    fetch(exportUrl(), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recherche-specimens-${Date.now()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  // ── Filtre les taxonomies actives selon les types sélectionnés
  const taxonomiesFiltered = taxonomies.filter((t) => !t.type || activeTypes.includes(t.type));

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <Search size={18} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Explorer les spécimens</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? 'Recherche…' : `${total} spécimen(s) ${filterCount > 0 ? '— ' + filterCount + ' filtre(s) actif(s)' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              <RotateCcw size={13} /> Réinitialiser
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden inline-flex items-center gap-1.5 text-xs text-gray-600 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <Filter size={13} /> Filtres {filterCount > 0 && <span className="bg-primary-600 text-white px-1.5 py-0.5 rounded-full text-[10px]">{filterCount}</span>}
          </button>
          <button
            onClick={handleExport}
            disabled={total === 0}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={13} /> Export Excel
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-4 bg-gradient-to-br from-primary-50 to-white border-primary-100">
            <div className="flex items-center gap-2 mb-1">
              <Hash size={13} className="text-primary-500" />
              <span className="text-xs text-gray-500">Spécimens</span>
            </div>
            <p className="text-2xl font-bold text-primary-700">{stats.total}</p>
            <p className="text-xs text-gray-400 mt-1">{stats.totalIndividus} individu(s)</p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Bug size={13} className="text-gray-400" />
              <span className="text-xs text-gray-500">Par type</span>
            </div>
            <div className="space-y-1 mt-2">
              {Object.entries(stats.parType).filter(([, v]) => v > 0).map(([t, count]) => (
                <div key={t} className="flex items-center justify-between text-xs">
                  <span className={`badge text-[10px] border ${TYPE_INFO[t].color}`}>{TYPE_INFO[t].label}</span>
                  <span className="font-semibold text-gray-700">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={13} className="text-gray-400" />
              <span className="text-xs text-gray-500">Top espèces</span>
            </div>
            <div className="space-y-1 mt-2">
              {stats.topEspeces.slice(0, 3).map((e) => (
                <div key={e.nom} className="flex items-center justify-between text-xs">
                  <span className="italic text-gray-700 truncate">{e.nom}</span>
                  <span className="font-semibold text-gray-500 ml-2">{e.count}</span>
                </div>
              ))}
              {stats.topEspeces.length === 0 && <p className="text-xs text-gray-400">—</p>}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={13} className="text-gray-400" />
              <span className="text-xs text-gray-500">Période</span>
            </div>
            {stats.periode.dateMin ? (
              <>
                <p className="text-sm font-semibold text-gray-700">
                  {new Date(stats.periode.dateMin).toLocaleDateString('fr-FR')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  → {new Date(stats.periode.dateMax).toLocaleDateString('fr-FR')}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">Non datée</p>
            )}
          </div>
        </div>
      )}

      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-5">

        {/* ═══ Panneau de filtres ═══ */}
        <aside className={`${showFilters ? 'block' : 'hidden'} lg:block card overflow-hidden self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto`}>
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Filtres</span>
          </div>

          {/* Types de spécimens */}
          <FilterSection title="Type" icon={Bug}>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(TYPE_INFO).map(([key, info]) => {
                const active = activeTypes.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleType(key)}
                    className={`text-xs font-medium px-2 py-1.5 rounded-lg border transition-all ${
                      active ? info.color + ' border-2' : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {info.label}
                  </button>
                );
              })}
            </div>
          </FilterSection>

          {/* Recherche libre */}
          <FilterSection title="Recherche" icon={Search}>
            <input
              type="text" placeholder="Recherche dans les notes…"
              value={f.search || ''}
              onChange={(e) => setFilter('search', e.target.value)}
              className={inputCls}
            />
          </FilterSection>

          {/* Cascade Projet → Mission → Localité → Méthode */}
          <FilterSection title="Localisation" icon={MapPin}>
            <select className={inputCls} value={f.projetId || ''} onChange={(e) => setFilter('projetId', e.target.value)}>
              <option value="">Tous les projets</option>
              {projets.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>)}
            </select>

            <select className={inputCls} value={f.missionId || ''} onChange={(e) => setFilter('missionId', e.target.value)}>
              <option value="">Toutes les missions</option>
              {missions
                .filter((m) => !f.projetId || m.projet?.id === parseInt(f.projetId))
                .map((m) => <option key={m.id} value={m.id}>{m.ordreMission}</option>)}
            </select>

            <select className={inputCls} value={f.localiteId || ''} onChange={(e) => setFilter('localiteId', e.target.value)} disabled={!f.missionId}>
              <option value="">Toutes les localités</option>
              {localites.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
            </select>

            <select className={inputCls} value={f.methodeId || ''} onChange={(e) => setFilter('methodeId', e.target.value)} disabled={!f.localiteId}>
              <option value="">Toutes les méthodes</option>
              {methodes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.typeMethode?.code ? `[${m.typeMethode.code}] ` : ''}{m.typeMethode?.nom || `#${m.id}`}
                </option>
              ))}
            </select>

            <input className={inputCls} placeholder="Région" value={f.region || ''} onChange={(e) => setFilter('region', e.target.value)} />
            <input className={inputCls} placeholder="District" value={f.district || ''} onChange={(e) => setFilter('district', e.target.value)} />
          </FilterSection>

          {/* Période */}
          <FilterSection title="Période" icon={Calendar}>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500">Du</label>
              <input type="date" className={inputCls} value={f.dateDebut || ''} onChange={(e) => setFilter('dateDebut', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500">Au</label>
              <input type="date" className={inputCls} value={f.dateFin || ''} onChange={(e) => setFilter('dateFin', e.target.value)} />
            </div>
          </FilterSection>

          {/* Taxonomie */}
          <FilterSection title="Taxonomie" icon={Bug}>
            <select className={inputCls} value={f.taxonomieId || ''} onChange={(e) => setFilter('taxonomieId', e.target.value)}>
              <option value="">Toutes les taxonomies</option>
              {taxonomiesFiltered.map((t) => (
                <option key={t.id} value={t.id}>
                  {`[${t.niveau}] `}{t.parent?.nom ? t.parent.nom + ' ' : ''}{t.nom}
                </option>
              ))}
            </select>
          </FilterSection>

          {/* Caractéristiques biologiques */}
          <FilterSection title="Biologie" icon={Layers} defaultOpen={false}>
            <select className={inputCls} value={f.sexe || ''} onChange={(e) => setFilter('sexe', e.target.value)}>
              <option value="">Tous les sexes</option>
              <option value="M">Mâle</option>
              <option value="F">Femelle</option>
              <option value="inconnu">Inconnu</option>
            </select>

            <select className={inputCls} value={f.stade || ''} onChange={(e) => setFilter('stade', e.target.value)}>
              <option value="">Tous les stades</option>
              {STADE_SUGGEST.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            {activeTypes.includes('moustique') && (
              <>
                <select className={inputCls} value={f.parite || ''} onChange={(e) => setFilter('parite', e.target.value)}>
                  <option value="">Toutes parités</option>
                  {PARITE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select className={inputCls} value={f.repasSang || ''} onChange={(e) => setFilter('repasSang', e.target.value)}>
                  <option value="">Repas sang : tous</option>
                  <option value="true">Avec repas</option>
                  <option value="false">Sans repas</option>
                </select>
              </>
            )}

            {activeTypes.includes('tique') && (
              <select className={inputCls} value={f.gorge || ''} onChange={(e) => setFilter('gorge', e.target.value)}>
                <option value="">Gorgée : tous</option>
                <option value="true">Gorgée</option>
                <option value="false">Non gorgée</option>
              </select>
            )}
          </FilterSection>

          {/* Hôte (tique/puce) */}
          {(activeTypes.includes('tique') || activeTypes.includes('puce')) && (
            <FilterSection title="Hôte" icon={PawPrint} defaultOpen={false}>
              <select className={inputCls} value={f.hasHote || ''} onChange={(e) => setFilter('hasHote', e.target.value)}>
                <option value="">Présence hôte : tous</option>
                <option value="true">Avec hôte</option>
                <option value="false">Sans hôte</option>
              </select>
              <select className={inputCls} value={f.taxonomieHoteId || ''} onChange={(e) => setFilter('taxonomieHoteId', e.target.value)}>
                <option value="">Tous les hôtes</option>
                {taxonomiesHote.map((t) => (
                  <option key={t.id} value={t.id}>
                    {`[${t.niveau}] `}{t.parent?.nom ? t.parent.nom + ' ' : ''}{t.nom}
                  </option>
                ))}
              </select>
            </FilterSection>
          )}

          {/* Conservation */}
          <FilterSection title="Conservation" icon={FlaskConical} defaultOpen={false}>
            <select className={inputCls} value={f.solutionId || ''} onChange={(e) => setFilter('solutionId', e.target.value)}>
              <option value="">Toutes les solutions</option>
              {solutions.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </FilterSection>
        </aside>

        {/* ═══ Résultats ═══ */}
        <div>
          {loading ? (
            <div className="card p-12 flex items-center justify-center text-gray-400 text-sm">
              <Loader2 size={18} className="animate-spin mr-2" /> Recherche en cours…
            </div>
          ) : items.length === 0 ? (
            <div className="card p-16 text-center">
              <Search size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Aucun spécimen ne correspond aux critères</p>
              {hasActiveFilters && (
                <button onClick={reset} className="text-xs text-primary-600 hover:underline mt-2">
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Type', 'ID terrain', 'ID', 'Taxonomie', 'Nb', 'Sexe', 'Stade', 'Mission', 'Localité', 'Méthode', 'Hôte', 'Date'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((s) => (
                      <tr key={`${s._type}-${s.id}`} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`badge text-xs border ${TYPE_INFO[s._type].color}`}>{TYPE_INFO[s._type].label}</span>
                        </td>
                        <td className="px-4 py-3">
                          {s.idTerrain
                            ? <span className="font-mono text-xs font-bold bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded">{s.idTerrain}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">#{s.id}</td>
                        <td className="px-4 py-3 italic font-medium text-gray-700">{taxoLabel(s.taxonomie)}</td>
                        <td className="px-4 py-3 text-gray-600 font-semibold">{s.nombre}</td>
                        <td className="px-4 py-3">
                          <span className={`badge text-xs border ${SEXE_INFO[s.sexe || 'inconnu'].color}`}>
                            {SEXE_INFO[s.sexe || 'inconnu'].label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{s.stade || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">{s.methode?.localite?.mission?.ordreMission || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          <div>{s.methode?.localite?.nom || '—'}</div>
                          {s.methode?.localite?.region && (
                            <div className="text-[10px] text-gray-400">{s.methode.localite.region}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{s.methode?.typeMethode?.nom || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {s.hote?.taxonomieHote?.nom || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {s.dateCollecte ? new Date(s.dateCollecte).toLocaleDateString('fr-FR') : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {total > items.length && (
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-500 text-center">
                  Affichage de {items.length} / {total} résultats — précisez vos filtres pour réduire le nombre
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
