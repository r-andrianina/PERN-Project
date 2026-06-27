import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { History, ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, PageHeader, Spinner, Select, Pagination, DataTable } from '../../components/ui';

const ACTION_TONE = {
  CREATE:     'success',
  UPDATE:     'info',
  DELETE:     'danger',
  ACTIVATE:   'primary',
  DEACTIVATE: 'default',
  READ:       'default',
};

const ENTITIES = [
  '', 'Moustique', 'Tique', 'Puce', 'Localite', 'MethodeCollecte',
  'TaxonomieSpecimen', 'TaxonomieHote',
  'TypeMethodeCollecte', 'SolutionConservation', 'TypeEnvironnement', 'TypeHabitat',
];

export default function AuditLogsPage() {
  const [items,       setItems]   = useState([]);
  const [total,       setTotal]   = useState(0);
  const [loading,     setLoading] = useState(true);
  const [filterEntity, setFE]     = useState('');
  const [filterAction, setFA]     = useState('');
  const [expandedId,  setExpId]   = useState(null);
  const [page,        setPage]    = useState(1);
  const [limit,       setLimit]   = useState(50);

  const refresh = async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (filterEntity) params.entity = filterEntity;
      if (filterAction) params.action = filterAction;
      const r = await api.get('/dictionnaire/audit-logs', { params });
      setItems(r.data.items);
      setTotal(r.data.total);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    refresh();
    setPage(1);
    /* eslint-disable-next-line */
  }, [filterEntity, filterAction]);

  // Pagination côté client sur les items chargés
  const pageCount = Math.ceil(items.length / limit) || 1;
  const paged     = items.slice((page - 1) * limit, page * limit);

  // Colonnes — dépendent de expandedId pour l'icône de la 1re colonne
  const columns = useMemo(() => [
    {
      key: '_expand',
      label: '',
      width: '32px',
      className: 'text-fg-subtle pl-3',
      render: (it) => expandedId === it.id
        ? <ChevronDown size={14} />
        : <ChevronRight size={14} />,
    },
    {
      key: 'createdAt',
      label: 'Date',
      skeletonWidth: '80%',
      className: 'font-mono text-xs text-fg-muted whitespace-nowrap',
      render: (it) => new Date(it.createdAt).toLocaleString('fr-FR'),
    },
    {
      key: 'action',
      label: 'Action',
      skeletonWidth: '55%',
      render: (it) => (
        <Badge tone={ACTION_TONE[it.action] ?? 'default'}>{it.action}</Badge>
      ),
    },
    {
      key: 'entity',
      label: 'Entité',
      skeletonWidth: '65%',
      render: (it) => <span className="text-fg font-medium">{it.entity}</span>,
    },
    {
      key: 'entityId',
      label: 'ID',
      skeletonWidth: '35%',
      width: '64px',
      className: 'font-mono text-xs text-fg-subtle',
      render: (it) => `#${it.entityId}`,
    },
    {
      key: 'user',
      label: 'Utilisateur',
      skeletonWidth: '70%',
      hidden: 'hidden sm:table-cell',
      render: (it) => (
        <span className="text-fg-muted text-xs">
          {it.user ? `${it.user.prenom} ${it.user.nom}` : null}
        </span>
      ),
    },
  ], [expandedId]);

  const toggleExpand = (it) =>
    setExpId((prev) => (prev === it.id ? null : it.id));

  const renderExpanded = (it) => {
    if (expandedId !== it.id) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <p className="font-semibold text-fg-muted mb-1.5">Avant</p>
          <pre className="bg-surface p-2.5 rounded-xl border border-border overflow-auto text-[11px] text-fg-muted max-h-48">
            {it.oldValues ? JSON.stringify(it.oldValues, null, 2) : '—'}
          </pre>
        </div>
        <div>
          <p className="font-semibold text-fg-muted mb-1.5">Après</p>
          <pre className="bg-surface p-2.5 rounded-xl border border-border overflow-auto text-[11px] text-fg-muted max-h-48">
            {it.newValues ? JSON.stringify(it.newValues, null, 2) : '—'}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-screen-2xl space-y-5">
      <Link to="/dictionnaire" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ChevronLeft size={16} /> Dictionnaire
      </Link>

      <PageHeader
        icon={History} iconTone="default"
        title="Journal d'audit"
        subtitle={`${total} entrée(s) — référentiels et spécimens`}
      />

      {/* Filtres */}
      <Card padding="sm" className="flex flex-wrap gap-2">
        <Select
          value={filterEntity} onChange={setFE}
          wrapperClassName="w-56 flex-shrink-0"
          options={ENTITIES.map((e) => ({ value: e, label: e || 'Toutes les entités' }))}
        />
        <Select
          value={filterAction} onChange={setFA}
          wrapperClassName="w-48 flex-shrink-0"
          options={[
            { value: '', label: 'Toutes les actions' },
            ...Object.keys(ACTION_TONE).map((a) => ({ value: a, label: a })),
          ]}
        />
      </Card>

      {loading ? <Spinner.Block /> : items.length === 0 ? (
        <Card padding="lg" className="text-center text-fg-subtle text-sm">Aucune entrée</Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={paged}
            loading={false}
            density="compact"
            onRowClick={toggleExpand}
            rowClassName={(it) => expandedId === it.id ? 'bg-surface-2/40' : ''}
            renderExpanded={renderExpanded}
            minWidth="560px"
            maxHeight="calc(100vh - 290px)"
            empty={<span className="text-fg-subtle text-sm">Aucune entrée</span>}
          />

          <Pagination
            page={page} pages={pageCount} total={items.length} limit={limit}
            onChange={setPage}
            onLimitChange={(n) => { setLimit(n); setPage(1); }}
          />
        </Card>
      )}
    </div>
  );
}
