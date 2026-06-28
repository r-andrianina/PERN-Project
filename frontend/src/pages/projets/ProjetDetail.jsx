import { useParams, Link } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import {
  FolderOpen, MapPin, Tag, ChevronRight, User, Calendar,
  Clock, Target, Bug, Activity, Layers,
} from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, EmptyState, Spinner, Breadcrumb } from '../../components/ui';

const STATUT_TONE  = { actif: 'success', termine: 'default', suspendu: 'warning' };
const STATUT_LABEL = { actif: 'Actif', termine: 'Terminé', suspendu: 'Suspendu' };
const MISSION_TONE  = { planifiee: 'info', en_cours: 'success', terminee: 'default', annulee: 'danger' };
const MISSION_LABEL = { planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' };

const TYPE_COLOR = {
  moustique: 'bg-specimen-moustique',
  tique:     'bg-specimen-tique',
  puce:      'bg-specimen-puce',
};
const TYPE_LABEL = { moustique: 'Moustiques', tique: 'Tiques', puce: 'Puces' };

function MiniBar({ value, max, colorClass = 'bg-primary' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold text-fg tabular-nums w-8 text-right">{value}</span>
    </div>
  );
}

export default function ProjetDetail() {
  const { id } = useParams();
  const [projet,        setProjet]        = useState(null);
  const [specimenStats, setSpecimenStats] = useState(null);
  const [loadingStats,  setLoadingStats]  = useState(true);

  useEffect(() => {
    api.get(`/projets/${id}`).then(r => setProjet(r.data.projet));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoadingStats(true);
    api.get(`/projets/${id}/stats`)
      .then(r => setSpecimenStats(r.data))
      .catch(() => setSpecimenStats(null))
      .finally(() => setLoadingStats(false));
  }, [id]);

  // ── Calculs dérivés ────────────────────────────────────────────
  const progress = useMemo(() => {
    if (!projet?.dateDebut || !projet?.dateFin) return null;
    // eslint-disable-next-line react-hooks/purity
    const now   = Date.now();
    const start = new Date(projet.dateDebut).getTime();
    const end   = new Date(projet.dateFin).getTime();
    return { pct: Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)), daysLeft: Math.ceil((end - now) / 86400000) };
  }, [projet]);

  const missionStats = useMemo(() => {
    const ms = projet?.missions ?? [];
    return {
      total:     ms.length,
      en_cours:  ms.filter(m => m.statut === 'en_cours').length,
      planifiee: ms.filter(m => m.statut === 'planifiee').length,
      terminee:  ms.filter(m => m.statut === 'terminee').length,
      annulee:   ms.filter(m => m.statut === 'annulee').length,
    };
  }, [projet]);

  const totalLocalites = useMemo(
    () => (projet?.missions ?? []).reduce((s, m) => s + (m._count?.localites ?? 0), 0),
    [projet]
  );

  const totalSpecimens = specimenStats
    ? Object.values(specimenStats.parType).reduce((a, b) => a + b, 0)
    : 0;

  if (!projet) return <Spinner.Block label="Chargement…" height="h-40" />;

  // ── Couleur de la progression ────────────────────────────────
  const progressColor = !progress
    ? 'bg-primary'
    : progress.daysLeft < 0
      ? 'bg-danger'
      : progress.daysLeft < 60
        ? 'bg-warning'
        : 'bg-primary';

  return (
    <div className="max-w-screen-xl space-y-5">
      <Breadcrumb items={[
        { label: 'Projets', to: '/projets' },
        { label: projet.nom },
      ]} />

      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-5 items-start">

        {/* ── Colonne gauche ── */}
        <div className="space-y-5">

          {/* Carte principale du projet */}
          <Card padding="md">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FolderOpen size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap mb-1">
                  <span className="inline-flex items-center gap-1 text-xs font-mono bg-surface-2 text-fg-muted px-2 py-0.5 rounded-lg border border-border">
                    <Tag size={10} /> {projet.code}
                  </span>
                  <Badge tone={STATUT_TONE[projet.statut] ?? 'default'} dot>
                    {STATUT_LABEL[projet.statut] ?? projet.statut}
                  </Badge>
                </div>
                <h1 className="text-xl font-bold text-fg">{projet.nom}</h1>
              </div>
            </div>

            {projet.description && (
              <p className="text-sm text-fg-muted bg-surface-2 rounded-xl px-4 py-3 border border-border mt-2">
                {projet.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 mt-4">
              {(projet.porteur || projet.responsable) && (
                <div className="text-xs">
                  <p className="text-fg-subtle font-medium mb-0.5 flex items-center gap-1"><User size={11} /> Porteur</p>
                  <p className="text-fg">
                    {projet.porteur || `${projet.responsable.prenom} ${projet.responsable.nom}`}
                  </p>
                </div>
              )}
              {projet.dateDebut && (
                <div className="text-xs">
                  <p className="text-fg-subtle font-medium mb-0.5 flex items-center gap-1"><Calendar size={11} /> Période</p>
                  <p className="text-fg">
                    {new Date(projet.dateDebut).toLocaleDateString('fr-FR')}
                    {projet.dateFin && ` → ${new Date(projet.dateFin).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Missions */}
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <MapPin size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-fg">
                Missions
                <span className="ml-2 text-xs font-normal text-fg-subtle">({projet.missions?.length ?? 0})</span>
              </h2>
            </div>

            {projet.missions?.length === 0 ? (
              <div className="py-10"><EmptyState icon={MapPin} title="Aucune mission associée" /></div>
            ) : (
              <div className="divide-y divide-border">
                {projet.missions?.map(m => (
                  <Link key={m.id} to={`/missions/${m.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-2 transition-colors group">
                    <div>
                      <p className="text-sm font-medium text-fg group-hover:text-primary transition-colors">
                        {m.ordreMission}
                      </p>
                      <p className="text-xs text-fg-subtle mt-0.5">{m._count?.localites ?? 0} localité(s)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={MISSION_TONE[m.statut] ?? 'default'} dot>
                        {MISSION_LABEL[m.statut] ?? m.statut}
                      </Badge>
                      <ChevronRight size={14} className="text-fg-subtle group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Colonne droite — Tableau de bord du projet ── */}
        <div className="space-y-4">

          {/* Avancement temporel */}
          {progress !== null && (
            <Card padding="md">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-fg-subtle" />
                <span className="text-xs font-semibold text-fg uppercase tracking-wider">Avancement</span>
              </div>
              <div className="flex items-end justify-between mb-2">
                <span className="text-2xl font-bold text-fg">{Math.round(progress.pct)}<span className="text-sm font-normal text-fg-subtle ml-0.5">%</span></span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${
                  progress.daysLeft < 0
                    ? 'bg-danger/10 text-danger'
                    : progress.daysLeft < 60
                      ? 'bg-warning/10 text-warning'
                      : 'bg-success/10 text-success'
                }`}>
                  {progress.daysLeft < 0
                    ? `Terminé il y a ${Math.abs(progress.daysLeft)}j`
                    : `${progress.daysLeft} j restants`}
                </span>
              </div>
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className={`h-full ${progressColor} rounded-full transition-all duration-700`}
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-fg-subtle mt-1.5">
                <span>{new Date(projet.dateDebut).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>
                <span>{new Date(projet.dateFin).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>
              </div>
            </Card>
          )}

          {/* Bilan des missions */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-3">
              <Target size={14} className="text-fg-subtle" />
              <span className="text-xs font-semibold text-fg uppercase tracking-wider">Bilan missions</span>
              <span className="ml-auto text-xs font-bold text-fg">{missionStats.total}</span>
            </div>
            <div className="space-y-2.5">
              {[
                { key: 'en_cours',  label: 'En cours',  color: 'bg-success', tone: 'success' },
                { key: 'planifiee', label: 'Planifiée', color: 'bg-info',    tone: 'info'    },
                { key: 'terminee',  label: 'Terminée',  color: 'bg-fg-subtle', tone: 'default' },
                { key: 'annulee',   label: 'Annulée',   color: 'bg-danger',  tone: 'danger'  },
              ].map(({ key, label, color }) => (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${color}`} />
                      <span className="text-fg-muted">{label}</span>
                    </div>
                    <span className="font-semibold text-fg tabular-nums">{missionStats[key]}</span>
                  </div>
                  <MiniBar value={missionStats[key]} max={missionStats.total} colorClass={color} />
                </div>
              ))}
            </div>
          </Card>

          {/* Couverture terrain */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={14} className="text-fg-subtle" />
              <span className="text-xs font-semibold text-fg uppercase tracking-wider">Couverture terrain</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-fg">{missionStats.total}</p>
                <p className="text-[10px] text-fg-subtle mt-0.5">Mission(s)</p>
              </div>
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-fg">{totalLocalites}</p>
                <p className="text-[10px] text-fg-subtle mt-0.5">Localité(s)</p>
              </div>
            </div>
          </Card>

          {/* Spécimens collectés */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-3">
              <Bug size={14} className="text-fg-subtle" />
              <span className="text-xs font-semibold text-fg uppercase tracking-wider">Spécimens collectés</span>
              {!loadingStats && specimenStats && (
                <span className="ml-auto text-xs font-bold text-primary">{totalSpecimens}</span>
              )}
            </div>

            {loadingStats ? (
              <div className="space-y-2.5 animate-pulse">
                {[80, 55, 40].map(w => (
                  <div key={w} className="flex items-center gap-2">
                    <div className="h-3 rounded bg-surface-3" style={{ width: '50%' }} />
                    <div className="flex-1 h-1.5 rounded-full bg-surface-3" />
                    <div className="h-3 w-6 rounded bg-surface-3" />
                  </div>
                ))}
              </div>
            ) : !specimenStats || totalSpecimens === 0 ? (
              <p className="text-xs text-fg-subtle text-center py-3">
                Aucun spécimen collecté pour ce projet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(specimenStats.parType)
                  .filter(([, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-fg-muted">{TYPE_LABEL[type] ?? type}</span>
                      </div>
                      <MiniBar value={count} max={totalSpecimens} colorClass={TYPE_COLOR[type] ?? 'bg-primary'} />
                    </div>
                  ))}
                {specimenStats.totalIndividus > totalSpecimens && (
                  <p className="text-[10px] text-fg-subtle border-t border-border pt-2 mt-1">
                    {specimenStats.totalIndividus} individus au total
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Top espèces */}
          {specimenStats?.topEspeces?.length > 0 && (
            <Card padding="md">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={14} className="text-fg-subtle" />
                <span className="text-xs font-semibold text-fg uppercase tracking-wider">Top espèces</span>
              </div>
              <div className="space-y-2">
                {specimenStats.topEspeces.slice(0, 5).map((e, i) => (
                  <div key={e.nom} className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] font-bold text-fg-subtle w-4 text-right flex-shrink-0">{i + 1}.</span>
                    <span className="italic text-fg truncate flex-1">{e.nom}</span>
                    <span className="font-bold text-fg-muted tabular-nums flex-shrink-0">{e.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
