import { Link, useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, ChevronRight, Tag, Users } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { Card, Badge, Button, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { useApiQuery } from '../../hooks';

const STATUT_TONE  = { actif: 'success', termine: 'default', suspendu: 'warning' };
const STATUT_LABEL = { actif: 'Actif', termine: 'Terminé', suspendu: 'Suspendu' };

export default function ProjetsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data, loading: isLoading } = useApiQuery('/projets', { select: (r) => r.projets ?? [] });
  const projets = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FolderOpen} iconTone="primary"
        title="Projets" subtitle={`${projets.length} projet(s) enregistré(s)`}
        actions={
          user?.role === 'admin' && (
            <Button icon={Plus} onClick={() => navigate('/projets/nouveau')}>Nouveau projet</Button>
          )
        }
      />

      {isLoading ? <Spinner.Block /> : projets.length === 0 ? (
        <EmptyState
          icon={FolderOpen} title="Aucun projet pour l'instant"
          action={user?.role === 'admin' ? { label: 'Créer le premier projet', icon: Plus, onClick: () => navigate('/projets/nouveau') } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {projets.map(p => (
            <Link key={p.id} to={`/projets/${p.id}`}
              className="block group">
              <Card padding="none" className="p-5 flex items-center justify-between hover:shadow-card-md transition-shadow">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FolderOpen size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs font-mono bg-surface-2 text-fg-muted px-2 py-0.5 rounded-lg border border-border">
                        <Tag size={10} /> {p.code}
                      </span>
                      <span className="text-sm font-semibold text-fg truncate">{p.nom}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-fg-subtle">{p._count?.missions ?? 0} mission(s)</span>
                      {(p.porteur || p.responsable) && (
                        <span className="flex items-center gap-1 text-xs text-fg-subtle">
                          <Users size={11} />
                          {p.porteur || `${p.responsable.prenom} ${p.responsable.nom}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <Badge tone={STATUT_TONE[p.statut] ?? 'default'} dot>{STATUT_LABEL[p.statut] ?? p.statut}</Badge>
                  <ChevronRight size={16} className="text-fg-subtle group-hover:text-primary transition-colors" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
