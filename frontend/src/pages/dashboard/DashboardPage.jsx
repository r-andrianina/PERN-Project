import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderOpen, MapPin, Microscope, Bug,
  TrendingUp, ChevronRight, Calendar,
} from 'lucide-react';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { Card, Badge, EmptyState, Spinner } from '../../components/ui';

// ─── Utilitaires d'affichage ────────────────────────────────────
const STATUT_TONE = {
  planifiee: 'info',
  en_cours:  'success',
  terminee:  'default',
  annulee:   'danger',
};
const STATUT_LABEL = {
  planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée',
};

// ─── Carte stat cliquable du dashboard ──────────────────────────
function DashboardStat({ label, value, icon: Icon, iconColor, iconBg, to, trend }) {
  return (
    <Link to={to} className="group">
      <Card padding="none" className="p-5 hover:shadow-card-md transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
            <Icon size={20} className={iconColor} />
          </div>
          <ChevronRight size={16} className="text-fg-subtle group-hover:text-primary transition-colors mt-1" />
        </div>
        <div className="text-2xl font-bold text-fg tabular-nums">{value ?? '—'}</div>
        <div className="text-xs text-fg-muted mt-1 font-medium">{label}</div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp size={11} className="text-success" />
            <span className="text-xs text-success font-medium">+{trend} ce mois</span>
          </div>
        )}
      </Card>
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
        setMissions((misRes.data.missions || []).slice(0, 6));
      } catch (err) {
        console.error('Erreur dashboard :', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) return <Spinner.Block label="Chargement du tableau de bord…" height="h-64" />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-6 max-w-6xl">

      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg">
            {greeting}, {user?.prenom}
          </h1>
          <p className="text-sm text-fg-subtle mt-0.5">
            Aperçu de vos données de collecte entomologique
          </p>
        </div>
        <Card padding="none" className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs text-fg-muted">
          <Calendar size={13} />
          {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </Card>
      </div>

      {/* Stats principales — projets, missions, spécimens, moustiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardStat label="Projets"  value={stats?.projets}   to="/projets"
          icon={FolderOpen} iconColor="text-primary"    iconBg="bg-primary/10" />
        <DashboardStat label="Missions" value={stats?.missions}  to="/missions"
          icon={MapPin}     iconColor="text-info"       iconBg="bg-info/10" />
        <DashboardStat label="Spécimens total" value={stats?.specimens} to="/recherche"
          icon={Microscope} iconColor="text-role-admin" iconBg="bg-role-admin/10" />
        <DashboardStat label="Moustiques" value={stats?.moustiques} to="/specimens/moustiques"
          icon={Bug} iconColor="text-specimen-moustique" iconBg="bg-specimen-moustique/10" />
      </div>

      {/* Tiques + Puces + Profil */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashboardStat label="Tiques" value={stats?.tiques} to="/specimens/tiques"
          icon={Bug} iconColor="text-specimen-tique" iconBg="bg-specimen-tique/10" />
        <DashboardStat label="Puces"  value={stats?.puces}  to="/specimens/puces"
          icon={Bug} iconColor="text-specimen-puce"  iconBg="bg-specimen-puce/10" />

        {/* Carte profil — gradient primary, palette tokens */}
        <Card padding="none" className="p-5 bg-gradient-to-br from-primary to-primary-700 border-0">
          <p className="text-xs text-primary-100 font-medium uppercase tracking-wider mb-1">Mon profil</p>
          <p className="text-lg font-bold text-fg-on-primary capitalize">{user?.role}</p>
          <p className="text-xs text-primary-100 mt-1 truncate">{user?.email}</p>
          <div className="mt-3 pt-3 border-t border-white/20">
            <p className="text-xs text-primary-100">{user?.prenom} {user?.nom}</p>
          </div>
        </Card>
      </div>

      {/* Missions récentes */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-fg">Missions récentes</h2>
          </div>
          <Link to="/missions" className="text-xs text-primary hover:brightness-110 font-medium flex items-center gap-1">
            Voir tout <ChevronRight size={13} />
          </Link>
        </div>

        {missions.length === 0 ? (
          <div className="py-12">
            <EmptyState icon={MapPin} title="Aucune mission pour l'instant" />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {missions.map((m) => (
              <Link
                key={m.id}
                to={`/missions/${m.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-2 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg group-hover:text-primary transition-colors truncate">
                    {m.ordreMission}
                  </p>
                  <p className="text-xs text-fg-subtle truncate">{m.projet?.nom}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className="text-xs text-fg-subtle hidden sm:block">
                    {m._count?.localites ?? 0} loc.
                  </span>
                  <Badge tone={STATUT_TONE[m.statut] ?? 'default'} dot>
                    {STATUT_LABEL[m.statut] ?? m.statut}
                  </Badge>
                  <ChevronRight size={14} className="text-fg-subtle group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
