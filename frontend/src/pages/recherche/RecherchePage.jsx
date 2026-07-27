// Recherche unifiée multi-critères des spécimens (Moustiques + Tiques + Puces).
// Filtres synchronisés dans l'URL pour partage/persistance.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Download, ChevronDown, ChevronUp, ChevronLeft,
  Bug, Calendar, MapPin, Layers, RotateCcw, FlaskConical, PawPrint,
  TrendingUp, Hash, SlidersHorizontal,
} from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, Button, EmptyState, PageHeader, Select, DataTable, DatePicker } from '../../components/ui';
import { STADE_OPTIONS_MOUSTIQUE, formatStade } from '../../utils/stade';
import { GORGEMENT_OPTIONS } from '../../utils/gorgement';

// ── Constantes UI ─────────────────────────────────────────────
const TYPE_TONE  = { moustique: 'specimen-moustique', tique: 'specimen-tique', puce: 'specimen-puce' };
const TYPE_LABEL = { moustique: 'Moustique', tique: 'Tique', puce: 'Puce' };

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const SEXE_LABEL = { M: 'Mâle', F: 'Femelle', inconnu: 'Inconnu' };

const PARITE_OPTIONS = ['Nulle', 'Paucie', 'Multi'];
const STADE_SUGGEST  = STADE_OPTIONS_MOUSTIQUE;

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

// Construit le label de localité : fokontany / commune / district / région
const localiteLabel = (localite) => {
  if (!localite) return '—';
  const parts = [localite.fokontany, localite.commune, localite.district, localite.region]
    .filter(Boolean);
  return parts.length ? parts.join(' / ') : localite.nom || '—';
};

// Construit le code méthode : CDC_1, BG_2, etc.
const methodeCode = (methode) => {
  if (!methode) return null;
  const code = methode.typeMethode?.code;
  if (code && methode.numero != null) return `${code}_${methode.numero}`;
  return methode.typeMethode?.nom ?? null;
};

