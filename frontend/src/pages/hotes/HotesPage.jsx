import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PawPrint, Plus, Search, Loader2, X, MapPin, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';

const ROLES = { admin: 4, chercheur: 3, terrain: 2, lecteur: 1 };
const isMin = (r, m) => (ROLES[r] || 0) >= ROLES[m];

const SEXE_BADGE = {
  M:       'bg-blue-50 text-blue-700 border-blue-100',
  F:       'bg-pink-50 text-pink-700 border-pink-100',
  inconnu: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function HotesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canDelete = isMin(user?.role, 'chercheur');

  const [hotes, setHotes]       = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [search, setSearch]     = useState('');

  const refresh = () => {
    setLoading(true);
    api.get('/hotes')
      .then((r) => setHotes(r.data.hotes || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);

  const taxoLabel = (t) => t ? `${t.parent?.nom ? t.parent.nom + ' ' : ''}${t.nom}` : '';

  const filtered = hotes.filter((h) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      taxoLabel(h.taxonomieHote).toLowerCase().includes(s) ||
      h.especeLocale?.toLowerCase().includes(s) ||
      h.methode?.localite?.nom?.toLowerCase().includes(s)
    );
  });

  const remove = async (h) => {
    if (!confirm(`Supprimer l'hôte #${h.id} ?`)) return;
    try {
      await api.delete(`/hotes/${h.id}`);
      refresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <PawPrint size={18} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Hôtes</h1>
            <p className="text-xs text-gray-400">{hotes.length} hôte(s) enregistré(s)</p>
          </div>
        </div>
        <button onClick={() => navigate('/hotes/nouveau')} className="btn-primary">
          <Plus size={15} /> Nouvel hôte
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        </div>
      ) : hotes.length === 0 ? (
        <div className="card p-16 text-center">
          <PawPrint size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Aucun hôte enregistré</p>
          <button onClick={() => navigate('/hotes/nouveau')} className="btn-primary mt-4 mx-auto">
            <Plus size={15} /> Enregistrer le premier hôte
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 border border-gray-200 rounded-xl px-3.5 py-2 bg-gray-50 focus-within:bg-white focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="text" placeholder="Rechercher par espèce ou localité..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent border-none outline-none text-gray-700 placeholder-gray-400"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap font-medium">
              {filtered.length} résultat(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['#ID', 'Espèce (référentiel)', 'Espèce locale', 'Sexe', 'Âge', 'État', 'Localité', 'Spécimens', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((h) => {
                  const total = (h._count?.tiques || 0) + (h._count?.puces || 0);
                  return (
                    <tr key={h.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">#{h.id}</td>
                      <td className="px-4 py-3 italic text-gray-700">
                        {taxoLabel(h.taxonomieHote) || '—'}
                        {h.taxonomieHote?.nomCommun && (
                          <span className="not-italic text-gray-400 text-xs ml-1">({h.taxonomieHote.nomCommun})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{h.especeLocale || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs border ${SEXE_BADGE[h.sexe] || SEXE_BADGE.inconnu}`}>
                          {h.sexe === 'M' ? 'Mâle' : h.sexe === 'F' ? 'Femelle' : 'Inconnu'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{h.age || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{h.etatSante || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs flex items-center gap-1">
                        <MapPin size={11} className="text-gray-400" />
                        {h.methode?.localite?.nom || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-100">{total}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canDelete && (
                          <button onClick={() => remove(h)} title="Supprimer"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
