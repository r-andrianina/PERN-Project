import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderOpen, MapPin, Microscope, Bug,
  TrendingUp, Loader2, ChevronRight, Calendar,
} from 'lucide-react';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';

const STATUT_STYLE = {
  planifiee: { label: 'Planifiée', cls: 'bg-blue-50 text-blue-700 border border-blue-100'   },
  en_cours:  { label: 'En cours',  cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  terminee:  { label: 'Terminée',  cls: 'bg-gray-100 text-gray-500 border border-gray-200'  },
  annulee:   { label: 'Annulée',   cls: 'bg-red-50 text-red-600 border border-red-100'      },
};

function StatCard({ label, value, icon: Icon, iconColor, bgColor, to, trend }) {
  return (
    <Link to={to} className="card p-5 hover:shadow-card-md transition-shadow group block">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center`}>
          <Icon size={20} className={iconColor} />
        </div>
        <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 transition-colors mt-1" />
      </div>
      <div className="text-2xl font-bold text-gray-800 tabular-nums">{value ?? '—'}</div>
      <div className="text-xs text-gray-500 mt-1 font-medium">{label}</div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          <TrendingUp size={11} className="text-primary-500" />
          <span className="text-xs text-primary-600 font-medium">+{trend} ce mois</span>
        </div>
      )}
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats]         = useState(null);
  const [missions, setMissions]   = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, misRes, mouRes, tiqRes, pucRes] = await Promise.all([
          api.get('/projets'),
          api.get('/missions'),
          api.get('/moustiques'),
          api.get('/tiques'),
          api.get('/puces'),
        ]);
        setStats({
          projets:    projRes.data.total,
          missions:   misRes.data.total,
          moustiques: mouRes.data.total,
          tiques:     tiqRes.data.total,
          puces:      pucRes.data.total,
          specimens:  mouRes.data.total + tiqRes.data.total + pucRes.data.total,
        });
        setMissions(misRes.data.missions.slice(0, 6));
      } catch (err) {
        console.error('Erreur dashboard :', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 size={18} className="animate-spin" />
          Chargement...
        </div>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-6 max-w-6xl">

      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {greeting}, {user?.prenom}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Aperçu de vos données de collecte entomologique
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-card">
          <Calendar size={13} />
          {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Projets" value={stats?.projets}
          icon={FolderOpen} iconColor="text-primary-600" bgColor="bg-primary-50"
          to="/projets"
        />
        <StatCard
          label="Missions" value={stats?.missions}
          icon={MapPin} iconColor="text-blue-600" bgColor="bg-blue-50"
          to="/missions"
        />
        <StatCard
          label="Spécimens total" value={stats?.specimens}
          icon={Microscope} iconColor="text-purple-600" bgColor="bg-purple-50"
          to="/specimens/moustiques"
        />
        <StatCard
          label="Moustiques" value={stats?.moustiques}
          icon={Bug} iconColor="text-emerald-600" bgColor="bg-emerald-50"
          to="/specimens/moustiques"
        />
      </div>

      {/* Stats spécimens + Rôle */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Tiques" value={stats?.tiques}
          icon={Bug} iconColor="text-rose-600" bgColor="bg-rose-50"
          to="/specimens/tiques"
        />
        <StatCard
          label="Puces" value={stats?.puces}
          icon={Bug} iconColor="text-amber-600" bgColor="bg-amber-50"
          to="/specimens/puces"
        />
        {/* Carte profil */}
        <div className="card p-5 bg-gradient-to-br from-primary-600 to-primary-700 border-0">
          <p className="text-xs text-primary-200 font-medium uppercase tracking-wider mb-1">Mon profil</p>
          <p className="text-lg font-bold text-white capitalize">{user?.role}</p>
          <p className="text-xs text-primary-200 mt-1 truncate">{user?.email}</p>
          <div className="mt-3 pt-3 border-t border-primary-500/40">
            <p className="text-xs text-primary-200">{user?.prenom} {user?.nom}</p>
          </div>
        </div>
      </div>

      {/* Missions récentes */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-primary-500" />
            <h2 className="text-sm font-semibold text-gray-700">Missions récentes</h2>
          </div>
          <Link to="/missions" className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
            Voir tout <ChevronRight size={13} />
          </Link>
        </div>

        {missions.length === 0 ? (
          <div className="py-12 text-center">
            <MapPin size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucune mission pour l'instant</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {missions.map((m) => {
              const s = STATUT_STYLE[m.statut] ?? {};
              return (
                <Link
                  key={m.id}
                  to={`/missions/${m.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 group-hover:text-primary-600 transition-colors truncate">
                      {m.ordreMission}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{m.projet?.nom}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-xs text-gray-400 hidden sm:block">
                      {m._count?.localites ?? 0} loc.
                    </span>
                    <span className={`badge ${s.cls}`}>{s.label}</span>
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
