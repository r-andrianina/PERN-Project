import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Beaker, Plus, Search, Loader2, X, MapPin } from 'lucide-react';
import api from '../../api/axios';

export default function MethodesPage() {
  const [methodes, setMethodes]   = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch]       = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/methodes')
      .then((r) => setMethodes(r.data.methodes || []))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = methodes.filter((m) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      m.typeMethode?.nom?.toLowerCase().includes(s) ||
      m.typeMethode?.code?.toLowerCase().includes(s) ||
      m.localite?.nom?.toLowerCase().includes(s) ||
      m.notes?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Beaker size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Méthodes de collecte</h1>
            <p className="text-xs text-gray-400">{methodes.length} méthode(s) enregistrée(s)</p>
          </div>
        </div>
        <button onClick={() => navigate('/methodes/nouvelle')} className="btn-primary">
          <Plus size={15} /> Nouvelle méthode
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        </div>
      ) : methodes.length === 0 ? (
        <div className="card p-16 text-center">
          <Beaker size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Aucune méthode enregistrée</p>
          <button onClick={() => navigate('/methodes/nouvelle')} className="btn-primary mt-4 mx-auto">
            <Plus size={15} /> Créer la première méthode
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 border border-gray-200 rounded-xl px-3.5 py-2 bg-gray-50 focus-within:bg-white focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="text" placeholder="Rechercher par méthode, localité ou note..."
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
            <table className="w-full text-sm min-w-[850px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['#ID', 'Méthode', 'Localité', 'Mission', 'Habitat', 'Environnement', 'Date', 'Spécimens'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((m) => {
                  const total = (m._count?.moustiques || 0) + (m._count?.tiques || 0) + (m._count?.puces || 0);
                  return (
                    <tr key={m.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">#{m.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {m.typeMethode?.code && (
                            <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{m.typeMethode.code}</span>
                          )}
                          <span className="text-gray-700 font-medium">{m.typeMethode?.nom || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs flex items-center gap-1">
                        <MapPin size={11} className="text-gray-400" />
                        {m.localite?.nom || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                        {m.localite?.mission?.ordreMission || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{m.typeHabitat?.nom || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{m.typeEnvironnement?.nom || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {m.dateCollecte ? new Date(m.dateCollecte).toLocaleDateString('fr-FR') : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {total}
                        </span>
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
