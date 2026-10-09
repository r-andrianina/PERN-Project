import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Plus, ChevronRight, Calendar, User } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { Card, Badge, Button, EmptyState, PageHeader, Spinner, DataTable, Pagination } from '../../components/ui';
import { useApiQuery } from '../../hooks';
import { useT, interpolate } from '../../lib/i18n';

// Statut d'avancement, calculé par le serveur (backend/src/utils/missionStatut.js)
// et jamais saisi. L'ordre ci-dessous est celui du cycle de vie d'une mission,
// pas un ordre alphabétique : il sert aussi à ranger les filtres.
const STATUTS = ['planifiee', 'terrain', 'a_saisir', 'partielle', 'complete'];

const STATUT_TONE = {
  planifiee: 'default',
  terrain:   'info',
  a_saisir:  'warning',   // seul état qui appelle une action
  partielle: 'primary',
  complete:  'success',
};

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
          {m.chefMission?.nom ?? null}
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
      key:          'statut',
      label:        t('missionsPage.colStatus'),
      sortable:     true,
      skeletonWidth: '60%',
      render: (m) => (
        <div className="flex flex-col gap-0.5">
          <Badge tone={STATUT_TONE[m.statut] ?? 'default'}>{t(`missionStatus.${m.statut}`)}</Badge>
          {/* Le détail n'apparaît que là où il explique le badge : savoir
              « 4 méthodes sur 6 ont produit » est ce qui rend « partielle »
              actionnable. */}
          {m.statut === 'partielle' && (
            <span className="text-2xs text-fg-subtle leading-tight">
              {interpolate(t('missionsPage.methodesProductives'), { n: m.methodesAvecSpecimens, total: m.methodes })}
            </span>
          )}
        </div>
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

  const [sort,   setSort]   = useState(null);
  const [page,   setPage]   = useState(1);
  const [limit,  setLimit]  = useState(25);
  const [filtre, setFiltre] = useState(null);   // null = tous les statuts

  // `data ?? []` crée un tableau neuf à chaque rendu : passé tel quel en
  // dépendance d'un useMemo, il le relancerait indéfiniment.
  const toutes = useMemo(() => data ?? [], [data]);

  // Compteurs calculés sur la liste ENTIÈRE, pas sur la page affichée : un
  // filtre qui annoncerait « 3 à saisir » en n'en montrant que ceux de la page
  // courante serait pire que pas de compteur du tout.
  const parStatut = useMemo(() => {
    const c = {};
    for (const m of toutes) c[m.statut] = (c[m.statut] ?? 0) + 1;
    return c;
  }, [toutes]);

  const filtrees = useMemo(
    () => (filtre ? toutes.filter((m) => m.statut === filtre) : toutes),
    [toutes, filtre],
  );

  const sorted = useMemo(() => {
    const missions = filtrees;
    if (!sort) return missions;
    return [...missions].sort((a, b) => {
      let av, bv;
      switch (sort.key) {
        case 'ordreMission': av = a.ordreMission; bv = b.ordreMission; break;
        case 'dateDebut':    av = a.dateDebut;    bv = b.dateDebut;    break;
        case 'localites':    av = a._count?.localites ?? 0; bv = b._count?.localites ?? 0; break;
        // Tri par ETAT D'AVANCEMENT, pas par ordre alphabetique du libelle :
        // « complete » ne vient pas apres « a_saisir » dans le cycle de vie.
        case 'statut':       av = STATUTS.indexOf(a.statut); bv = STATUTS.indexOf(b.statut); break;
        default: return 0;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), t('common.locale'));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [filtrees, sort, t]);

  const missions  = toutes;
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
          {/* Filtres par état d'avancement. On n'affiche que les états
              RÉELLEMENT présents : proposer « Planifiée (0) » quand aucune
              mission ne l'est ajoute du bruit sans rien apprendre. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setFiltre(null); setPage(1); }}
              className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                filtre === null
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'border-border-strong text-fg-subtle hover:bg-surface-2'
              }`}
            >
              {t('common.all')} ({missions.length})
            </button>
            {STATUTS.filter((s) => parStatut[s]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setFiltre(filtre === s ? null : s); setPage(1); }}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                  filtre === s
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'border-border-strong text-fg-subtle hover:bg-surface-2'
                }`}
              >
                {t(`missionStatus.${s}`)} ({parStatut[s]})
              </button>
            ))}
          </div>

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

          {/* Cards mobile — même liste filtrée que le tableau : sans ça, le
              filtre semblerait sans effet sur téléphone. */}
          <div className="space-y-3 md:hidden">
            {sorted.map(m => (
              <Link key={m.id} to={`/missions/${m.id}`} className="block group">
                <Card padding="sm" className="hover:shadow-card-md transition-shadow">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-semibold text-primary text-sm">{m.ordreMission}</span>
                    <Badge tone={STATUT_TONE[m.statut] ?? 'default'} size="sm">
                      {t(`missionStatus.${m.statut}`)}
                    </Badge>
                  </div>
                  <p className="text-xs text-fg-muted mb-2">{m.projet?.nom}</p>
                  <div className="flex items-center gap-4 text-xs text-fg-subtle">
                    {m.chefMission && (
                      <span className="flex items-center gap-1">
                        <User size={11} /> {m.chefMission.nom}
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
