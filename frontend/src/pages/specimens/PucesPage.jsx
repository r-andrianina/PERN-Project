import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Search, X } from 'lucide-react';
import { Card, Button, Badge, EmptyState, PageHeader, Spinner, Pagination, DataTable } from '../../components/ui';
import { useApiQuery } from '../../hooks';
import SpecimenIcon from '../../components/SpecimenIcon';
import { taxoLabel } from '../../utils/taxoLabel';

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const SEXE_LABEL = { M: 'Mâle', F: 'Femelle', inconnu: 'Inconnu' };

function sortRows(rows, sort) {
  if (!sort) return rows;
  return [...rows].sort((a, b) => {
    let av, bv;
    switch (sort.key) {
      case 'idTerrain':    av = a.idTerrain;    bv = b.idTerrain;    break;
      case 'nombre':       av = a.nombre;       bv = b.nombre;       break;
      case 'sexe':         av = a.sexe;         bv = b.sexe;         break;
      case 'dateCollecte':
        av = a.dateCollecte ? new Date(a.dateCollecte).getTime() : null;
        bv = b.dateCollecte ? new Date(b.dateCollecte).getTime() : null;
        break;
      default: return 0;
    }
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'fr');
    return sort.dir === 'asc' ? cmp : -cmp;
  });
}

const COLUMNS = [
  {
    key: 'idTerrain',
    label: 'ID terrain',
    sortable: true,
    skeletonWidth: '55%',
    width: '110px',
    render: (p) => p.idTerrain
      ? <Badge tone="primary" size="sm" className="font-mono font-bold">{p.idTerrain}</Badge>
      : null,
  },
  {
    key: 'id',
    label: '#ID',
    skeletonWidth: '40%',
    width: '64px',
    hidden: 'hidden sm:table-cell',
    className: 'font-mono text-xs text-fg-subtle',
    render: (p) => `#${p.id}`,
  },
  {
    key: 'espece',
    label: 'Espèce',
    skeletonWidth: '80%',
    render: (p) => (
      <span className="font-semibold text-fg italic">
        {taxoLabel(p.taxonomie) || null}
      </span>
    ),
  },
  {
    key: 'nombre',
    label: 'Nb',
    sortable: true,
    skeletonWidth: '30%',
    width: '52px',
    headerClassName: 'text-right',
    className: 'text-right',
    render: (p) => <span className="text-fg-muted font-medium tabular-nums">{p.nombre}</span>,
  },
  {
    key: 'sexe',
    label: 'Sexe',
    sortable: true,
    skeletonWidth: '55%',
    render: (p) => (
      <Badge tone={SEXE_TONE[p.sexe] ?? 'default'}>
        {SEXE_LABEL[p.sexe] ?? 'Inconnu'}
      </Badge>
    ),
  },
  {
    key: 'stade',
    label: 'Stade',
    skeletonWidth: '60%',
    hidden: 'hidden md:table-cell',
    render: (p) => <span className="text-fg-muted text-xs">{p.stade || null}</span>,
  },
  {
    key: 'hote',
    label: 'Hôte',
    skeletonWidth: '65%',
    hidden: 'hidden md:table-cell',
    render: (p) => (
      <span className="text-fg-muted text-xs">
        {p.hote?.taxonomieHote?.nom || null}
      </span>
    ),
  },
  {
    key: 'position',
    label: 'Position',
    skeletonWidth: '50%',
    hidden: 'hidden lg:table-cell',
    render: (p) => p.position
      ? (
        <Badge tone="warning" size="xs" className="font-mono">
          {p.container?.code ? `${p.container.code} ${p.position}` : p.position}
        </Badge>
      )
      : null,
  },
  {
    key: 'localite',
    label: 'Localité',
    skeletonWidth: '75%',
    hidden: 'hidden md:table-cell',
    render: (p) => (
      <span className="text-fg-muted text-xs max-w-[7rem] truncate block">
        {p.methode?.localite?.nom || null}
      </span>
    ),
  },
  {
    key: 'dateCollecte',
    label: 'Date',
    sortable: true,
    skeletonWidth: '60%',
    className: 'whitespace-nowrap',
    render: (p) => (
      <span className="text-fg-subtle text-xs">
        {p.dateCollecte ? new Date(p.dateCollecte).toLocaleDateString('fr-FR') : null}
      </span>
    ),
  },
];

export default function PucesPage() {
  const navigate = useNavigate();
  const [search,    setSearch]    = useState('');
  const [debounced, setDebounced] = useState('');
  const [page,      setPage]      = useState(1);
  const [limit,     setLimit]     = useState(50);
  const [sort,      setSort]      = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading } = useApiQuery('/puces', {
    params: { page, limit, search: debounced || undefined },
    deps: [page, limit, debounced],
  });

  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const rows = useMemo(() => sortRows(data?.puces ?? [], sort), [data, sort]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={() => <SpecimenIcon type="puce" size={18} />}
        iconTone="specimen-puce"
        title="Puces"
        subtitle={`${total} spécimen(s) au total`}
        actions={
          <>
            <Button variant="secondary" icon={Download}
              onClick={() => window.open('http://localhost:3000/api/v1/puces/export', '_blank')}>
              Export
            </Button>
            <Button icon={Plus} onClick={() => navigate('/specimens/puces/nouveau')}>
              Ajouter
            </Button>
          </>
        }
      />

      {loading && !data ? (
        <Spinner.Block label="Chargement…" />
      ) : total === 0 && !debounced ? (
        <EmptyState
          icon={() => <SpecimenIcon type="puce" size={40} />}
          title="Aucune puce enregistrée"
          action={{
            label: 'Ajouter le premier spécimen',
            icon: Plus,
            onClick: () => navigate('/specimens/puces/nouveau'),
          }}
        />
      ) : (
        <Card padding="none" className="overflow-hidden">

          {/* Barre de recherche */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 border border-border-strong rounded-xl px-3.5 py-2 bg-surface-2 focus-within:bg-surface focus-within:border-primary transition-all">
              <Search size={14} className="text-fg-subtle flex-shrink-0" />
              <input
                type="text"
                placeholder="Rechercher par espèce, ID terrain ou notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent border-none outline-none text-fg placeholder-fg-subtle"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg-muted">
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="text-xs text-fg-subtle whitespace-nowrap font-medium">
              {total} résultat(s)
            </span>
          </div>

          <DataTable
            columns={COLUMNS}
            rows={rows}
            loading={loading}
            skeletonRows={Math.min(limit, 10)}
            sort={sort}
            onSort={(key, dir) => setSort({ key, dir })}
            onRowClick={(p) => navigate(`/specimens/puces/${p.id}`)}
            minWidth="820px"
            empty={
              <span className="text-fg-subtle text-sm">
                Aucun résultat pour «&nbsp;{debounced}&nbsp;»
              </span>
            }
          />

          <Pagination
            page={page} pages={pages} total={total} limit={limit}
            onChange={setPage}
            onLimitChange={(n) => { setLimit(n); setPage(1); }}
          />
        </Card>
      )}
    </div>
  );
}
