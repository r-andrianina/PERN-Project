import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Search, X, Trash2, Square, CheckSquare } from 'lucide-react';
import { Card, Button, Badge, EmptyState, PageHeader, Spinner, Pagination, DataTable } from '../../components/ui';
import { useApiQuery } from '../../hooks';
import { exportBlob, exportDate } from '../../api/exportBlob';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { dialog } from '../../lib/dialog';
import SpecimenIcon from '../../components/SpecimenIcon';
import { formatGorgement } from '../../utils/gorgement';
import { formatTrancheHoraire } from '../../utils/trancheHoraire';
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

export default function MoustiquesPage() {
  const t = useT();
  const BASE_COLUMNS = useMemo(() => {
    const SEXE_LABEL = { M: t('sexe.M'), F: t('sexe.F'), inconnu: t('sexe.inconnu') };
    return [
    {
      key: 'idTerrain',
      label: t('specimenList.colIdTerrain'),
      sortable: true,
      skeletonWidth: '55%',
      width: '110px',
      render: (m) => m.idTerrain
        ? <Badge tone="primary" size="sm" className="font-mono font-bold">{m.idTerrain}</Badge>
        : null,
    },
    {
      key: 'espece',
      label: t('specimenList.colGenreEspece'),
      skeletonWidth: '80%',
      render: (m) => (
        <span className="font-semibold text-fg italic">
          {taxoLabel(m.taxonomie) || null}
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
      render: (m) => <span className="text-fg-muted font-medium tabular-nums">{m.nombre}</span>,
    },
    {
      key: 'sexe',
      label: t('specimenList.colSexe'),
      sortable: true,
      skeletonWidth: '55%',
      render: (m) => (
        <Badge tone={SEXE_TONE[m.sexe] ?? 'default'}>
          {SEXE_LABEL[m.sexe] ?? t('sexe.inconnu')}
        </Badge>
      ),
    },
    {
      key: 'stade',
      label: t('specimenList.colStade'),
      skeletonWidth: '60%',
      hidden: 'hidden md:table-cell',
      render: (m) => <span className="text-fg-muted text-xs">{m.stade || null}</span>,
    },
    {
      key: 'parite',
      label: t('specimenList.colParite'),
      skeletonWidth: '50%',
      hidden: 'hidden lg:table-cell',
      render: (m) => <span className="text-fg-muted text-xs">{m.parite || null}</span>,
    },
    {
      key: 'repasSang',
      label: t('specimenList.colRepasSang'),
      skeletonWidth: '65%',
      hidden: 'hidden sm:table-cell',
      render: (m) => (
        <Badge tone={['G', 'Gr'].includes(m.repasSang) ? 'danger' : 'default'}>
          {formatGorgement(m.repasSang)}
        </Badge>
      ),
    },
    {
      key: 'trancheHoraire',
      label: t('specimenList.colTrancheHoraire'),
      skeletonWidth: '50%',
      hidden: 'hidden lg:table-cell',
      render: (m) => m.trancheHoraire
        ? <span className="text-fg-muted text-xs font-mono">{formatTrancheHoraire(m.trancheHoraire)}</span>
        : null,
    },
    {
      key: 'container',
      label: t('specimenList.colEchantillon'),
      skeletonWidth: '55%',
      hidden: 'hidden lg:table-cell',
      className: 'font-mono text-xs text-fg-muted',
      render: (m) => {
        const label = m.container
          ? `${m.container.code}${m.position ? ` · ${m.position}` : ''}`
          : null;
        return label ? <span>{label}</span> : null;
      },
    },
    {
      key: 'solution',
      label: t('specimenList.colSolution'),
      skeletonWidth: '70%',
      hidden: 'hidden xl:table-cell',
      render: (m) => (
        <span className="text-xs text-fg-muted max-w-[7rem] truncate block" title={m.solution?.nom}>
          {m.solution?.nom || null}
        </span>
      ),
    },
    {
      key: 'methode',
      label: t('specimenList.colMethode'),
      skeletonWidth: '75%',
      hidden: 'hidden xl:table-cell',
      render: (m) => (
        <span className="text-xs text-fg-muted max-w-[8rem] truncate block" title={m.methode?.typeMethode?.nom}>
          {m.methode?.typeMethode?.nom || null}
        </span>
      ),
    },
    {
      key: 'localite',
      label: t('specimenList.colLocalite'),
      skeletonWidth: '80%',
      hidden: 'hidden md:table-cell',
      render: (m) => {
        const loc = m.methode?.localite;
        const label = [loc?.region, loc?.district, loc?.commune].filter(Boolean).join(' · ') || loc?.nom || null;
        return label
          ? <span className="text-fg-muted text-xs max-w-[9rem] truncate block" title={label}>{label}</span>
          : null;
      },
    },
    {
      key: 'dateCollecte',
      label: t('specimenList.colDate'),
      sortable: true,
      skeletonWidth: '60%',
      className: 'whitespace-nowrap',
      render: (m) => (
        <span className="text-fg-subtle text-xs">
          {m.dateCollecte ? new Date(m.dateCollecte).toLocaleDateString(t('common.locale')) : null}
        </span>
      ),
    },
  ];
  }, [t]);

  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [search,     setSearch]     = useState('');
  const [debounced,  setDebounced]  = useState('');
  const [page,       setPage]       = useState(1);
  const [limit,      setLimit]      = useState(50);
  const [sort,       setSort]       = useState(null);
  const [exporting,  setExporting]  = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Bulk delete
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    const tid = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(tid);
  }, [search]);

  // Vider la sélection quand le filtre change
  useEffect(() => { setSelectedIds(new Set()); }, [debounced]);

  const { data, loading } = useApiQuery('/moustiques', {
    params: { page, limit, search: debounced || undefined },
    deps: [page, limit, debounced, refreshKey],
  });

  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const rows  = useMemo(() => sortRows(data?.moustiques ?? [], sort, t('common.locale')), [data, sort, t]);

  const toggleId = (id) =>
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds((prev) => { const s = new Set(prev); rows.forEach((r) => s.add(r.id)); return s; });
    }
  };

  const executeBulkDelete = async (body, label) => {
    setBulkDeleting(true);
    try {
      const res = await api.delete('/moustiques/bulk', { data: body });
      const deleted = res.data?.deleted ?? '?';
      setSelectedIds(new Set());
      setRefreshKey((k) => k + 1);
      // Petit feedback non-bloquant dans le titre de la page (toast serait idéal, mais pas nécessaire ici)
      console.info(`[BulkDelete] ${deleted} moustique(s) supprimé(s) — ${label}`);
    } catch (err) {
      await dialog.confirm({
        title: t('specimenList.deleteErrorTitle'),
        message: err.response?.data?.error ?? t('specimenList.genericError'),
        variant: 'warning',
        confirmLabel: t('specimenList.ok'),
        cancelLabel: null,
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDeleteSelection = async () => {
    const count = selectedIds.size;
    const ok = await dialog.confirm({
      title: interpolate(t('specimenList.confirmDeleteN'), { n: count }),
      message: interpolate(t('specimenList.confirmDeleteNMsg'), { n: count }),
      variant: 'danger',
      confirmLabel: interpolate(t('specimenList.deleteNSpecimens'), { n: count }),
    });
    if (!ok) return;
    await executeBulkDelete({ ids: [...selectedIds] }, 'sélection manuelle');
  };

  const handleDeleteFiltered = async () => {
    const ok = await dialog.confirm({
      title: interpolate(t('specimenList.confirmDeleteFiltered'), { n: total }),
      message: interpolate(t('specimenList.confirmDeleteFilteredMsg'), { query: debounced, n: total }),
      variant: 'danger',
      confirmLabel: interpolate(t('specimenList.deleteNSpecimens'), { n: total }),
    });
    if (!ok) return;
    await executeBulkDelete({ filters: { search: debounced } }, `filtre "${debounced}"`);
  };

  const handleExport = async () => {
    setExporting(true);
    try { await exportBlob('/moustiques/export', {}, `moustiques_${exportDate()}.xlsx`); }
    finally { setExporting(false); }
  };

  // Colonne checkbox — seulement pour les admins, construite dynamiquement pour accéder à selectedIds
  const columns = useMemo(() => {
    if (!isAdmin) return BASE_COLUMNS;
    return [
      {
        key: '__chk',
        label: '',
        width: '44px',
        headerClassName: 'w-11',
        render: (m) => (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex justify-center items-center"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(m.id)}
              onChange={() => toggleId(m.id)}
              className="w-4 h-4 cursor-pointer accent-primary rounded"
            />
          </div>
        ),
      },
      ...BASE_COLUMNS,
    ];
  }, [selectedIds, isAdmin, BASE_COLUMNS]);

  const hasSelection = selectedIds.size > 0;
  const hasFilter    = debounced.length > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={() => <SpecimenIcon type="moustique" size={18} />}
        iconTone="specimen-moustique"
        title={t('dashboard.moustiques')}
        subtitle={interpolate(t('specimenList.total'), { n: total })}
        actions={
          <>
            <Button variant="secondary" icon={Download}
              onClick={handleExport} disabled={exporting}>
              {exporting ? t('specimenList.exporting') : t('specimenList.exportExcel')}
            </Button>
            <Button icon={Plus} onClick={() => navigate('/specimens/moustiques/nouveau')}>
              {t('specimenList.add')}
            </Button>
          </>
        }
      />

      {loading && !data ? (
        <Spinner.Block label={t('specimenList.loading')} />
      ) : total === 0 && !debounced ? (
        <EmptyState
          icon={() => <SpecimenIcon type="moustique" size={40} />}
          title={t('moustiquesPage.noneYet')}
          description={t('moustiquesPage.startHint')}
          action={{
            label: t('specimenList.addFirst'),
            icon: Plus,
            onClick: () => navigate('/specimens/moustiques/nouveau'),
          }}
        />
      ) : (
        <Card padding="none" className="overflow-hidden">

          {/* Barre de recherche + actions bulk */}
          <div className="px-4 py-3 border-b border-border space-y-2">

            {/* Ligne 1 : champ de recherche + compteur */}
            <div className="flex items-center gap-3">
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

            {/* Ligne 2 : actions bulk — visibles uniquement aux admins */}
            {isAdmin && (hasSelection || hasFilter) && (
              <div className="flex items-center gap-2 flex-wrap pt-0.5">

                {/* Sélection de la page */}
                {rows.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg transition-colors border border-border rounded-lg px-2.5 py-1.5"
                  >
                    {allOnPageSelected
                      ? <CheckSquare size={13} className="text-primary" />
                      : <Square size={13} />
                    }
                    {allOnPageSelected
                      ? t('specimenList.deselectPage')
                      : interpolate(t('specimenList.selectPageN'), { n: rows.length })
                    }
                  </button>
                )}

                {/* Compteur de sélection */}
                {hasSelection && (
                  <span className="text-xs font-medium text-fg-muted bg-surface-2 border border-border rounded-lg px-2.5 py-1.5">
                    {interpolate(t('specimenList.selectedCount'), { n: selectedIds.size })}
                  </span>
                )}

                {/* Supprimer la sélection */}
                {hasSelection && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    disabled={bulkDeleting}
                    onClick={handleDeleteSelection}
                  >
                    {bulkDeleting ? t('specimenList.deleting') : interpolate(t('specimenList.deleteSelection'), { n: selectedIds.size })}
                  </Button>
                )}

                {/* Séparateur visuel */}
                {hasSelection && hasFilter && (
                  <span className="text-border-strong text-lg leading-none select-none">|</span>
                )}

                {/* Supprimer tous les résultats filtrés */}
                {hasFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    disabled={bulkDeleting || total === 0}
                    onClick={handleDeleteFiltered}
                    className="text-danger hover:bg-danger/10 hover:text-danger"
                  >
                    {interpolate(t('specimenList.deleteFilteredResults'), { n: total })}
                  </Button>
                )}
              </div>
            )}

            {/* Hint sélection — visible aux admins quand rien n'est encore sélectionné et que des lignes sont présentes */}
            {isAdmin && !hasSelection && !hasFilter && rows.length > 0 && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-xs text-fg-subtle hover:text-fg-muted transition-colors"
                >
                  <Square size={12} />
                  {interpolate(t('specimenList.selectRowsHint'), { n: rows.length })}
                </button>
              </div>
            )}
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            skeletonRows={Math.min(limit, 10)}
            sort={sort}
            onSort={(key, dir) => setSort({ key, dir })}
            onRowClick={(m) => navigate(`/specimens/moustiques/${m.id}`)}
            minWidth="960px"
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
