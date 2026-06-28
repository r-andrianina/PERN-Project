import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Search, ChevronLeft, X } from 'lucide-react';
import api from '../../api/axios';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';
import FormField from '../../components/FormField';
import useAuthStore from '../../store/authStore';
import { Card, Badge, Button, PageHeader, Spinner, DataTable, Pagination, Select } from '../../components/ui';

const ROLES = { admin: 4, chercheur: 3, terrain: 2, lecteur: 1 };
const isMin = (r, m) => (ROLES[r] || 0) >= ROLES[m];

export default function ReferentielSimplePage({ config }) {
  const { endpoint, label, labelPluriel, fields, listColumns } = config;
  const { user } = useAuthStore();
  const canEdit   = isMin(user?.role, 'chercheur');
  const canDelete = user?.role === 'admin';

  const [items,       setItems]   = useState([]);
  const [filterSearch, setFs]     = useState('');
  const [filterActif,  setFa]     = useState('all');
  const [isLoading,   setLoading] = useState(true);
  const [editing,     setEditing] = useState(null);
  const [submitErr,   setErr]     = useState(null);
  const [page,        setPage]    = useState(1);
  const [limit,       setLimit]   = useState(25);

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (filterSearch)               params.search = filterSearch;
    if (filterActif === 'actifs')   params.actif  = 'true';
    if (filterActif === 'inactifs') params.actif  = 'false';
    try {
      const r = await api.get(`/dictionnaire/${endpoint}`, { params });
      setItems(r.data.items);
    } finally { setLoading(false); }
  }, [endpoint, filterSearch, filterActif]);

  useEffect(() => { refresh(); setPage(1); }, [refresh]);

  const openCreate = useCallback(() => {
    const blank = {};
    fields.forEach((f) => { blank[f.name] = ''; });
    setEditing(blank); setErr(null);
  }, [fields]);

  const openEdit = useCallback((item) => {
    const copy = {};
    fields.forEach((f) => { copy[f.name] = item[f.name] ?? ''; });
    copy.id = item.id; setEditing(copy); setErr(null);
  }, [fields]);

  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    try {
      if (editing.id) await api.put(`/dictionnaire/${endpoint}/${editing.id}`, editing);
      else            await api.post(`/dictionnaire/${endpoint}`, editing);
      setEditing(null); refresh();
    } catch (err) { setErr(err.response?.data?.error || 'Erreur'); }
  };

  const toggleActif = useCallback(async (item) => {
    try {
      await api.patch(`/dictionnaire/${endpoint}/${item.id}/${item.actif ? 'desactiver' : 'activer'}`);
      refresh();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  }, [endpoint, refresh]);

  const remove = useCallback(async (item) => {
    const ok = await dialog.confirm({
      title: `Supprimer « ${item.nom} » ?`,
      message: 'Cette entrée sera définitivement supprimée du référentiel.',
    });
    if (!ok) return;
    try { await api.delete(`/dictionnaire/${endpoint}/${item.id}`); refresh(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  }, [endpoint, refresh]);

  // Pagination côté client sur les items déjà filtrés par l'API
  const pageCount = Math.ceil(items.length / limit) || 1;
  const paged     = items.slice((page - 1) * limit, page * limit);

  // Colonnes : mapping depuis config.listColumns + Status + Actions
  const columns = [
    ...listColumns.map((c) => ({
      key:          c.key,
      label:        c.header,
      skeletonWidth: '70%',
      render:       c.render || undefined,
    })),
    {
      key:          '_statut',
      label:        'Statut',
      width:        '90px',
      skeletonWidth: '50%',
      render: (item) => (
        <Badge tone={item.actif ? 'success' : 'default'} dot>
          {item.actif ? 'Actif' : 'Inactif'}
        </Badge>
      ),
    },
    {
      key:            '_actions',
      label:          '',
      width:          '88px',
      headerClassName: 'text-right',
      className:      'text-right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <>
              <button
                onClick={() => toggleActif(item)}
                title={item.actif ? 'Désactiver' : 'Activer'}
                className="p-1.5 text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                {item.actif ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              </button>
              <button
                onClick={() => openEdit(item)}
                title="Modifier"
                className="p-1.5 text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <Edit2 size={14} />
              </button>
            </>
          )}
          {canDelete && (
            <button
              onClick={() => remove(item)}
              title="Supprimer"
              className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-screen-2xl space-y-5">
      <Link to="/dictionnaire" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ChevronLeft size={16} /> Dictionnaire
      </Link>

      <PageHeader
        title={labelPluriel}
        subtitle={`${items.length} entrée(s)`}
        actions={canEdit && <Button icon={Plus} onClick={openCreate}>Nouveau</Button>}
      />

      {/* Filtres */}
      <Card padding="sm" className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            value={filterSearch}
            onChange={(e) => setFs(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border-strong bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {filterSearch && (
            <button onClick={() => setFs('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg">
              <X size={13} />
            </button>
          )}
        </div>
        <Select
          value={filterActif} onChange={setFa}
          wrapperClassName="w-48 flex-shrink-0"
          options={[
            { value: 'all',      label: 'Tous' },
            { value: 'actifs',   label: 'Actifs uniquement' },
            { value: 'inactifs', label: 'Inactifs uniquement' },
          ]}
        />
      </Card>

      {/* Table */}
      {isLoading && items.length === 0 ? (
        <Spinner.Block />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={paged}
            loading={isLoading}
            skeletonRows={8}
            minWidth="480px"
            maxHeight="calc(100vh - 290px)"
            empty={
              <span className="text-fg-subtle text-sm">
                {filterSearch || filterActif !== 'all'
                  ? 'Aucun résultat pour ces filtres'
                  : 'Aucune entrée dans ce référentiel'}
              </span>
            }
          />
          {items.length > 0 && (
            <Pagination
              page={page} pages={pageCount} total={items.length} limit={limit}
              onChange={setPage}
              onLimitChange={(n) => { setLimit(n); setPage(1); }}
            />
          )}
        </Card>
      )}

      {/* Modal création / édition */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <form onSubmit={submit} className="bg-surface rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-4 sm:mt-16">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-fg">
                {editing.id ? `Modifier ${label}` : `Nouveau ${label}`}
              </h2>
              <button type="button" onClick={() => setEditing(null)} className="p-1 text-fg-subtle hover:text-fg">
                <X size={18} />
              </button>
            </div>
            {submitErr && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs text-danger">{submitErr}</div>
            )}
            {fields.map((f) => (
              <FormField
                key={f.name} label={f.label} name={f.name} type={f.type || 'text'}
                value={editing[f.name] ?? ''}
                onChange={(e) => setEditing({ ...editing, [f.name]: e.target.value })}
                placeholder={f.placeholder} required={f.required} hint={f.hint}
              />
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Annuler</button>
              <button type="submit" className="btn-primary">{editing.id ? 'Enregistrer' : 'Créer'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
