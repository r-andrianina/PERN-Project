// Recherche unifiée multi-critères des spécimens (Moustiques + Tiques + Puces).
// Filtres synchronisés dans l'URL pour partage/persistance.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Download, Filter, X, ChevronDown, ChevronUp,
  Bug, Calendar, MapPin, Layers, RotateCcw, FlaskConical, PawPrint,
  TrendingUp, Hash,
} from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, Button, EmptyState, PageHeader, Spinner } from '../../components/ui';

// ── Constantes UI ─────────────────────────────────────────────
const TYPE_TONE  = { moustique: 'specimen-moustique', tique: 'specimen-tique', puce: 'specimen-puce' };
const TYPE_LABEL = { moustique: 'Moustique', tique: 'Tique', puce: 'Puce' };

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const SEXE_LABEL = { M: 'Mâle', F: 'Femelle', inconnu: 'Inconnu' };

const PARITE_OPTIONS = ['Nulle', 'Paucie', 'Multi'];
const STADE_SUGGEST  = ['Adulte', 'Larve', 'Nymphe', 'Oeuf'];

const taxoLabel = (t) => {
  if (!t) return '—';
  if (t.parent?.nom) return `${t.parent.nom} ${t.nom}`;
  return t.nom;
};

// ── Section de filtres repliable ─────────────────────────────
function FilterSection({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-fg-subtle" />
          <span className="text-xs font-semibold text-fg uppercase tracking-wider">{title}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-fg-subtle" /> : <ChevronDown size={14} className="text-fg-subtle" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-2.5">{children}</div>}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-border-strong bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';

// ── Page ──────────────────────────────────────────────────────
export default function RecherchePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const f = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);

  // Référentiels
  const [projets,         setProjets]         = useState([]);
  const [missions,        setMissions]        = useState([]);
  const [localites,       setLocalites]       = useState([]);
  const [methodes,        setMethodes]        = useState([]);
  const [taxonomies,      setTaxonomies]      = useState([]);
  const [taxonomiesHote,  setTaxonomiesHote]  = useState([]);
  const [solutions,       setSolutions]       = useState([]);

  // Résultats
  const [items,   setItems]   = useState([]);
  const [stats,   setStats]   = useState(null);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

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

  useEffect(() => {
    if (!f.missionId) { setLocalites([]); return; }
    api.get('/localites', { params: { missionId: f.missionId } })
      .then((r) => setLocalites(r.data.localites || []));
  }, [f.missionId]);

  useEffect(() => {
    if (!f.localiteId) { setMethodes([]); return; }
    api.get('/methodes', { params: { localiteId: f.localiteId } })
      .then((r) => setMethodes(r.data.methodes || []));
  }, [f.localiteId]);

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

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === '' || value === null || value === undefined) next.delete(key);
    else next.set(key, value);
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

  const handleExport = () => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams(searchParams);
    fetch(`${api.defaults.baseURL}/recherche/specimens/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
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

  const taxonomiesFiltered = taxonomies.filter((t) => !t.type || activeTypes.includes(t.type));

  return (
    <div className="space-y-5">

      <PageHeader
        icon={Search} iconTone="primary"
        title="Explorer les spécimens"
        subtitle={loading ? 'Recherche…' : `${total} spécimen(s) ${filterCount > 0 ? '— ' + filterCount + ' filtre(s) actif(s)' : ''}`}
        actions={
          <>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={reset}>Réinitialiser</Button>
            )}
            <Button variant="secondary" size="sm" icon={Filter}
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden">
              Filtres {filterCount > 0 && <Badge tone="primary" size="xs" className="ml-1">{filterCount}</Badge>}
            </Button>
            <Button variant="secondary" size="sm" icon={Download} disabled={total === 0} onClick={handleExport}>
              Export Excel
            </Button>
          </>
        }
      />

      {/* Stats cards */}
      {stats && total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

          <Card padding="none" tone="primary" className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Hash size={13} className="text-primary" />
              <span className="text-xs text-fg-muted">Spécimens</span>
            </div>
            <p className="text-2xl font-bold text-primary">{stats.total}</p>
            <p className="text-xs text-fg-subtle mt-1">{stats.totalIndividus} individu(s)</p>
          </Card>

          <Card padding="none" className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Bug size={13} className="text-fg-subtle" />
              <span className="text-xs text-fg-muted">Par type</span>
            </div>
            <div className="space-y-1 mt-2">
              {Object.entries(stats.parType).filter(([, v]) => v > 0).map(([t, count]) => (
                <div key={t} className="flex items-center justify-between text-xs">
                  <Badge tone={TYPE_TONE[t]} size="xs">{TYPE_LABEL[t]}</Badge>
                  <span className="font-semibold text-fg">{count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="none" className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={13} className="text-fg-subtle" />
              <span className="text-xs text-fg-muted">Top espèces</span>
            </div>
            <div className="space-y-1 mt-2">
              {stats.topEspeces.slice(0, 3).map((e) => (
                <div key={e.nom} className="flex items-center justify-between text-xs">
                  <span className="italic text-fg truncate">{e.nom}</span>
                  <span className="font-semibold text-fg-muted ml-2">{e.count}</span>
                </div>
              ))}
              {stats.topEspeces.length === 0 && <p className="text-xs text-fg-subtle">—</p>}
            </div>
          </Card>

          <Card padding="none" className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={13} className="text-fg-subtle" />
              <span className="text-xs text-fg-muted">Période</span>
            </div>
            {stats.periode.dateMin ? (
              <>
                <p className="text-sm font-semibold text-fg">
                  {new Date(stats.periode.dateMin).toLocaleDateString('fr-FR')}
                </p>
                <p className="text-xs text-fg-subtle mt-0.5">
                  → {new Date(stats.periode.dateMax).toLocaleDateString('fr-FR')}
                </p>
              </>
            ) : (
              <p className="text-sm text-fg-subtle">Non datée</p>
            )}
          </Card>
        </div>
      )}

      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-5">

        {/* Panneau de filtres */}
        <Card padding="none" className={`${showFilters ? 'block' : 'hidden'} lg:block self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] overflow-hidden lg:overflow-y-auto`}>
          <div className="px-4 py-3 border-b border-border bg-surface-2/50 flex items-center gap-2">
            <Filter size={14} className="text-fg-subtle" />
            <span className="text-sm font-semibold text-fg">Filtres</span>
          </div>

          <FilterSection title="Type" icon={Bug}>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(TYPE_LABEL).map(([key, label]) => {
                const active = activeTypes.includes(key);
                return (
                  <button
                    key={key} type="button" onClick={() => toggleType(key)}
                    className={`text-xs font-medium px-2 py-1.5 rounded-lg border transition-all ${
                      active
                        ? `bg-specimen-${key}/10 text-specimen-${key} border-specimen-${key}`
                        : 'border-border-strong text-fg-subtle hover:bg-surface-2'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </FilterSection>

          <FilterSection title="Recherche" icon={Search}>
            <input type="text" placeholder="Recherche dans les notes…"
              value={f.search || ''} onChange={(e) => setFilter('search', e.target.value)}
              className={inputCls} />
          </FilterSection>

          <FilterSection title="Localisation" icon={MapPin}>
            <select className={inputCls} value={f.projetId || ''} onChange={(e) => setFilter('projetId', e.target.value)}>
              <option value="">Tous les projets</option>
              {projets.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>)}
            </select>
            <select className={inputCls} value={f.missionId || ''} onChange={(e) => setFilter('missionId', e.target.value)}>
              <option value="">Toutes les missions</option>
              {missions.filter((m) => !f.projetId || m.projet?.id === parseInt(f.projetId))
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

          <FilterSection title="Période" icon={Calendar}>
            <div className="space-y-1.5">
              <label className="text-xs text-fg-subtle">Du</label>
              <input type="date" className={inputCls} value={f.dateDebut || ''} onChange={(e) => setFilter('dateDebut', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-fg-subtle">Au</label>
              <input type="date" className={inputCls} value={f.dateFin || ''} onChange={(e) => setFilter('dateFin', e.target.value)} />
            </div>
          </FilterSection>

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

          <FilterSection title="Conservation" icon={FlaskConical} defaultOpen={false}>
            <select className={inputCls} value={f.solutionId || ''} onChange={(e) => setFilter('solutionId', e.target.value)}>
              <option value="">Toutes les solutions</option>
              {solutions.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </FilterSection>
        </Card>

        {/* Résultats */}
        <div>
          {loading ? (
            <Card padding="lg"><Spinner.Block label="Recherche en cours…" height="h-32" /></Card>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Aucun spécimen ne correspond aux critères"
              description={hasActiveFilters ? 'Essayez d\'élargir les critères ou de réinitialiser.' : 'Aucune donnée n\'est encore enregistrée.'}
              action={hasActiveFilters ? { label: 'Réinitialiser', icon: RotateCcw, onClick: reset, variant: 'secondary' } : undefined}
            />
          ) : (
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-surface-2 border-b border-border">
                    <tr>
                      {['Type', 'ID terrain', '#ID', 'Taxonomie', 'Nb', 'Sexe', 'Stade', 'Mission', 'Localité', 'Méthode', 'Hôte', 'Date'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-fg-muted tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((s) => (
                      <tr key={`${s._type}-${s.id}`} className="hover:bg-surface-2 transition-colors">
                        <td className="px-4 py-3"><Badge tone={TYPE_TONE[s._type]}>{TYPE_LABEL[s._type]}</Badge></td>
                        <td className="px-4 py-3">
                          {s.idTerrain
                            ? <Badge tone="primary" size="sm" className="font-mono font-bold">{s.idTerrain}</Badge>
                            : <span className="text-fg-subtle text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-fg-subtle">#{s.id}</td>
                        <td className="px-4 py-3 italic font-medium text-fg">{taxoLabel(s.taxonomie)}</td>
                        <td className="px-4 py-3 text-fg-muted font-semibold">{s.nombre}</td>
                        <td className="px-4 py-3"><Badge tone={SEXE_TONE[s.sexe || 'inconnu']}>{SEXE_LABEL[s.sexe || 'inconnu']}</Badge></td>
                        <td className="px-4 py-3 text-xs text-fg-muted">{s.stade || <span className="text-fg-subtle">—</span>}</td>
                        <td className="px-4 py-3 text-xs text-fg-muted font-mono">{s.methode?.localite?.mission?.ordreMission || '—'}</td>
                        <td className="px-4 py-3 text-xs text-fg-muted">
                          <div>{s.methode?.localite?.nom || '—'}</div>
                          {s.methode?.localite?.region && (
                            <div className="text-[10px] text-fg-subtle">{s.methode.localite.region}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-fg-muted">{s.methode?.typeMethode?.nom || '—'}</td>
                        <td className="px-4 py-3 text-xs text-fg-muted">
                          {s.hote?.taxonomieHote?.nom || <span className="text-fg-subtle">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-fg-subtle whitespace-nowrap">
                          {s.dateCollecte ? new Date(s.dateCollecte).toLocaleDateString('fr-FR') : <span className="text-fg-subtle">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {total > items.length && (
                <div className="px-4 py-3 border-t border-border bg-surface-2/50 text-xs text-fg-muted text-center">
                  Affichage de {items.length} / {total} résultats — précisez vos filtres pour réduire le nombre
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
