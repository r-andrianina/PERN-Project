import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Search, X } from 'lucide-react';
import { Card, Button, Badge, EmptyState, PageHeader, Spinner, Pagination, DataTable } from '../../components/ui';
import { useApiQuery } from '../../hooks';
import { exportBlob, exportDate } from '../../api/exportBlob';
import SpecimenIcon from '../../components/SpecimenIcon';
import { formatGorgement } from '../../utils/gorgement';
import { taxoLabel } from '../../utils/taxoLabel';
import { useT, interpolate } from '../../lib/i18n';

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };

function sortRows(rows, sort, locale) {
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
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), locale);
    return sort.dir === 'asc' ? cmp : -cmp;
  });
}

export default function TiquesPage() {
  const t = useT();
  const SEXE_LABEL = { M: t('sexe.M'), F: t('sexe.F'), inconnu: t('sexe.inconnu') };
  const COLUMNS = [
    {
      key: 'idTerrain',
      label: t('specimenList.colIdTerrain'),
      sortable: true,
      skeletonWidth: '55%',
      width: '110px',
      render: (r) => r.idTerrain
        ? <Badge tone="primary" size="sm" className="font-mono font-bold">{r.idTerrain}</Badge>
        : null,
    },
    {
      key: 'id',
      label: t('specimenList.colId'),
      skeletonWidth: '40%',
      width: '64px',
      hidden: 'hidden sm:table-cell',
      className: 'font-mono text-xs text-fg-subtle',
      render: (r) => `#${r.id}`,
    },
    {
      key: 'espece',
      label: t('specimenList.colEspece'),
      skeletonWidth: '80%',
      render: (r) => (
        <span className="font-semibold text-fg italic">
          {taxoLabel(r.taxonomie) || null}
        </span>
      ),
    },
    {
      key: 'nombre',
      label: t('specimenList.colNb'),
      sortable: true,
      skeletonWidth: '30%',
      width: '52px',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (r) => <span className="text-fg-muted font-medium tabular-nums">{r.nombre}</span>,
    },
    {
      key: 'sexe',
      label: t('specimenList.colSexe'),
      sortable: true,
      skeletonWidth: '55%',
      render: (r) => (
        <Badge tone={SEXE_TONE[r.sexe] ?? 'default'}>
          {SEXE_LABEL[r.sexe] ?? t('sexe.inconnu')}
        </Badge>
      ),
    },
    {
      key: 'stade',
      label: t('specimenList.colStade'),
      skeletonWidth: '60%',
      hidden: 'hidden md:table-cell',
      render: (r) => <span className="text-fg-muted text-xs">{r.stade || null}</span>,
    },
    {
      key: 'gorge',
      label: t('specimenList.colGorgee'),
      skeletonWidth: '55%',
      hidden: 'hidden sm:table-cell',
      render: (r) => (
        <Badge tone={['G', 'Gr'].includes(r.gorge) ? 'danger' : 'default'}>
          {formatGorgement(r.gorge)}
        </Badge>
      ),
    },
    {
      key: 'hote',
      label: t('specimenList.colHote'),
      skeletonWidth: '65%',
      hidden: 'hidden md:table-cell',
      render: (r) => (
        <span className="text-fg-muted text-xs">
          {r.hote?.taxonomieHote?.nom || null}
        </span>
      ),
    },
    {
      key: 'position',
      label: t('specimenList.colPosition'),
      skeletonWidth: '50%',
      hidden: 'hidden lg:table-cell',
      render: (r) => r.position
        ? (
          <Badge tone="warning" size="xs" className="font-mono">
            {r.container?.code ? `${r.container.code} ${r.position}` : r.position}
          </Badge>
        )
        : null,
    },
    {
      key: 'localite',
      label: t('specimenList.colLocalite'),
      skeletonWidth: '75%',
      hidden: 'hidden md:table-cell',
      render: (r) => (
        <span className="text-fg-muted text-xs max-w-[7rem] truncate block">
          {r.methode?.localite?.nom || null}
        </span>
      ),
    },
    {
      key: 'dateCollecte',
      label: t('specimenList.colDate'),
      sortable: true,
      skeletonWidth: '60%',
      className: 'whitespace-nowrap',
      render: (r) => (
        <span className="text-fg-subtle text-xs">
          {r.dateCollecte ? new Date(r.dateCollecte).toLocaleDateString(t('common.locale')) : null}
        </span>
      ),
    },
  ];

  const navigate = useNavigate();
  const [search,    setSearch]    = useState('');
  const [debounced, setDebounced] = useState('');
  const [page,      setPage]      = useState(1);
  const [limit,     setLimit]     = useState(50);
  const [sort,      setSort]      = useState(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try { await exportBlob('/tiques/export', {}, `tiques_${exportDate()}.xlsx`); }
    finally { setExporting(false); }
  };

  useEffect(() => {
    const tid = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(tid);
  }, [search]);

  const { data, loading } = useApiQuery('/tiques', {
    params: { page, limit, search: debounced || undefined },
    deps: [page, limit, debounced],
  });

  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const rows = useMemo(() => sortRows(data?.tiques ?? [], sort, t('common.locale')), [data, sort, t]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={() => <SpecimenIcon type="tique" size={18} />}
        iconTone="specimen-tique"
        title={t('dashboard.tiques')}
        subtitle={interpolate(t('specimenList.total'), { n: total })}
        actions={
          <>
            <Button variant="secondary" icon={Download}
              onClick={handleExport} disabled={exporting}>
              {exporting ? t('specimenList.exporting') : t('specimenList.exportExcel')}
            </Button>
            <Button icon={Plus} onClick={() => navigate('/specimens/tiques/nouveau')}>
              {t('specimenList.add')}
            </Button>
          </>
        }
      />

      {loading && !data ? (
        <Spinner.Block label={t('specimenList.loading')} />
      ) : total === 0 && !debounced ? (
        <EmptyState
          icon={() => <SpecimenIcon type="tique" size={40} />}
          title={t('tiquesPage.noneYet')}
          action={{
            label: t('specimenList.addFirst'),
            icon: Plus,
            onClick: () => navigate('/specimens/tiques/nouveau'),
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
                placeholder={t('specimenList.searchPlaceholder')}
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
              {interpolate(t('specimenList.resultsCount'), { n: total })}
            </span>
          </div>

          <DataTable
            columns={COLUMNS}
            rows={rows}
            loading={loading}
            skeletonRows={Math.min(limit, 10)}
            sort={sort}
            onSort={(key, dir) => setSort({ key, dir })}
            onRowClick={(r) => navigate(`/specimens/tiques/${r.id}`)}
            minWidth="880px"
            empty={
              <span className="text-fg-subtle text-sm">
                {interpolate(t('specimenList.noResultsFor'), { query: debounced })}
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
