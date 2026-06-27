import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Plus, ChevronRight, Calendar, User } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { Card, Badge, Button, EmptyState, PageHeader, Spinner, DataTable, Pagination } from '../../components/ui';
import { useApiQuery } from '../../hooks';

const STATUT_TONE  = { planifiee: 'info', en_cours: 'success', terminee: 'default', annulee: 'danger' };
const STATUT_LABEL = { planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' };

const COLUMNS = [
  {
    key:          'ordreMission',
    label:        'Ordre mission',
    sortable:     true,
    skeletonWidth: '70%',
    render: (m) => (
      <span className="font-semibold text-primary">{m.ordreMission}</span>
    ),
  },
  {
    key:          'projet',
    label:        'Projet',
    skeletonWidth: '60%',
    render: (m) => <span className="text-fg-muted text-xs">{m.projet?.nom ?? '—'}</span>,
  },
  {
    key:          'chefMission',
    label:        'Chef mission',
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
    label:        'Période',
    sortable:     true,
    skeletonWidth: '75%',
    hidden:       'hidden md:table-cell',
    render: (m) => (
      <span className="text-fg-subtle text-xs whitespace-nowrap">
        {m.dateDebut ? new Date(m.dateDebut).toLocaleDateString('fr-FR') : '—'}
        {m.dateFin && ` → ${new Date(m.dateFin).toLocaleDateString('fr-FR')}`}
      </span>
    ),
  },
  {
    key:           'localites',
    label:         'Localités',
    sortable:      true,
    skeletonWidth: '40%',
    width:         '90px',
    headerClassName: 'text-center',
    className:     'text-center',
    hidden:        'hidden sm:table-cell',
    render: (m) => <Badge tone="info">{m._count?.localites ?? 0}</Badge>,
  },
  {
    key:          'statut',
    label:        'Statut',
    sortable:     true,
    skeletonWidth: '55%',
    render: (m) => (
      <Badge tone={STATUT_TONE[m.statut] ?? 'default'} dot>
        {STATUT_LABEL[m.statut] ?? m.statut}
      </Badge>
    ),
  },
  {
    key:   '_nav',
    label: '',
    width: '40px',
    render: () => <ChevronRight size={14} className="text-fg-subtle" />,
  },
];

export default function MissionsPage() {
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
        case 'statut':       av = a.statut;       bv = b.statut;       break;
        case 'localites':    av = a._count?.localites ?? 0; bv = b._count?.localites ?? 0; break;
        default: return 0;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'fr');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [data, sort]);

  const missions  = data ?? [];
  const pageCount = Math.ceil(sorted.length / limit) || 1;
  const paged     = sorted.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-6">
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
