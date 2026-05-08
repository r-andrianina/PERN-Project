// Page générique pour les 4 référentiels plats (types-methode, solutions, etc.)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Search, ChevronLeft, X } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import useAuthStore from '../../store/authStore';
import { Card, Badge, Button, EmptyState, PageHeader, Spinner } from '../../components/ui';

const ROLES = { admin: 4, chercheur: 3, terrain: 2, lecteur: 1 };
const isMin = (r, m) => (ROLES[r] || 0) >= ROLES[m];

export default function ReferentielSimplePage({ config }) {
  const { endpoint, label, labelPluriel, fields, listColumns } = config;
  const { user } = useAuthStore();
  const canEdit   = isMin(user?.role, 'chercheur');
  const canDelete = user?.role === 'admin';

  const [items, setItems]     = useState([]);
  const [filterSearch, setFs] = useState('');
  const [filterActif, setFa]  = useState('all');
  const [isLoading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [submitErr, setErr]   = useState(null);

  const refresh = async () => {
    setLoading(true);
    const params = {};
    if (filterSearch)             params.search = filterSearch;
    if (filterActif === 'actifs') params.actif  = 'true';
    if (filterActif === 'inactifs') params.actif = 'false';
    try { const r = await api.get(`/dictionnaire/${endpoint}`, { params }); setItems(r.data.items); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [filterSearch, filterActif]);

  const openCreate = () => {
    const blank = {};
    fields.forEach((f) => { blank[f.name] = ''; });
    setEditing(blank); setErr(null);
  };
  const openEdit = (item) => {
    const copy = {};
    fields.forEach((f) => { copy[f.name] = item[f.name] ?? ''; });
    copy.id = item.id; setEditing(copy); setErr(null);
  };
  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    try {
      if (editing.id) await api.put(`/dictionnaire/${endpoint}/${editing.id}`, editing);
      else await api.post(`/dictionnaire/${endpoint}`, editing);
      setEditing(null); refresh();
    } catch (err) { setErr(err.response?.data?.error || 'Erreur'); }
  };
  const toggleActif = async (item) => {
    try { await api.patch(`/dictionnaire/${endpoint}/${item.id}/${item.actif ? 'desactiver' : 'activer'}`); refresh(); }
    catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };
  const remove = async (item) => {
    if (!confirm(`Supprimer "${item.nom}" ?`)) return;
    try { await api.delete(`/dictionnaire/${endpoint}/${item.id}`); refresh(); }
    catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  return (
    <div className="max-w-5xl space-y-5">
      <Link to="/dictionnaire" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ChevronLeft size={16} /> Dictionnaire
      </Link>

      <PageHeader
        title={labelPluriel} subtitle={`${items.length} entrée(s)`}
        actions={canEdit && <Button icon={Plus} onClick={openCreate}>Nouveau</Button>}
      />

      <Card padding="sm" className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input value={filterSearch} onChange={(e) => setFs(e.target.value)} placeholder="Rechercher…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border-strong bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <select value={filterActif} onChange={(e) => setFa(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl border border-border-strong bg-surface text-fg focus:outline-none">
          <option value="all">Tous</option>
          <option value="actifs">Actifs uniquement</option>
          <option value="inactifs">Inactifs uniquement</option>
        </select>
      </Card>

      {isLoading ? <Spinner.Block /> : items.length === 0 ? (
        <EmptyState title="Aucune entrée" />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 border-b border-border text-xs text-fg-muted uppercase tracking-wider">
              <tr>
                {listColumns.map((c) => (
                  <th key={c.key} className="px-4 py-2 text-left font-semibold">{c.header}</th>
                ))}
                <th className="px-4 py-2 text-left font-semibold">Statut</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border hover:bg-surface-2/50 transition-colors">
                  {listColumns.map((c) => (
                    <td key={c.key} className="px-4 py-2.5 text-fg">
                      {c.render ? c.render(item) : (item[c.key] || '—')}
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    <Badge tone={item.actif ? 'success' : 'default'} dot>{item.actif ? 'Actif' : 'Inactif'}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <>
                          <button onClick={() => toggleActif(item)} title={item.actif ? 'Désactiver' : 'Activer'}
                            className="p-1.5 text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                            {item.actif ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                          <button onClick={() => openEdit(item)} title="Modifier"
                            className="p-1.5 text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                            <Edit2 size={14} />
                          </button>
                        </>
                      )}
                      {canDelete && (
                        <button onClick={() => remove(item)} title="Supprimer"
                          className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-surface rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-fg">{editing.id ? `Modifier ${label}` : `Nouveau ${label}`}</h2>
              <button type="button" onClick={() => setEditing(null)} className="p-1 text-fg-subtle hover:text-fg">
                <X size={18} />
              </button>
            </div>
            {submitErr && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs text-danger">{submitErr}</div>}
            {fields.map((f) => (
              <FormField key={f.name} label={f.label} name={f.name} type={f.type || 'text'}
                value={editing[f.name] ?? ''} onChange={(e) => setEditing({ ...editing, [f.name]: e.target.value })}
                placeholder={f.placeholder} required={f.required} hint={f.hint} />
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
