import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ChevronLeft, FolderOpen, MapPin, Tag, ChevronRight, Loader2 } from 'lucide-react';
import api from '../../api/axios';

const STATUT = {
  actif:    { label: 'Actif',    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  termine:  { label: 'Terminé',  cls: 'bg-gray-100 text-gray-500 border border-gray-200'        },
  suspendu: { label: 'Suspendu', cls: 'bg-amber-50 text-amber-700 border border-amber-100'      },
};

const MISSION_STATUT = {
  planifiee: { label: 'Planifiée', cls: 'bg-blue-50 text-blue-700 border border-blue-100'        },
  en_cours:  { label: 'En cours',  cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  terminee:  { label: 'Terminée',  cls: 'bg-gray-100 text-gray-500 border border-gray-200'       },
  annulee:   { label: 'Annulée',   cls: 'bg-red-50 text-red-600 border border-red-100'          },
};

export default function ProjetDetail() {
  const { id } = useParams();
  const [projet, setProjet] = useState(null);

  useEffect(() => {
    api.get(`/projets/${id}`).then(r => setProjet(r.data.projet));
  }, [id]);

  if (!projet) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 size={18} className="animate-spin" /> Chargement...
        </div>
      </div>
    );
  }

  const s = STATUT[projet.statut] ?? {};

  return (
    <div className="max-w-3xl space-y-5">

      {/* Breadcrumb */}
      <Link to="/projets" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
        <ChevronLeft size={16} /> Projets
      </Link>

      {/* Carte principale */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <FolderOpen size={20} className="text-primary-600" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1 text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg border border-gray-200">
                  <Tag size={10} /> {projet.code}
                </span>
                <span className={`badge ${s.cls}`}>{s.label}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-800">{projet.nom}</h1>
            </div>
          </div>
        </div>

        {projet.description && (
          <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            {projet.description}
          </p>
        )}

        {(projet.dateDebut || projet.responsable) && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            {projet.dateDebut && (
              <div className="text-xs">
                <p className="text-gray-400 font-medium mb-0.5">Période</p>
                <p className="text-gray-700">
                  {new Date(projet.dateDebut).toLocaleDateString('fr-FR')}
                  {projet.dateFin && ` → ${new Date(projet.dateFin).toLocaleDateString('fr-FR')}`}
                </p>
              </div>
            )}
            {projet.responsable && (
              <div className="text-xs">
                <p className="text-gray-400 font-medium mb-0.5">Responsable</p>
                <p className="text-gray-700">{projet.responsable.prenom} {projet.responsable.nom}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Missions */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <MapPin size={16} className="text-primary-500" />
          <h2 className="text-sm font-semibold text-gray-700">
            Missions
            <span className="ml-2 text-xs font-normal text-gray-400">({projet.missions?.length ?? 0})</span>
          </h2>
        </div>

        {projet.missions?.length === 0 ? (
          <div className="py-10 text-center">
            <MapPin size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucune mission associée</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {projet.missions?.map(m => {
              const ms = MISSION_STATUT[m.statut] ?? {};
              return (
                <Link
                  key={m.id}
                  to={`/missions/${m.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-700 group-hover:text-primary-600 transition-colors">
                      {m.ordreMission}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {m._count?.localites ?? 0} localité(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${ms.cls}`}>{ms.label}</span>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-primary-400 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
