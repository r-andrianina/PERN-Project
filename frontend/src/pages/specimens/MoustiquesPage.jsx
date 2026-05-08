import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bug, Plus, Download, Search, Loader2, X } from 'lucide-react';
import api from '../../api/axios';

export default function MoustiquesPage() {
  const [moustiques, setMoustiques] = useState([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [search, setSearch]         = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/moustiques')
      .then(r => setMoustiques(r.data.moustiques || []))
      .finally(() => setIsLoading(false));
  }, []);

  const taxoLabel = (t) => t ? `${t.parent?.nom ? t.parent.nom + ' ' : ''}${t.nom}` : '';

  const filtered = moustiques.filter(m =>
    !search ||
    taxoLabel(m.taxonomie).toLowerCase().includes(search.toLowerCase()) ||
    m.methode?.localite?.nom?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Bug size={18} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Moustiques</h1>
            <p className="text-xs text-gray-400">{moustiques.length} spécimen(s) au total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open('http://localhost:3000/api/v1/moustiques/export', '_blank')}
            className="btn-secondary"
          >
            <Download size={15} /> Export
          </button>
          <button
            onClick={() => navigate('/specimens/moustiques/nouveau')}
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
      ) : moustiques.length === 0 ? (
        <div className="card p-16 text-center">
          <Bug size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Aucun moustique enregistré</p>
          <button onClick={() => navigate('/specimens/moustiques/nouveau')} className="btn-primary mt-4 mx-auto">
            <Plus size={15} /> Ajouter le premier spécimen
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Barre recherche */}
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

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['ID terrain', '#ID', 'Espèce', 'Nb', 'Sexe', 'Stade', 'Parité', 'Repas sang', 'Localité', 'Date collecte'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(m => (
                  <tr
                    key={m.id}
                    className="hover:bg-primary-50/40 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/specimens/moustiques/${m.id}`)}
                  >
                    <td className="px-4 py-3">
                      {m.idTerrain
                        ? <span className="font-mono text-xs font-bold bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded">{m.idTerrain}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">#{m.id}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700 italic">
                      {taxoLabel(m.taxonomie) || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-medium">{m.nombre}</td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${
                        m.sexe === 'M' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        m.sexe === 'F' ? 'bg-pink-50 text-pink-700 border border-pink-100' :
                        'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}>
                        {m.sexe === 'M' ? 'Mâle' : m.sexe === 'F' ? 'Femelle' : 'Inconnu'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.stade || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.parite || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${m.repasSang ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                        {m.repasSang ? 'Oui' : 'Non'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-32 truncate">
                      {m.methode?.localite?.nom || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {m.dateCollecte ? new Date(m.dateCollecte).toLocaleDateString('fr-FR') : <span className="text-gray-300">—</span>}
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
