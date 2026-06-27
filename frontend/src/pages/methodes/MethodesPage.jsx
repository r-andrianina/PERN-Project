import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beaker, Plus, Search, X, MapPin } from 'lucide-react';
import { Card, Badge, Button, EmptyState, PageHeader, Spinner, DataTable, Pagination } from '../../components/ui';
import { useApiQuery } from '../../hooks';

const COLUMNS = [
  {
    key:          'id',
    label:        '#ID',
    sortable:     true,
    skeletonWidth: '40%',
    width:        '64px',
    hidden:       'hidden sm:table-cell',
    className:    'font-mono text-xs text-fg-subtle',
    render: (m) => `#${m.id}`,
  },
  {
    key:          'methode',
    label:        'Méthode',
    skeletonWidth: '75%',
    render: (m) => (
      <div className="flex items-center gap-2">
        {m.typeMethode?.code && (
          <span className="font-mono text-xs bg-surface-3 text-fg-muted px-2 py-0.5 rounded border border-border">
            {m.typeMethode.code}
          </span>
        )}
        <span className="text-fg font-medium">{m.typeMethode?.nom ?? '—'}</span>
      </div>
    ),
  },
  {
    key:          'localite',
    label:        'Localité',
    skeletonWidth: '65%',
    hidden:       'hidden md:table-cell',
    render: (m) => (
      <span className="flex items-center gap-1 text-fg-muted text-xs">
        <MapPin size={11} className="text-fg-subtle flex-shrink-0" />
        {m.localite?.nom ?? '—'}
      </span>
    ),
  },
  {
    key:          'mission',
    label:        'Mission',
    skeletonWidth: '55%',
    hidden:       'hidden lg:table-cell',
    className:    'font-mono text-xs text-fg-subtle',
    render: (m) => m.localite?.mission?.ordreMission ?? null,
  },
  {
    key:          'habitat',
    label:        'Habitat',
    skeletonWidth: '60%',
    hidden:       'hidden lg:table-cell',
    render: (m) => <span className="text-fg-muted text-xs">{m.typeHabitat?.nom ?? null}</span>,
  },
  {
    key:          'environnement',
    label:        'Environnement',
    skeletonWidth: '65%',
    hidden:       'hidden xl:table-cell',
    render: (m) => <span className="text-fg-muted text-xs">{m.typeEnvironnement?.nom ?? null}</span>,
  },
  {
    key:          'dateCollecte',
    label:        'Date',
    sortable:     true,
    skeletonWidth: '60%',
    hidden:       'hidden sm:table-cell',
    className:    'text-fg-subtle text-xs whitespace-nowrap',
    render: (m) => m.dateCollecte ? new Date(m.dateCollecte).toLocaleDateString('fr-FR') : null,
  },
  {
    key:           'total',
    label:         'Spécimens',
    sortable:      true,
    skeletonWidth: '45%',
    width:         '96px',
    headerClassName: 'text-center',
    className:     'text-center',
    render: (m) => {
      const n = (m._count?.moustiques || 0) + (m._count?.tiques || 0) + (m._count?.puces || 0);
      return <Badge tone="success">{n}</Badge>;
    },
  },
];

export default function MethodesPage() {
  const navigate = useNavigate();
  const { data, loading: isLoading } = useApiQuery('/methodes', { select: (r) => r.methodes ?? [] });

  const [search, setSearch] = useState('');
  const [sort,   setSort]   = useState(null);
  const [page,   setPage]   = useState(1);
  const [limit,  setLimit]  = useState(25);

  const filtered = useMemo(() => {
    const methodes = data ?? [];
    let list = methodes;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((m) =>
        m.typeMethode?.nom?.toLowerCase().includes(s) ||
        m.typeMethode?.code?.toLowerCase().includes(s) ||
        m.localite?.nom?.toLowerCase().includes(s) ||
        m.notes?.toLowerCase().includes(s)
      );
    }
    if (!sort) return list;
    return [...list].sort((a, b) => {
      let av, bv;
      switch (sort.key) {
        case 'id':          av = a.id;          bv = b.id;          break;
        case 'dateCollecte': av = a.dateCollecte; bv = b.dateCollecte; break;
        case 'total':
          av = (a._count?.moustiques || 0) + (a._count?.tiques || 0) + (a._count?.puces || 0);
          bv = (b._count?.moustiques || 0) + (b._count?.tiques || 0) + (b._count?.puces || 0);
          break;
        default: return 0;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'fr');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [data, search, sort]);

  const methodes  = data ?? [];
  const pageCount = Math.ceil(filtered.length / limit) || 1;
  const paged     = filtered.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Beaker} iconTone="info"
        title="Méthodes de collecte" subtitle={`${methodes.length} méthode(s) enregistrée(s)`}
        actions={<Button icon={Plus} onClick={() => navigate('/methodes/nouvelle')}>Nouvelle méthode</Button>}
      />

      {isLoading ? <Spinner.Block /> : methodes.length === 0 ? (
        <EmptyState icon={Beaker} title="Aucune méthode enregistrée"
          action={{ label: 'Créer la première méthode', icon: Plus, onClick: () => navigate('/methodes/nouvelle') }} />
      ) : (
        <Card padding="none" className="overflow-hidden">
          {/* Barre de recherche */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 border border-border-strong rounded-xl px-3.5 py-2 bg-surface-2 focus-within:bg-surface focus-within:border-primary transition-all">
              <Search size={14} className="text-fg-subtle flex-shrink-0" />
              <input
                type="text"
                placeholder="Rechercher par méthode, localité ou note…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="flex-1 text-sm bg-transparent border-none outline-none text-fg placeholder-fg-subtle"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1); }} className="text-fg-subtle hover:text-fg-muted">
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="text-xs text-fg-subtle whitespace-nowrap font-medium">{filtered.length} résultat(s)</span>
          </div>

          <DataTable
            columns={COLUMNS}
            rows={paged}
            loading={false}
            sort={sort}
            onSort={(key, dir) => { setSort({ key, dir }); setPage(1); }}
            minWidth="850px"
            maxHeight="calc(100vh - 310px)"
            empty={
              <span className="text-fg-subtle text-sm">
                Aucune méthode pour «&nbsp;{search}&nbsp;»
              </span>
            }
          />

          <Pagination
            page={page} pages={pageCount} total={filtered.length} limit={limit}
            onChange={setPage}
            onLimitChange={(n) => { setLimit(n); setPage(1); }}
          />
        </Card>
      )}
    </div>
  );
}