// ── Colonnes résultats ────────────────────────────────────────
const RESULT_COLUMNS = [
  {
    key:          '_type',
    label:        'Type',
    skeletonWidth: '55%',
    render: (s) => <Badge tone={TYPE_TONE[s._type]}>{TYPE_LABEL[s._type]}</Badge>,
  },
  {
    key:          'idTerrain',
    label:        'ID terrain',
    skeletonWidth: '65%',
    render: (s) => s.idTerrain
      ? <Badge tone="primary" size="sm" className="font-mono font-bold">{s.idTerrain}</Badge>
      : null,
  },
  {
    key:          'taxonomie',
    label:        'Taxonomie',
    skeletonWidth: '80%',
    className:    'italic font-medium text-fg',
    render: (s) => taxoLabel(s.taxonomie),
  },
  {
    key:           'nombre',
    label:         'Nb',
    skeletonWidth: '30%',
    width:         '50px',
    className:     'text-fg-muted font-semibold',
    render: (s) => s.nombre,
  },
  {
    key:          'sexe',
    label:        'Sexe',
    skeletonWidth: '50%',
    render: (s) => (
      <Badge tone={SEXE_TONE[s.sexe || 'inconnu']}>{SEXE_LABEL[s.sexe || 'inconnu']}</Badge>
    ),
  },
  {
    key:          'stade',
    label:        'Stade',
    skeletonWidth: '55%',
    hidden:       'hidden md:table-cell',
    className:    'text-xs text-fg-muted',
    render: (s) => s.stade ? formatStade(s.stade) : null,
  },
  {
    key:          'mission',
    label:        'Mission',
    skeletonWidth: '60%',
    hidden:       'hidden lg:table-cell',
    className:    'text-xs text-fg-muted font-mono',
    render: (s) => s.methode?.localite?.mission?.ordreMission ?? null,
  },
  {
    key:          'localite',
    label:        'Localité',
    skeletonWidth: '70%',
    hidden:       'hidden md:table-cell',
    render: (s) => {
      const loc = s.methode?.localite;
      const label = localiteLabel(loc);
      return (
        <div>
          <div className="text-xs text-fg-muted leading-tight">{label}</div>
          {loc?.nom && (
            <div className="text-[10px] text-fg-subtle mt-0.5 italic">{loc.nom}</div>
          )}
        </div>
      );
    },
  },
  {
    key:          'methode',
    label:        'Méthode',
    skeletonWidth: '60%',
    hidden:       'hidden lg:table-cell',
    render: (s) => {
      const code = methodeCode(s.methode);
      return code
        ? <span className="text-xs font-mono font-semibold text-fg-muted">{code}</span>
        : null;
    },
  },
  {
    key:          'hote',
    label:        'Hôte',
    skeletonWidth: '55%',
    hidden:       'hidden xl:table-cell',
    className:    'text-xs text-fg-muted',
    render: (s) => s.hote?.taxonomieHote?.nom ?? null,
  },
  {
    key:          'dateCollecte',
    label:        'Date',
    skeletonWidth: '65%',
    hidden:       'hidden sm:table-cell',
    className:    'text-xs text-fg-subtle whitespace-nowrap',
    render: (s) => s.dateCollecte ? new Date(s.dateCollecte).toLocaleDateString('fr-FR') : null,
  },
];

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
  const [loading,     setLoading]     = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
        setItems(r.data.items.map((s) => ({ ...s, _key: `${s._type}-${s.id}` })));
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
    <div className="flex flex-col gap-4">

      <PageHeader
        icon={Search} iconTone="primary"
        title="Explorer les spécimens"
        subtitle={
          loading
            ? 'Recherche en cours…'
            : `${total} spécimen(s)${filterCount > 0 ? ` — ${filterCount} filtre(s) actif(s)` : ''}`
        }
        actions={
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={reset}>
                Réinitialiser
              </Button>
            )}
            {/* Toggle filtres — mobile uniquement */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-border-strong bg-surface hover:bg-surface-2 transition-colors"
            >
              <SlidersHorizontal size={13} />
              Filtres
              {filterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                  {filterCount}
                </span>
              )}
            </button>
            <Button variant="secondary" size="sm" icon={Download} disabled={total === 0} onClick={handleExport}>
              Export Excel
            </Button>
          </div>
        }
      />

      {/* Layout 2 colonnes */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* Panneau de filtres — desktop : sidebar animée */}
        <div
          className={`hidden lg:block relative flex-shrink-0 self-start sticky top-4
            transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
            ${sidebarOpen ? 'w-[272px]' : 'w-8'}`}
        >
          {/* Bouton toggle — flottant à l'arête droite */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Masquer les filtres' : 'Afficher les filtres'}
            className="absolute -right-3 top-3.5 z-30 w-6 h-6
              flex items-center justify-center rounded-full
              bg-surface border border-border shadow-md
              hover:bg-primary/10 hover:border-primary/30 hover:shadow-lg
              transition-all duration-200"
          >
            {/* Badge filtre actif visible quand panel fermé */}
            {!sidebarOpen && filterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center">
                {filterCount}
              </span>
            )}
            <ChevronLeft
              size={12}
              className={`text-fg-subtle transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
                ${sidebarOpen ? '' : 'rotate-180'}`}
            />
          </button>

          {/* Contenu du panneau */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] origin-left
              ${sidebarOpen ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-90 pointer-events-none'}`}
          >
            <Card padding="none" className="max-h-[calc(100vh-210px)] overflow-y-auto datatable-scroll">
              <div className="px-4 py-3 border-b border-border bg-surface-2/60 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={13} className="text-fg-subtle" />
                  <span className="text-sm font-semibold text-fg">Filtres</span>
                  {filterCount > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold">
                      {filterCount}
                    </span>
                  )}
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={reset}
                    title="Tout effacer"
                    className="text-xs text-fg-subtle hover:text-danger transition-colors flex items-center gap-1"
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                )}
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
            <Select
              value={f.projetId || ''}
              onChange={(val) => setFilter('projetId', val)}
              options={[
                { value: '', label: 'Tous les projets' },
                ...projets.map((p) => ({ value: p.id, label: p.porteur ? `${p.nom} / ${p.porteur}` : p.nom })),
              ]}
            />
            <Select
              value={f.missionId || ''}
              onChange={(val) => setFilter('missionId', val)}
              options={[
                { value: '', label: 'Toutes les missions' },
                ...missions.filter((m) => !f.projetId || m.projet?.id === parseInt(f.projetId))
                  .map((m) => ({ value: m.id, label: m.ordreMission })),
              ]}
            />
            <Select
              value={f.localiteId || ''}
              onChange={(val) => setFilter('localiteId', val)}
              disabled={!f.missionId}
              options={[
                { value: '', label: 'Toutes les localités' },
                ...localites.map((l) => ({ value: l.id, label: l.nom })),
              ]}
            />
            <Select
              value={f.methodeId || ''}
              onChange={(val) => setFilter('methodeId', val)}
              disabled={!f.localiteId}
              options={[
                { value: '', label: 'Toutes les méthodes' },
                ...methodes.map((m) => ({
                  value: m.id,
                  label: `${m.typeMethode?.code ? `[${m.typeMethode.code}] ` : ''}${m.typeMethode?.nom || `#${m.id}`}`,
                })),
              ]}
            />
            <input className={inputCls} placeholder="Région" value={f.region || ''} onChange={(e) => setFilter('region', e.target.value)} />
            <input className={inputCls} placeholder="District" value={f.district || ''} onChange={(e) => setFilter('district', e.target.value)} />
          </FilterSection>

          <FilterSection title="Période" icon={Calendar}>
            <div className="space-y-1.5">
              <label className="text-xs text-fg-subtle">Du</label>
              <DatePicker value={f.dateDebut || ''} onChange={(val) => setFilter('dateDebut', val)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-fg-subtle">Au</label>
              <DatePicker value={f.dateFin || ''} onChange={(val) => setFilter('dateFin', val)} />
            </div>
          </FilterSection>

          <FilterSection title="Taxonomie" icon={Bug}>
            <Select
              value={f.taxonomieId || ''}
              onChange={(val) => setFilter('taxonomieId', val)}
              searchPlaceholder="Rechercher une taxonomie…"
              options={[
                { value: '', label: 'Toutes les taxonomies' },
                ...taxonomiesFiltered.map((t) => ({
                  value: t.id,
                  label: `[${t.niveau}] ${t.parent?.nom ? t.parent.nom + ' ' : ''}${t.nom}`,
                })),
              ]}
            />
          </FilterSection>

          <FilterSection title="Biologie" icon={Layers} defaultOpen={false}>
            <Select
              value={f.sexe || ''}
              onChange={(val) => setFilter('sexe', val)}
              options={[
                { value: '', label: 'Tous les sexes' },
                { value: 'M', label: 'Mâle' },
                { value: 'F', label: 'Femelle' },
                { value: 'inconnu', label: 'Inconnu' },
              ]}
            />
            <Select
              value={f.stade || ''}
              onChange={(val) => setFilter('stade', val)}
              options={[
                { value: '', label: 'Tous les stades' },
                ...STADE_SUGGEST,
              ]}
            />
            {activeTypes.includes('moustique') && (
              <>
                <Select
                  value={f.parite || ''}
                  onChange={(val) => setFilter('parite', val)}
                  options={[
                    { value: '', label: 'Toutes parités' },
                    ...PARITE_OPTIONS.map((p) => ({ value: p, label: p })),
                  ]}
                />
                <Select
                  value={f.repasSang || ''}
                  onChange={(val) => setFilter('repasSang', val)}
                  options={[
                    { value: '', label: 'Statut sanguin : tous' },
                    ...GORGEMENT_OPTIONS,
                  ]}
                />
              </>
            )}
            {activeTypes.includes('tique') && (
              <Select
                value={f.gorge || ''}
                onChange={(val) => setFilter('gorge', val)}
                options={[
                  { value: '', label: 'Statut sanguin : tous' },
                  ...GORGEMENT_OPTIONS,
                ]}
              />
            )}
          </FilterSection>

          {(activeTypes.includes('tique') || activeTypes.includes('puce')) && (
            <FilterSection title="Hôte" icon={PawPrint} defaultOpen={false}>
              <Select
                value={f.hasHote || ''}
                onChange={(val) => setFilter('hasHote', val)}
                options={[
                  { value: '', label: 'Présence hôte : tous' },
                  { value: 'true', label: 'Avec hôte' },
                  { value: 'false', label: 'Sans hôte' },
                ]}
              />
              <Select
                value={f.taxonomieHoteId || ''}
                onChange={(val) => setFilter('taxonomieHoteId', val)}
                searchPlaceholder="Rechercher un hôte…"
                options={[
                  { value: '', label: 'Tous les hôtes' },
                  ...taxonomiesHote.map((t) => ({
                    value: t.id,
                    label: `[${t.niveau}] ${t.parent?.nom ? t.parent.nom + ' ' : ''}${t.nom}`,
                  })),
                ]}
              />
            </FilterSection>
          )}

          <FilterSection title="Conservation" icon={FlaskConical} defaultOpen={false}>
            <Select
              value={f.solutionId || ''}
              onChange={(val) => setFilter('solutionId', val)}
              options={[
                { value: '', label: 'Toutes les solutions' },
                ...solutions.map((s) => ({ value: s.id, label: s.nom })),
              ]}
            />
          </FilterSection>
            </Card>
          </div>
        </div>

        {/* Panneau de filtres — mobile uniquement */}
        {showFilters && (
          <Card padding="none" className="lg:hidden w-full">
            <div className="px-4 py-3 border-b border-border bg-surface-2/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={13} className="text-fg-subtle" />
                <span className="text-sm font-semibold text-fg">Filtres</span>
                {filterCount > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold">
                    {filterCount}
                  </span>
                )}
              </div>
              <button onClick={() => setShowFilters(false)} className="text-xs text-fg-subtle hover:text-fg">
                Masquer
              </button>
            </div>
            {/* Sections filtres — identiques au desktop */}
            <FilterSection title="Type" icon={Bug}>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(TYPE_LABEL).map(([key, label]) => {
                  const active = activeTypes.includes(key);
                  return (
                    <button key={key} type="button" onClick={() => toggleType(key)}
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
          </Card>
        )}

        {/* Résultats */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Stats cards — ancrées au-dessus du tableau, ne scrollent jamais */}
          {stats && total > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card padding="none" className="p-4 border-l-4 border-l-primary">
                <p className="text-xs text-fg-muted mb-1 flex items-center gap-1.5">
                  <Hash size={12} className="text-primary" /> Spécimens
                </p>
                <p className="text-2xl font-bold text-primary leading-none">{stats.total}</p>
                <p className="text-xs text-fg-subtle mt-1.5">{stats.totalIndividus} individu(s)</p>
              </Card>

              <Card padding="none" className="p-4">
                <p className="text-xs text-fg-muted mb-2 flex items-center gap-1.5">
                  <Bug size={12} className="text-fg-subtle" /> Par type
                </p>
                <div className="space-y-1.5">
                  {Object.entries(stats.parType).filter(([, v]) => v > 0).map(([t, count]) => (
                    <div key={t} className="flex items-center justify-between">
                      <Badge tone={TYPE_TONE[t]} size="xs">{TYPE_LABEL[t]}</Badge>
                      <span className="text-xs font-bold text-fg tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card padding="none" className="p-4">
                <p className="text-xs text-fg-muted mb-2 flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-fg-subtle" /> Top espèces
                </p>
                <div className="space-y-1.5">
                  {stats.topEspeces.slice(0, 3).map((e, i) => (
                    <div key={e.nom} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold text-fg-subtle w-4 text-right flex-shrink-0">
                          {i + 1}.
                        </span>
                        <span className="italic text-xs text-fg truncate">{e.nom}</span>
                      </div>
                      <span className="text-xs font-bold text-fg-muted tabular-nums flex-shrink-0">{e.count}</span>
                    </div>
                  ))}
                  {stats.topEspeces.length === 0 && <p className="text-xs text-fg-subtle">—</p>}
                </div>
              </Card>

              <Card padding="none" className="p-4">
                <p className="text-xs text-fg-muted mb-2 flex items-center gap-1.5">
                  <Calendar size={12} className="text-fg-subtle" /> Période
                </p>
                {stats.periode.dateMin ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-fg">
                      {new Date(stats.periode.dateMin).toLocaleDateString('fr-FR')}
                    </p>
                    <p className="text-xs text-fg-subtle flex items-center gap-1">
                      <span>→</span>
                      {new Date(stats.periode.dateMax).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-fg-subtle">Non datée</p>
                )}
              </Card>
            </div>
          )}

          {/* Tableau de résultats */}
          {loading ? (
            <Card padding="none" className="overflow-hidden">
              <DataTable
                columns={RESULT_COLUMNS}
                rows={[]}
                loading={true}
                skeletonRows={10}
                minWidth="900px"
                maxHeight={stats && total > 0 ? 'calc(100vh - 320px)' : 'calc(100vh - 200px)'}
              />
            </Card>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Aucun spécimen ne correspond aux critères"
              description={hasActiveFilters ? "Essayez d'élargir les critères ou de réinitialiser." : "Aucune donnée n'est encore enregistrée."}
              action={hasActiveFilters ? { label: 'Réinitialiser', icon: RotateCcw, onClick: reset, variant: 'secondary' } : undefined}
            />
          ) : (
            <Card padding="none" className="overflow-hidden">
              <DataTable
                columns={RESULT_COLUMNS}
                rows={items}
                keyField="_key"
                loading={false}
                minWidth="900px"
                maxHeight={stats && total > 0 ? 'calc(100vh - 320px)' : 'calc(100vh - 200px)'}
              />
              {total > items.length && (
                <div className="px-4 py-3 border-t border-border bg-surface-2/50 text-xs text-fg-muted text-center">
                  Affichage de {items.length} / {total} — précisez les filtres pour réduire
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
