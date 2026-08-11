import { Link } from 'react-router-dom';
import {
  FolderOpen, MapPin, Microscope, TrendingUp, ChevronRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import useAuthStore from '../../store/authStore';
import { Card, EmptyState, Spinner } from '../../components/ui';
import { useApiQuery } from '../../hooks';
import SpecimenIcon from '../../components/SpecimenIcon';
import { useT } from '../../lib/i18n';


const TYPE_COLOR = { moustique: '#1D9E75', tique: '#f59e0b', puce: '#ef4444' };

// ── Tooltip personnalisé pour l'AreaChart ─────────────────────
function CustomTooltip({ active, payload, label }) {
  const t = useT();
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-xl shadow-card px-3 py-2.5 text-xs">
      <p className="font-semibold text-fg mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-fg-muted">{t(`specimenTypes.${p.dataKey}`) ?? p.dataKey} :</span>
          <span className="font-semibold text-fg">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────
function DashboardStat({ label, value, icon: Icon, iconNode, iconColor, iconBg, to, trend }) {
  const t = useT();
  return (
    <Link to={to} className="group">
      <Card padding="none" className="p-5 hover:shadow-card-md transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
            {iconNode ?? <Icon size={20} className={iconColor} />}
          </div>
          <ChevronRight size={16} className="text-fg-subtle group-hover:text-primary transition-colors mt-1" />
        </div>
        <div className="text-2xl font-bold text-fg tabular-nums">
          {value !== null && value !== undefined ? value : <span className="text-fg-subtle text-lg">…</span>}
        </div>
        <div className="text-xs text-fg-muted mt-1 font-medium">{label}</div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp size={11} className="text-success" />
            <span className="text-xs text-success font-medium">+{trend} {t('dashboard.trendSuffix')}</span>
          </div>
        )}
      </Card>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const t = useT();
  const { user } = useAuthStore();

  const { data: stats, loading: isLoading } = useApiQuery('/dashboard/stats');

  const totaux          = stats?.totaux          ?? {};
  const totalMoustiques = totaux.moustiques      ?? null;
  const totalTiques     = totaux.tiques          ?? null;
  const totalPuces      = totaux.puces           ?? null;
  const totalSpecimens  = (totalMoustiques !== null && totalTiques !== null && totalPuces !== null)
    ? totalMoustiques + totalTiques + totalPuces
    : null;

  const missions = stats?.missionsRecentes ?? [];

  const canSee = (type) => user?.role === 'admin' || (user?.specimensAutorises || []).includes(type);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? t('dashboard.greetingMorning') : hour < 18 ? t('dashboard.greetingAfternoon') : t('dashboard.greetingEvening');

  // Données pour le donut (répartition par type)
  const donutData = ['moustique', 'tique', 'puce']
    .filter(st => canSee(st))
    .map(st => ({
      name:  t(`specimenTypes.${st}`),
      value: st === 'moustique' ? (totalMoustiques || 0)
           : st === 'tique'     ? (totalTiques     || 0)
           :                      (totalPuces      || 0),
      color: TYPE_COLOR[st],
      type:  st,
    }))
    .filter(d => d.value > 0);

  const autorises = stats?.autorises ?? [];
  const parMois   = stats?.parMois   ?? [];
  const topEspeces = stats?.topEspeces ?? [];
  const hasChartData = parMois.some(m => autorises.some(st => (m[st] || 0) > 0));

  return (
    <div className="space-y-6 max-w-screen-2xl">

      {/* En-tête */}
      <div>
        <h1 className="text-xl font-bold text-fg">{greeting}, {user?.prenom}</h1>
        <p className="text-sm text-fg-subtle mt-0.5">{t('dashboard.overview')}</p>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardStat label={t('dashboard.projects')}  value={totaux.projets}  to="/projets"
          icon={FolderOpen} iconColor="text-primary" iconBg="bg-primary/10" />
        <DashboardStat label={t('dashboard.missions')} value={totaux.missions} to="/missions"
          icon={MapPin} iconColor="text-info" iconBg="bg-info/10" />
        <DashboardStat label={t('dashboard.totalSpecimens')} value={totalSpecimens} to="/recherche"
          icon={Microscope} iconColor="text-role-admin" iconBg="bg-role-admin/10" />
        {canSee('moustique') && (
          <DashboardStat label={t('dashboard.moustiques')} value={totalMoustiques} to="/specimens/moustiques"
            iconNode={<SpecimenIcon type="moustique" size={24} />} iconBg="bg-specimen-moustique/10" />
        )}
      </div>

      {/* Tiques + Puces + Profil */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {canSee('tique') && (
          <DashboardStat label={t('dashboard.tiques')} value={totalTiques} to="/specimens/tiques"
            iconNode={<SpecimenIcon type="tique" size={24} />} iconBg="bg-specimen-tique/10" />
        )}
        {canSee('puce') && (
          <DashboardStat label={t('dashboard.puces')} value={totalPuces} to="/specimens/puces"
            iconNode={<SpecimenIcon type="puce" size={24} />} iconBg="bg-specimen-puce/10" />
        )}
        <Card padding="none" className="p-5 bg-gradient-to-br from-primary to-primary-700 border-0">
          <p className="text-xs text-primary-100 font-medium uppercase tracking-wider mb-1">{t('dashboard.myProfile')}</p>
          <p className="text-lg font-bold text-fg-on-primary capitalize">{user?.role}</p>
          <p className="text-xs text-primary-100 mt-1 truncate">{user?.email}</p>
          <div className="mt-3 pt-3 border-t border-white/20">
            <p className="text-xs text-primary-100">{user?.prenom} {user?.nom}</p>
          </div>
        </Card>
      </div>

      {/* ── Graphiques ─────────────────────────────────────────── */}
      {isLoading ? (
        <Spinner.Block label={t('dashboard.loadingStats')} height="h-24" />
      ) : !hasChartData && donutData.length === 0 ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* AreaChart collectes par mois — 2/3 de largeur */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-fg">{t('dashboard.collectesByMonth')}</h2>
                <p className="text-xs text-fg-subtle mt-0.5">{t('dashboard.last6Months')}</p>
              </div>
              <div className="flex items-center gap-3">
                {autorises.map(st => (
                  <span key={st} className="flex items-center gap-1.5 text-xs text-fg-muted">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLOR[st] }} />
                    {t(`specimenTypes.${st}`)}
                  </span>
                ))}
              </div>
            </div>

            {!hasChartData ? (
              <div className="h-48 flex items-center justify-center text-fg-subtle text-sm">
                {t('dashboard.noDataForPeriod')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={parMois} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    {autorises.map(st => (
                      <linearGradient key={st} id={`grad-${st}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={TYPE_COLOR[st]} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={TYPE_COLOR[st]} stopOpacity={0}   />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" vertical={false} />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  {autorises.map(st => (
                    <Area key={st} type="monotone" dataKey={st}
                      stroke={TYPE_COLOR[st]} strokeWidth={2}
                      fill={`url(#grad-${st})`}
                      dot={{ r: 3, fill: TYPE_COLOR[st], strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Donut répartition par type — 1/3 */}
          <Card>
            <h2 className="text-sm font-semibold text-fg mb-1">{t('dashboard.distribution')}</h2>
            <p className="text-xs text-fg-subtle mb-5">{t('dashboard.bySpecimenType')}</p>

            {donutData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-fg-subtle text-sm">{t('dashboard.noData')}</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={donutData} dataKey="value" cx="50%" cy="50%"
                      innerRadius={45} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                      {donutData.map((d) => (
                        <Cell key={d.type} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, n) => [v, n]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-3">
                  {donutData.map(d => {
                    const pct = totalSpecimens ? Math.round((d.value / totalSpecimens) * 100) : 0;
                    return (
                      <div key={d.type} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-xs text-fg-muted flex-1">{d.name}</span>
                        <span className="text-xs font-semibold text-fg">{d.value}</span>
                        <span className="text-[10px] text-fg-subtle w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          {/* Top espèces — pleine largeur */}
          {topEspeces.length > 0 && (
            <Card className="lg:col-span-3">
              <h2 className="text-sm font-semibold text-fg mb-1">{t('dashboard.topSpecies')}</h2>
              <p className="text-xs text-fg-subtle mb-5">{t('dashboard.allPeriods')}</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={topEspeces} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="nom" width={160}
                    tick={{ fontSize: 11, fill: '#6b7280', fontStyle: 'italic' }}
                    axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => [v, t('dashboard.individuals')]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {topEspeces.map((d) => (
                      <Cell key={d.nom} fill={TYPE_COLOR[d.type] ?? '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* Missions récentes */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-fg">{t('dashboard.recentMissions')}</h2>
          </div>
          <Link to="/missions" className="text-xs text-primary hover:brightness-110 font-medium flex items-center gap-1">
            {t('common.seeAll')} <ChevronRight size={13} />
          </Link>
        </div>

        {isLoading ? (
          <Spinner.Block label={t('common.loading')} height="h-24" />
        ) : missions.length === 0 ? (
          <div className="py-10">
            <EmptyState icon={MapPin} title={t('dashboard.noMissionYet')} />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {missions.map((m) => (
              <Link key={m.id} to={`/missions/${m.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-2 transition-colors group">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg group-hover:text-primary transition-colors truncate">
                    {m.ordreMission}
                  </p>
                  <p className="text-xs text-fg-subtle truncate">{m.projet?.nom}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className="text-xs text-fg-subtle hidden sm:block">{m._count?.localites ?? 0} {t('dashboard.localitiesShort')}</span>
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
