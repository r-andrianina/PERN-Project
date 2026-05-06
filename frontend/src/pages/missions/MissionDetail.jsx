import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ChevronLeft, MapPin, ChevronRight, Loader2, Navigation, Hash } from 'lucide-react';
import api from '../../api/axios';

const STATUT = {
  planifiee: { label: 'Planifiée', cls: 'bg-blue-50 text-blue-700 border border-blue-100'        },
  en_cours:  { label: 'En cours',  cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  terminee:  { label: 'Terminée',  cls: 'bg-gray-100 text-gray-500 border border-gray-200'       },
  annulee:   { label: 'Annulée',   cls: 'bg-red-50 text-red-600 border border-red-100'          },
};

export default function MissionDetail() {
  const { id } = useParams();
  const [mission, setMission] = useState(null);

  useEffect(() => {
    api.get(`/missions/${id}`).then(r => setMission(r.data.mission));
  }, [id]);

  if (!mission) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 size={18} className="animate-spin" /> Chargement...
        </div>
      </div>
    );
  }

  const s = STATUT[mission.statut] ?? {};

  return (
    <div className="max-w-3xl space-y-5">

      <Link to="/missions" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
        <ChevronLeft size={16} /> Missions
      </Link>

      {/* Carte mission */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <MapPin size={20} className="text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg border border-gray-200">
                  <Hash size={10} /> {mission.ordreMission}
                </span>
                <span className={`badge ${s.cls}`}>{s.label}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-800">{mission.ordreMission}</h1>
              <p className="text-sm text-gray-400 mt-0.5">{mission.projet?.nom}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {mission.chefMission && (
            <div className="text-xs">
              <p className="text-gray-400 font-medium mb-0.5">Chef de mission</p>
              <p className="text-gray-700">{mission.chefMission.prenom} {mission.chefMission.nom}</p>
            </div>
          )}
          {mission.dateDebut && (
            <div className="text-xs">
              <p className="text-gray-400 font-medium mb-0.5">Période</p>
              <p className="text-gray-700">
                {new Date(mission.dateDebut).toLocaleDateString('fr-FR')}
                {mission.dateFin && ` → ${new Date(mission.dateFin).toLocaleDateString('fr-FR')}`}
              </p>
            </div>
          )}
          {mission.agents?.length > 0 && (
            <div className="text-xs">
              <p className="text-gray-400 font-medium mb-0.5">Agents terrain</p>
              <p className="text-gray-700">{mission.agents.length} agent(s)</p>
            </div>
          )}
        </div>

        {mission.observations && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-xs font-semibold text-amber-700 mb-1">Observations</p>
            <p className="text-sm text-amber-800">{mission.observations}</p>
          </div>
        )}
      </div>

      {/* Localités */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Navigation size={16} className="text-primary-500" />
          <h2 className="text-sm font-semibold text-gray-700">
            Localités
            <span className="ml-2 text-xs font-normal text-gray-400">({mission.localites?.length ?? 0})</span>
          </h2>
        </div>

        {mission.localites?.length === 0 ? (
          <div className="py-10 text-center">
            <Navigation size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucune localité enregistrée</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {mission.localites?.map(l => (
              <div key={l.id} className="px-5 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{l.nom}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[l.fokontany, l.commune, l.district, l.region].filter(Boolean).join(', ')}
                    </p>
                    {(l.latitude && l.longitude) && (
                      <p className="text-xs font-mono text-gray-400 mt-1">
                        {parseFloat(l.latitude).toFixed(4)}, {parseFloat(l.longitude).toFixed(4)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                    {l.methodes?.length ?? 0} méthode(s)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
