import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Plus, Loader2, ChevronRight, Calendar, User } from 'lucide-react';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';

const STATUT = {
  planifiee: { label: 'Planifiée', cls: 'bg-blue-50 text-blue-700 border border-blue-100'        },
  en_cours:  { label: 'En cours',  cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  terminee:  { label: 'Terminée',  cls: 'bg-gray-100 text-gray-500 border border-gray-200'       },
  annulee:   { label: 'Annulée',   cls: 'bg-red-50 text-red-600 border border-red-100'          },
};

export default function MissionsPage() {
  const [missions, setMissions]   = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/missions')
      .then(r => setMissions(r.data.missions))
      .finally(() => setIsLoading(false));
  }, []);

  const canCreate = ['admin', 'chercheur'].includes(user?.role);

  return (
    <div className="max-w-5xl space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Missions</h1>
          <p className="text-xs text-gray-400 mt-0.5">{missions.length} mission(s) enregistrée(s)</p>
        </div>
        {canCreate && (
          <button onClick={() => navigate('/missions/nouvelle')} className="btn-primary">
            <Plus size={16} /> Nouvelle mission
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        </div>
      ) : missions.length === 0 ? (
        <div className="card p-16 text-center">
          <MapPin size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Aucune mission pour l'instant</p>
          {canCreate && (
            <button onClick={() => navigate('/missions/nouvelle')} className="btn-primary mt-4 mx-auto">
              <Plus size={15} /> Créer la première mission
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Table desktop */}
          <div className="card overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Ordre mission', 'Projet', 'Chef mission', 'Période', 'Localités', 'Statut', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {missions.map(m => {
                  const s = STATUT[m.statut] ?? {};
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-primary-50/40 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/missions/${m.id}`)}
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-primary-600 group-hover:text-primary-700">
                          {m.ordreMission}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{m.projet?.nom}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {m.chefMission ? `${m.chefMission.prenom} ${m.chefMission.nom}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">
                        {m.dateDebut ? new Date(m.dateDebut).toLocaleDateString('fr-FR') : '—'}
                        {m.dateFin && ` → ${new Date(m.dateFin).toLocaleDateString('fr-FR')}`}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{m._count?.localites ?? 0}</td>
                      <td className="px-5 py-3.5">
                        <span className={`badge ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-primary-400 transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="space-y-3 md:hidden">
            {missions.map(m => {
              const s = STATUT[m.statut] ?? {};
              return (
                <Link key={m.id} to={`/missions/${m.id}`}
                  className="card p-4 block hover:shadow-card-md transition-shadow group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-semibold text-primary-600 text-sm">{m.ordreMission}</span>
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{m.projet?.nom}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {m.chefMission && (
                      <span className="flex items-center gap-1">
                        <User size={11} /> {m.chefMission.prenom} {m.chefMission.nom}
                      </span>
                    )}
                    {m.dateDebut && (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> {new Date(m.dateDebut).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                    <span>{m._count?.localites ?? 0} loc.</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
