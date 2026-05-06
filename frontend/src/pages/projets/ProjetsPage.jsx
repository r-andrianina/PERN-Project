import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, ChevronRight, Loader2, Tag, Users } from 'lucide-react';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';

const STATUT = {
  actif:    { label: 'Actif',    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  termine:  { label: 'Terminé',  cls: 'bg-gray-100 text-gray-500 border border-gray-200'        },
  suspendu: { label: 'Suspendu', cls: 'bg-amber-50 text-amber-700 border border-amber-100'      },
};

export default function ProjetsPage() {
  const [projets, setProjets]     = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/projets')
      .then(r => setProjets(r.data.projets))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-4xl space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Projets</h1>
          <p className="text-xs text-gray-400 mt-0.5">{projets.length} projet(s) enregistré(s)</p>
        </div>
        {user?.role === 'admin' && (
          <button onClick={() => navigate('/projets/nouveau')} className="btn-primary">
            <Plus size={16} /> Nouveau projet
          </button>
        )}
      </div>

      {/* Contenu */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        </div>
      ) : projets.length === 0 ? (
        <div className="card p-16 text-center">
          <FolderOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Aucun projet pour l'instant</p>
          {user?.role === 'admin' && (
            <button onClick={() => navigate('/projets/nouveau')} className="btn-primary mt-4 mx-auto">
              <Plus size={15} /> Créer le premier projet
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {projets.map(p => {
            const s = STATUT[p.statut] ?? {};
            return (
              <Link
                key={p.id}
                to={`/projets/${p.id}`}
                className="card p-5 flex items-center justify-between hover:shadow-card-md transition-shadow group block"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <FolderOpen size={18} className="text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg border border-gray-200">
                        <Tag size={10} /> {p.code}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 truncate">{p.nom}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-gray-400">
                        {p._count?.missions ?? 0} mission(s)
                      </span>
                      {p.responsable && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Users size={11} />
                          {p.responsable.prenom} {p.responsable.nom}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
