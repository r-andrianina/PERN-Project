import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bug, Plus, Download, Search, Loader2, X } from 'lucide-react';
import api from '../../api/axios';

export default function TiquesPage() {
  const [tiques, setTiques]       = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch]       = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/tiques')
      .then(r => setTiques(r.data.tiques || []))
      .finally(() => setIsLoading(false));
  }, []);

  const taxoLabel = (t) => t ? `${t.parent?.nom ? t.parent.nom + ' ' : ''}${t.nom}` : '';

  const filtered = tiques.filter(t =>
    !search ||
    taxoLabel(t.taxonomie).toLowerCase().includes(search.toLowerCase()) ||
    t.methode?.localite?.nom?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
            <Bug size={18} className="text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Tiques</h1>
            <p className="text-xs text-gray-400">{tiques.length} spécimen(s) au total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open('http://localhost:3000/api/v1/tiques/export', '_blank')}
            className="btn-secondary"
          >
            <Download size={15} /> Export
          </button>
          <button
            onClick={() => navigate('/specimens/tiques/nouveau')}
            className="btn-primary"
          >
            <Plus size={15} /> Ajouter
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        </div>
      ) : tiques.length === 0 ? (
        <div className="card p-16 text-center">
          <Bug size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Aucune tique enregistrée</p>
          <button onClick={() => navigate('/specimens/tiques/nouveau')} className="btn-primary mt-4 mx-auto">
            <Plus size={15} /> Ajouter le premier spécimen
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 border border-gray-200 rounded-xl px-3.5 py-2 bg-gray-50 focus-within:bg-white focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="text" placeholder="Rechercher par espèce ou localité..."
                value={search} onChange={e => setSearch(e.target.value)}
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
            <table className="w-full text-sm min-w-[750px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['ID terrain', '#ID', 'Espèce', 'Nb', 'Sexe', 'Stade', 'Gorgée', 'Hôte', 'Position', 'Localité', 'Date collecte'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(t => (
                  <tr
                    key={t.id}
                    className="hover:bg-rose-50/30 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/specimens/tiques/${t.id}`)}
                  >
                    <td className="px-4 py-3">
                      {t.idTerrain
                        ? <span className="font-mono text-xs font-bold bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded">{t.idTerrain}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">#{t.id}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700 italic">{taxoLabel(t.taxonomie) || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600 font-medium">{t.nombre}</td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${
                        t.sexe === 'M' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        t.sexe === 'F' ? 'bg-pink-50 text-pink-700 border border-pink-100' :
                        'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}>
                        {t.sexe === 'M' ? 'Mâle' : t.sexe === 'F' ? 'Femelle' : 'Inconnu'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.stade || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${t.gorge ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                        {t.gorge ? 'Oui' : 'Non'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.hote?.taxonomieHote?.nom || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      {t.position
                        ? <span className="font-mono text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg">
                            {t.container?.code ? `${t.container.code} ${t.position}` : t.position}
                          </span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-28 truncate">
                      {t.methode?.localite?.nom || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {t.dateCollecte ? new Date(t.dateCollecte).toLocaleDateString('fr-FR') : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
