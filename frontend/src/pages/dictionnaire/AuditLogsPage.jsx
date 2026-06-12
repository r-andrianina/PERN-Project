import { useEffect, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { History, ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, PageHeader, Spinner, Select } from '../../components/ui';

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
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFE] = useState('');
  const [filterAction, setFA] = useState('');
  const [expandedId, setExpId] = useState(null);

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
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [filterEntity, filterAction]);

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

      <Card padding="sm" className="flex flex-wrap gap-2">
        <Select
          value={filterEntity}
          onChange={setFE}
          wrapperClassName="w-56 flex-shrink-0"
          options={ENTITIES.map((e) => ({ value: e, label: e || 'Toutes les entités' }))}
        />
        <Select
          value={filterAction}
          onChange={setFA}
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
          <table className="w-full text-sm">
            <thead className="bg-surface-2 border-b border-border text-xs text-fg-muted uppercase tracking-wider">
              <tr>
                <th className="w-8 px-2"></th>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">Action</th>
                <th className="px-3 py-2 text-left font-semibold">Entité</th>
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Utilisateur</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <Fragment key={it.id}>
                  <tr className="border-t border-border hover:bg-surface-2 cursor-pointer transition-colors"
                    onClick={() => setExpId(expandedId === it.id ? null : it.id)}>
                    <td className="pl-3 text-fg-subtle">
                      {expandedId === it.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-3 py-2 text-fg-muted font-mono text-xs">
                      {new Date(it.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={ACTION_TONE[it.action] ?? 'default'}>{it.action}</Badge>
                    </td>
                    <td className="px-3 py-2 text-fg font-medium">{it.entity}</td>
                    <td className="px-3 py-2 text-fg-subtle font-mono text-xs">#{it.entityId}</td>
                    <td className="px-3 py-2 text-fg-muted text-xs">
                      {it.user ? `${it.user.prenom} ${it.user.nom}` : '—'}
                    </td>
                  </tr>
                  {expandedId === it.id && (
                    <tr className="bg-surface-2/50">
                      <td></td>
                      <td colSpan={5} className="px-3 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="font-semibold text-fg-muted mb-1">Avant</p>
                            <pre className="bg-surface p-2 rounded-lg border border-border overflow-auto text-[11px] text-fg-muted">
                              {it.oldValues ? JSON.stringify(it.oldValues, null, 2) : '—'}
                            </pre>
                          </div>
                          <div>
                            <p className="font-semibold text-fg-muted mb-1">Après</p>
                            <pre className="bg-surface p-2 rounded-lg border border-border overflow-auto text-[11px] text-fg-muted">
                              {it.newValues ? JSON.stringify(it.newValues, null, 2) : '—'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
