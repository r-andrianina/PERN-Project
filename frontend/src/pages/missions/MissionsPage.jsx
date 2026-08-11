import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Plus, ChevronRight, Calendar, User } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { Card, Badge, Button, EmptyState, PageHeader, Spinner, DataTable, Pagination } from '../../components/ui';
import { useApiQuery } from '../../hooks';
import { useT, interpolate } from '../../lib/i18n';

export default function MissionsPage() {
  const t = useT();
  const COLUMNS = [
    {
      key:          'ordreMission',
      label:        t('missionsPage.colMissionOrder'),
      sortable:     true,
      skeletonWidth: '70%',
      render: (m) => (
        <span className="font-semibold text-primary">{m.ordreMission}</span>
      ),
    },
    {
      key:          'projet',
      label:        t('missionsPage.colProject'),
      skeletonWidth: '60%',
      render: (m) => <span className="text-fg-muted text-xs">{m.projet?.nom ?? '—'}</span>,
    },
    {
      key:          'chefMission',
      label:        t('missionsPage.colMissionLead'),
      skeletonWidth: '65%',
      hidden:       'hidden lg:table-cell',
      render: (m) => (
        <span className="text-fg-muted text-xs">
          {m.chefMission ? `${m.chefMission.prenom} ${m.chefMission.nom}` : null}
        </span>
      ),
    },
    {
      key:          'dateDebut',
      label:        t('missionsPage.colPeriod'),
      sortable:     true,
      skeletonWidth: '75%',
      hidden:       'hidden md:table-cell',
      render: (m) => (
        <span className="text-fg-subtle text-xs whitespace-nowrap">
          {m.dateDebut ? new Date(m.dateDebut).toLocaleDateString(t('common.locale')) : '—'}
          {m.dateFin && ` → ${new Date(m.dateFin).toLocaleDateString(t('common.locale'))}`}
        </span>
      ),
    },
    {
      key:           'localites',
      label:         t('missionsPage.colLocalities'),
      sortable:      true,
      skeletonWidth: '40%',
      width:         '90px',
      headerClassName: 'text-center',
      className:     'text-center',
      hidden:        'hidden sm:table-cell',
      render: (m) => <Badge tone="info">{m._count?.localites ?? 0}</Badge>,
    },
    {
      key:   '_nav',
      label: '',
      width: '40px',
      render: () => <ChevronRight size={14} className="text-fg-subtle" />,
    },
  ];

  const { user } = useAuthStore();
  const navigate  = useNavigate();
  const canCreate = ['admin', 'chercheur'].includes(user?.role);

  const { data, loading: isLoading } = useApiQuery('/missions', { select: (r) => r.missions ?? [] });

  const [sort,  setSort]  = useState(null);
  const [page,  setPage]  = useState(1);
  const [limit, setLimit] = useState(25);

  const sorted = useMemo(() => {
    const missions = data ?? [];
    if (!sort) return missions;
    return [...missions].sort((a, b) => {
      let av, bv;
      switch (sort.key) {
        case 'ordreMission': av = a.ordreMission; bv = b.ordreMission; break;
        case 'dateDebut':    av = a.dateDebut;    bv = b.dateDebut;    break;
        case 'localites':    av = a._count?.localites ?? 0; bv = b._count?.localites ?? 0; break;
        default: return 0;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), t('common.locale'));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [data, sort, t]);

  const missions  = data ?? [];
  const pageCount = Math.ceil(sorted.length / limit) || 1;
  const paged     = sorted.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MapPin} iconTone="info"
        title={t('missionsPage.title')} subtitle={interpolate(t('missionsPage.subtitle'), { n: missions.length })}
        actions={canCreate && <Button icon={Plus} onClick={() => navigate('/missions/nouvelle')}>{t('missionsPage.newMission')}</Button>}
      />

      {isLoading ? <Spinner.Block /> : missions.length === 0 ? (
        <EmptyState icon={MapPin} title={t('missionsPage.noMissionYet')}
          action={canCreate ? { label: t('missionsPage.createFirst'), icon: Plus, onClick: () => navigate('/missions/nouvelle') } : undefined} />
      ) : (
        <>
          {/* Table desktop */}
          <Card padding="none" className="overflow-hidden hidden md:block">
            <DataTable
              columns={COLUMNS}
              rows={paged}
              loading={false}
              sort={sort}
              onSort={(key, dir) => { setSort({ key, dir }); setPage(1); }}
              onRowClick={(m) => navigate(`/missions/${m.id}`)}
              minWidth="700px"
              maxHeight="calc(100vh - 270px)"
            />
            <Pagination
              page={page} pages={pageCount} total={sorted.length} limit={limit}
              onChange={setPage}
              onLimitChange={(n) => { setLimit(n); setPage(1); }}
            />
          </Card>

          {/* Cards mobile */}
          <div className="space-y-3 md:hidden">
            {missions.map(m => (
              <Link key={m.id} to={`/missions/${m.id}`} className="block group">
                <Card padding="sm" className="hover:shadow-card-md transition-shadow">
                  <div className="mb-2">
                    <span className="font-semibold text-primary text-sm">{m.ordreMission}</span>
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
                        <Calendar size={11} /> {new Date(m.dateDebut).toLocaleDateString(t('common.locale'))}
                      </span>
                    )}
                    <span>{m._count?.localites ?? 0} {t('missionsPage.localitiesShort')}</span>
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
