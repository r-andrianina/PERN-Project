// Page générique pour les 4 référentiels plats :
// types-methode, solutions-conservation, types-environnement, types-habitat.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2, Search, ChevronLeft, X,
} from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import useAuthStore from '../../store/authStore';

const ROLES_HIERARCHY = { admin: 4, chercheur: 3, terrain: 2, lecteur: 1 };
const isMin = (userRole, min) => (ROLES_HIERARCHY[userRole] || 0) >= ROLES_HIERARCHY[min];

export default function ReferentielSimplePage({ config }) {
  const { endpoint, label, labelPluriel, fields, listColumns } = config;
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canEdit   = isMin(user?.role, 'chercheur');
  const canDelete = user?.role === 'admin';

  const [items, setItems]       = useState([]);
  const [filterSearch, setFs]   = useState('');
  const [filterActif, setFa]    = useState('all'); // all | actifs | inactifs
  const [isLoading, setLoading] = useState(true);
  const [editing, setEditing]   = useState(null); // { id?, ...fields }
  const [submitErr, setErr]     = useState(null);

  const refresh = async () => {
    setLoading(true);
    const params = {};
    if (filterSearch)            params.search = filterSearch;
    if (filterActif === 'actifs')   params.actif = 'true';
    if (filterActif === 'inactifs') params.actif = 'false';
    try {
      const r = await api.get(`/dictionnaire/${endpoint}`, { params });
      setItems(r.data.items);
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [filterSearch, filterActif]);

  const openCreate = () => {
    const blank = {};
    fields.forEach((f) => { blank[f.name] = ''; });
    setEditing(blank);
    setErr(null);
  };

  const openEdit = (item) => {
    const copy = {};
    fields.forEach((f) => { copy[f.name] = item[f.name] ?? ''; });
    copy.id = item.id;
    setEditing(copy);
    setErr(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      if (editing.id) {
        await api.put(`/dictionnaire/${endpoint}/${editing.id}`, editing);
      } else {
        await api.post(`/dictionnaire/${endpoint}`, editing);
      }
      setEditing(null);
      refresh();
    } catch (err) {
      setErr(err.response?.data?.error || 'Erreur');
    }
  };

  const toggleActif = async (item) => {
    const action = item.actif ? 'desactiver' : 'activer';
    try {
      await api.patch(`/dictionnaire/${endpoint}/${item.id}/${action}`);
      refresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur');
    }
  };

  const remove = async (item) => {
    if (!confirm(`Supprimer "${item.nom}" ?`)) return;
    try {
      await api.delete(`/dictionnaire/${endpoint}/${item.id}`);
      refresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div className="max-w-5xl space-y-5">
      <button onClick={() => navigate('/dictionnaire')} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700">
        <ChevronLeft size={16} /> Dictionnaire
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{labelPluriel}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{items.length} entrée(s)</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Nouveau
          </button>
        )}
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={filterSearch} onChange={(e) => setFs(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
        <select value={filterActif} onChange={(e) => setFa(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none">
          <option value="all">Tous</option>
          <option value="actifs">Actifs uniquement</option>
          <option value="inactifs">Inactifs uniquement</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          <Loader2 size={18} className="animate-spin mr-2" /> Chargement…
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center text-gray-400 text-sm">Aucune entrée</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
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
                <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  {listColumns.map((c) => (
                    <td key={c.key} className="px-4 py-2.5 text-gray-700">
                      {c.render ? c.render(item) : (item[c.key] || '—')}
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    {item.actif
                      ? <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-100">Actif</span>
                      : <span className="badge bg-gray-100 text-gray-500 border border-gray-200">Inactif</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <>
                          <button onClick={() => toggleActif(item)} title={item.actif ? 'Désactiver' : 'Activer'}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                            {item.actif ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                          <button onClick={() => openEdit(item)} title="Modifier"
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                            <Edit2 size={14} />
                          </button>
                        </>
                      )}
                      {canDelete && (
                        <button onClick={() => remove(item)} title="Supprimer"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800">
                {editing.id ? `Modifier ${label}` : `Nouveau ${label}`}
              </h2>
              <button type="button" onClick={() => setEditing(null)} className="p-1 text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            {submitErr && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{submitErr}</div>
            )}

            {fields.map((f) => (
              <FormField
                key={f.name}
                label={f.label} name={f.name} type={f.type || 'text'}
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
