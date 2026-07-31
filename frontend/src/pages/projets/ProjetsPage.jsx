import { Link, useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, ChevronRight, Users } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { Card, Badge, Button, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { useApiQuery } from '../../hooks';
import { hasMinRole } from '../../lib/roles';
import { useT, interpolate } from '../../lib/i18n';

export default function ProjetsPage() {
  const t = useT();
  const STATUT_TONE  = { actif: 'success', termine: 'default', suspendu: 'warning' };
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data, loading: isLoading } = useApiQuery('/projets', { select: (r) => r.projets ?? [] });
  const projets = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FolderOpen} iconTone="primary"
        title={t('projetsPage.title')} subtitle={interpolate(t('projetsPage.subtitle'), { n: projets.length })}
        actions={
          hasMinRole(user?.role, 'chercheur') && (
            <Button icon={Plus} onClick={() => navigate('/projets/nouveau')}>{t('projetsPage.newProject')}</Button>
          )
        }
      />

      {isLoading ? <Spinner.Block /> : projets.length === 0 ? (
        <EmptyState
          icon={FolderOpen} title={t('projetsPage.noProjectYet')}
          action={hasMinRole(user?.role, 'chercheur') ? { label: t('projetsPage.createFirst'), icon: Plus, onClick: () => navigate('/projets/nouveau') } : undefined}
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
                      <span className="text-sm font-semibold text-fg truncate">{p.nom}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-fg-subtle">{p._count?.missions ?? 0} {t('projetsPage.missionsCount')}</span>
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
                  <Badge tone={STATUT_TONE[p.statut] ?? 'default'} dot>{['actif','termine','suspendu'].includes(p.statut) ? t(`projetStatus.${p.statut}`) : p.statut}</Badge>
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
