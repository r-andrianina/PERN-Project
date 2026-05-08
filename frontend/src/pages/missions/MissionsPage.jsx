import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Plus, ChevronRight, Calendar, User } from 'lucide-react';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { Card, Badge, Button, EmptyState, PageHeader, Spinner } from '../../components/ui';

const STATUT_TONE  = { planifiee: 'info', en_cours: 'success', terminee: 'default', annulee: 'danger' };
const STATUT_LABEL = { planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' };

export default function MissionsPage() {
  const [missions, setMissions] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const canCreate = ['admin', 'chercheur'].includes(user?.role);

  useEffect(() => {
    api.get('/missions').then(r => setMissions(r.data.missions)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        icon={MapPin} iconTone="info"
        title="Missions" subtitle={`${missions.length} mission(s) enregistrée(s)`}
        actions={canCreate && <Button icon={Plus} onClick={() => navigate('/missions/nouvelle')}>Nouvelle mission</Button>}
      />

      {isLoading ? <Spinner.Block /> : missions.length === 0 ? (
        <EmptyState icon={MapPin} title="Aucune mission pour l'instant"
          action={canCreate ? { label: 'Créer la première mission', icon: Plus, onClick: () => navigate('/missions/nouvelle') } : undefined} />
      ) : (
        <>
          {/* Table desktop */}
          <Card padding="none" className="overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  {['Ordre mission', 'Projet', 'Chef mission', 'Période', 'Localités', 'Statut', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-fg-muted tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {missions.map(m => (
                  <tr key={m.id}
                    className="hover:bg-surface-2 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/missions/${m.id}`)}>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-primary group-hover:brightness-110">{m.ordreMission}</span>
                    </td>
                    <td className="px-5 py-3.5 text-fg-muted text-xs">{m.projet?.nom}</td>
                    <td className="px-5 py-3.5 text-fg-muted text-xs">
                      {m.chefMission ? `${m.chefMission.prenom} ${m.chefMission.nom}` : <span className="text-fg-subtle">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-fg-subtle text-xs">
                      {m.dateDebut ? new Date(m.dateDebut).toLocaleDateString('fr-FR') : '—'}
                      {m.dateFin && ` → ${new Date(m.dateFin).toLocaleDateString('fr-FR')}`}
                    </td>
                    <td className="px-5 py-3.5 text-fg-muted text-xs">{m._count?.localites ?? 0}</td>
                    <td className="px-5 py-3.5"><Badge tone={STATUT_TONE[m.statut] ?? 'default'} dot>{STATUT_LABEL[m.statut] ?? m.statut}</Badge></td>
                    <td className="px-5 py-3.5">
                      <ChevronRight size={14} className="text-fg-subtle group-hover:text-primary transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Cards mobile */}
          <div className="space-y-3 md:hidden">
            {missions.map(m => (
              <Link key={m.id} to={`/missions/${m.id}`} className="block group">
                <Card padding="sm" className="hover:shadow-card-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-semibold text-primary text-sm">{m.ordreMission}</span>
                    <Badge tone={STATUT_TONE[m.statut] ?? 'default'} dot>{STATUT_LABEL[m.statut] ?? m.statut}</Badge>
                  </div>
                  <p className="text-xs text-fg-muted mb-2">{m.projet?.nom}</p>
                  <div className="flex items-center gap-4 text-xs text-fg-subtle">
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
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
