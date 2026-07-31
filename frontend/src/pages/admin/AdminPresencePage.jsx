// frontend/src/pages/admin/AdminPresencePage.jsx

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Activity, Users, WifiOff, Loader2, Radio, Zap,
  BarChart2, Clock, AlertTriangle, TrendingUp,
} from 'lucide-react';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';
import { formatNotificationText, formatRelativeDate } from '../../utils/notifications';
import { useT } from '../../lib/i18n';
import { roleLabel } from '../../lib/roles';

// ── Tokens visuels ────────────────────────────────────────────
const ROLE_CFG = {
  admin:      { pill: 'bg-role-admin/10 text-role-admin',         ring: 'ring-role-admin/30'      },
  chercheur:  { pill: 'bg-role-chercheur/10 text-role-chercheur', ring: 'ring-role-chercheur/30'  },
  technicien: { pill: 'bg-role-terrain/10 text-role-terrain',     ring: 'ring-role-terrain/30'    },
  lecteur:    { pill: 'bg-surface-3 text-fg-muted',               ring: 'ring-border'             },
};

const getActionCfg = (t) => ({
  CREATE:     { label: t('adminPresencePage.actionCreated'),     cls: 'bg-success/10 text-success border-success/20',   bar: 'bg-success'  },
  UPDATE:     { label: t('adminPresencePage.actionUpdated'),     cls: 'bg-info/10 text-info border-info/20',            bar: 'bg-info'     },
  DELETE:     { label: t('adminPresencePage.actionDeleted'),     cls: 'bg-danger/10 text-danger border-danger/20',      bar: 'bg-danger'   },
  ACTIVATE:   { label: t('adminPresencePage.actionActivated'),   cls: 'bg-primary/10 text-primary border-primary/20',   bar: 'bg-primary'  },
  DEACTIVATE: { label: t('adminPresencePage.actionDeactivated'), cls: 'bg-surface-3 text-fg-subtle border-border',      bar: 'bg-fg-subtle'},
  READ:       { label: t('adminPresencePage.actionRead'),        cls: 'bg-surface-3 text-fg-subtle border-border',      bar: 'bg-fg-subtle'},
});

const getSpecimenCfg = (t) => [
  { key: 'moustique', label: t('adminPresencePage.specimenMoustiques'), color: 'text-specimen-moustique', bg: 'bg-specimen-moustique/10', border: 'border-specimen-moustique/30' },
  { key: 'tique',     label: t('adminPresencePage.specimenTiques'),     color: 'text-specimen-tique',     bg: 'bg-specimen-tique/10',     border: 'border-specimen-tique/30'     },
  { key: 'puce',      label: t('adminPresencePage.specimenPuces'),      color: 'text-specimen-puce',      bg: 'bg-specimen-puce/10',      border: 'border-specimen-puce/30'      },
];

const initials = (u) => `${u?.prenom?.[0] ?? ''}${u?.nom?.[0] ?? ''}`.toUpperCase();

function inactifDepuis(dateStr, t) {
  if (!dateStr) return null;
  const jours = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (jours === 0) return null;
  if (jours === 1) return t('adminPresencePage.hier');
  if (jours < 7)  return `${jours}${t('adminPresencePage.joursSuffix')}`;
  if (jours < 30) return `${Math.floor(jours / 7)} ${t('adminPresencePage.semainesSuffix')}`;
  return `${Math.floor(jours / 30)} ${t('adminPresencePage.moisSuffix')}`;
}

// ── Skeleton shimmer ──────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}

// ── Carte métrique ────────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, iconColor, iconBg, accent = '', loading }) {
  return (
    <div className={`card p-5 flex items-center gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-md ${accent}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="min-w-0">
        {loading
          ? <Skeleton className="h-7 w-14 mb-1" />
          : <p className="text-2xl font-bold text-fg tabular-nums leading-none">{value ?? '—'}</p>
        }
        <p className="text-[11px] text-fg-muted mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

// ── Carte utilisateur en ligne ────────────────────────────────
function UserCard({ user, isMe, kicking, onKick }) {
  const t = useT();
  const role = ROLE_CFG[user.role] ?? ROLE_CFG.lecteur;
  return (
    <div className="card p-4 flex items-center gap-3 group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-md border-l-[3px] border-l-success">
      {/* Avatar avec point de présence */}
      <div className="relative flex-shrink-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ring-2 ${role.ring} ${role.pill}`}>
          {initials(user)}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-surface animate-pulse" />
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-fg truncate">{user.prenom} {user.nom}</p>
          {isMe && (
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
              {t('adminPresencePage.you')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${role.pill}`}>
            {roleLabel(user.role)}
          </span>
          {user.tabCount > 1 && (
            <span className="text-[10px] text-fg-subtle">{user.tabCount} {t('adminPresencePage.tabsSuffix')}</span>
          )}
        </div>
      </div>

      {/* Kick — visible au hover */}
      {!isMe && (
        <button
          onClick={() => onKick(user.id)}
          disabled={kicking}
          title={t('adminPresencePage.closeSseSession')}
          className="opacity-0 group-hover:opacity-100 p-2 flex items-center justify-center text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-all duration-200 disabled:opacity-40 flex-shrink-0"
        >
          {kicking
            ? <Loader2 size={14} className="animate-spin" />
            : <WifiOff size={14} />
          }
        </button>
      )}
    </div>
  );
}

// ── Item du fil d'activité (timeline) ────────────────────────
function ActivityItem({ log, fresh }) {
  const t = useT();
  const actionCfg = getActionCfg(t);
  const cfg = actionCfg[log.action] ?? actionCfg.READ;
  return (
    <div className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-2/60 transition-colors ${fresh ? 'presence-item-enter' : ''}`}>
      {/* Dot de couleur */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${cfg.bar}`} />

      {/* Corps */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.cls}`}>
            {cfg.label}
          </span>
          <span className="text-[10px] text-fg-subtle font-mono bg-surface-2 px-1.5 py-0.5 rounded">
            {log.entity}
          </span>
        </div>
        <p className="text-xs text-fg line-clamp-1 leading-relaxed">
          {formatNotificationText(log)}
        </p>
      </div>

      {/* Temps */}
      <time className="text-[10px] text-fg-subtle whitespace-nowrap flex-shrink-0 mt-0.5 tabular-nums">
        {formatRelativeDate(log.createdAt)}
      </time>
    </div>
  );
}

// ── Ligne tableau métriques ───────────────────────────────────
function UserStatRow({ entry, maxSaisies, barsVisible, rank }) {
  const t = useT();
  const { user, saisies7j, saisies30j, derniereAction } = entry;
  const inactif = inactifDepuis(derniereAction, t);
  const pct     = maxSaisies > 0 ? (saisies30j / maxSaisies) * 100 : 0;
  const role    = ROLE_CFG[user.role] ?? ROLE_CFG.lecteur;

  return (
    <tr
      className="border-b border-border hover:bg-surface-2/50 transition-colors group"
      style={{ animationDelay: `${rank * 40}ms` }}
    >
      {/* Membre */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${role.pill}`}>
            {initials(user)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg truncate">{user.prenom} {user.nom}</p>
            <span className={`text-[10px] font-medium px-1.5 py-px rounded-full ${role.pill}`}>
              {roleLabel(user.role)}
            </span>
          </div>
        </div>
      </td>

      {/* 7 jours */}
      <td className="px-5 py-3.5 text-center w-24">
        <span className={`text-sm font-bold tabular-nums ${saisies7j > 0 ? 'text-fg' : 'text-fg-subtle'}`}>
          {saisies7j}
        </span>
      </td>

      {/* 30 jours + barre */}
      <td className="px-5 py-3.5 w-56">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-[width] duration-700 ease-out"
              style={{ width: barsVisible ? `${pct}%` : '0%' }}
            />
          </div>
          <span className={`text-sm font-bold tabular-nums w-6 text-right flex-shrink-0 ${saisies30j > 0 ? 'text-fg' : 'text-fg-subtle'}`}>
            {saisies30j}
          </span>
        </div>
      </td>

      {/* Dernière action */}
      <td className="px-5 py-3.5 hidden lg:table-cell">
        {!derniereAction ? (
          <span className="text-xs text-fg-subtle italic">{t('adminPresencePage.never')}</span>
        ) : inactif ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 border border-warning/20 px-2.5 py-0.5 rounded-full">
            <AlertTriangle size={10} />
            {inactif}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 border border-success/20 px-2.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            {t('adminPresencePage.activeToday')}
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Page principale ───────────────────────────────────────────
export default function AdminPresencePage() {
  const t = useT();
  const specimenCfg = getSpecimenCfg(t);
  const { user: me } = useAuthStore();

  const [presence,    setPresence]    = useState({ users: [], count: 0 });
  const [activity,    setActivity]    = useState([]);
  const [adminStats,  setAdminStats]  = useState(null);
  const [loadingP,    setLoadingP]    = useState(true);
  const [loadingA,    setLoadingA]    = useState(true);
  const [loadingS,    setLoadingS]    = useState(true);
  const [kickingId,   setKickingId]   = useState(null);
  const [sseOk,       setSseOk]       = useState(false);
  const [barsVisible, setBarsVisible] = useState(false);
  const [freshIds,    setFreshIds]    = useState(new Set());
  const prevActivityIds = useRef(new Set());

  const fetchPresence = useCallback(async () => {
    try {
      const r = await api.get('/auth/users/presence');
      setPresence(r.data);
    } catch { /* silencieux */ } finally { setLoadingP(false); }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const r = await api.get('/dictionnaire/audit-logs', { params: { limit: 30 } });
      const items = r.data.items || [];
      // Marque les items réellement nouveaux pour l'animation
      const newIds = new Set(items.map(i => i.id));
      const fresh  = new Set([...newIds].filter(id => !prevActivityIds.current.has(id)));
      prevActivityIds.current = newIds;
      setFreshIds(fresh);
      setActivity(items);
    } catch { /* silencieux */ } finally { setLoadingA(false); }
  }, []);

  const fetchAdminStats = useCallback(async () => {
    try {
      const r = await api.get('/dashboard/admin-stats');
      setAdminStats(r.data);
      // Lance l'animation des barres avec un léger délai
      setTimeout(() => setBarsVisible(true), 120);
    } catch { /* silencieux */ } finally { setLoadingS(false); }
  }, []);

  const kick = useCallback(async (userId) => {
    setKickingId(userId);
    try {
      const r = await api.delete(`/auth/users/${userId}/session`);
      toast.info(r.data.message || t('adminPresencePage.sessionClosed'));
      await fetchPresence();
    } catch (err) {
      toast.error(err.response?.data?.error || t('adminPresencePage.errorClosingSession'));
    } finally { setKickingId(null); }
  }, [fetchPresence, t]);

  useEffect(() => {
    fetchPresence();
    fetchActivity();
    fetchAdminStats();

    const token  = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
    const es = new EventSource(`${apiUrl}/notifications/stream?token=${encodeURIComponent(token)}`);

    es.addEventListener('init',            () => setSseOk(true));
    es.addEventListener('presence_update', fetchPresence);
    es.addEventListener('new_activity',    () => { fetchActivity(); fetchAdminStats(); });
    es.onopen  = () => setSseOk(true);
    es.onerror = () => setSseOk(false);

    return () => es.close();
  }, [fetchPresence, fetchActivity, fetchAdminStats]);

  const totaux     = adminStats?.totauxSpecimens ?? {};
  const recents    = adminStats?.saisiesRecentes ?? {};
  const parUser    = adminStats?.parUtilisateur  ?? [];
  const maxSaisies = Math.max(...parUser.map(e => e.saisies30j), 1);
  const totalSSE   = presence.users.reduce((s, u) => s + u.tabCount, 0);

  return (
    <div className="max-w-screen-2xl space-y-6">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Radio size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-fg leading-tight">{t('adminPresencePage.title')}</h1>
            <p className="text-xs text-fg-subtle mt-0.5">{t('adminPresencePage.subtitle')}</p>
          </div>
        </div>

        <div className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${
          sseOk
            ? 'bg-success/10 text-success border-success/30'
            : 'bg-surface-2 text-fg-subtle border-border'
        }`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sseOk ? 'bg-success animate-pulse' : 'bg-fg-subtle'}`} />
          {sseOk ? t('adminPresencePage.sseConnected') : t('adminPresencePage.connecting')}
        </div>
      </div>

      {/* ── Métriques globales (2 rangées) ── */}
      <div className="space-y-3">
        {/* Rangée 1 — Live */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label={t('adminPresencePage.onlineNow')}
            value={presence.count}
            icon={Users}
            iconColor="text-success"
            iconBg="bg-success/10"
            accent="border-l-[3px] border-l-success"
            loading={loadingP}
          />
          <MetricCard
            label={t('adminPresencePage.activeSseConnections')}
            value={totalSSE}
            icon={Zap}
            iconColor="text-warning"
            iconBg="bg-warning/10"
            loading={loadingP}
          />
          <MetricCard
            label={t('adminPresencePage.entriesToday')}
            value={recents.aujourdhui}
            icon={Clock}
            iconColor="text-primary"
            iconBg="bg-primary/10"
            loading={loadingS}
          />
          <MetricCard
            label={t('adminPresencePage.entriesThisWeek')}
            value={recents.semaine}
            icon={TrendingUp}
            iconColor="text-info"
            iconBg="bg-info/10"
            loading={loadingS}
          />
        </div>

        {/* Rangée 2 — Totaux spécimens */}
        <div className="grid grid-cols-3 gap-3">
          {specimenCfg.map(s => (
            <div
              key={s.key}
              className={`card p-4 flex items-center gap-3 border ${s.border} ${s.bg} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-md`}
            >
              <div className="flex-1 min-w-0">
                {loadingS
                  ? <Skeleton className="h-8 w-16 mb-1" />
                  : <p className={`text-3xl font-bold tabular-nums ${s.color}`}>
                      {(totaux[s.key] ?? 0).toLocaleString(t('common.locale'))}
                    </p>
                }
                <p className="text-[11px] text-fg-muted mt-0.5">{s.label} {t('adminPresencePage.totalSuffix')}</p>
              </div>
              <BarChart2 size={24} className={`${s.color} opacity-40 flex-shrink-0`} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Présence + Activité (2 colonnes) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

        {/* Présence */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
            <h2 className="text-sm font-semibold text-fg">{t('adminPresencePage.onlineUsers')}</h2>
            {presence.count > 0 && (
              <span className="text-xs bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full font-medium">
                {presence.count}
              </span>
            )}
          </div>

          {loadingP ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="card p-4 flex items-center gap-3">
                  <Skeleton className="w-10 h-10 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : presence.users.length === 0 ? (
            <div className="card p-10 flex flex-col items-center justify-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center mb-1">
                <Users size={18} className="text-fg-subtle" />
              </div>
              <p className="text-sm font-medium text-fg-muted">{t('adminPresencePage.noConnectedUser')}</p>
              <p className="text-xs text-fg-subtle">{t('adminPresencePage.usersAppearHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {presence.users.map(u => (
                <UserCard
                  key={u.id}
                  user={u}
                  isMe={u.id === me?.id}
                  kicking={kickingId === u.id}
                  onKick={kick}
                />
              ))}
            </div>
          )}

          <p className="text-[10px] text-fg-subtle px-1 leading-relaxed">
            {t('adminPresencePage.kickHintPrefix')} <WifiOff size={9} className="inline" /> {t('adminPresencePage.kickHintSuffix')}
          </p>
        </div>

        {/* Fil d'activité */}
        <div className="lg:col-span-3 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={15} className="text-primary flex-shrink-0" />
            <h2 className="text-sm font-semibold text-fg">{t('adminPresencePage.activityFeed')}</h2>
            <div className={`ml-auto flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              sseOk ? 'text-success border-success/20 bg-success/5' : 'text-fg-subtle border-border'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sseOk ? 'bg-success animate-pulse' : 'bg-fg-subtle'}`} />
              {sseOk ? t('adminPresencePage.live') : t('adminPresencePage.offline')}
            </div>
          </div>

          <div className="card overflow-hidden flex flex-col" style={{ maxHeight: '480px' }}>
            {/* Ligne de timeline verticale */}
            <div className="relative">
              <div className="absolute left-[22px] top-0 bottom-0 w-px bg-border pointer-events-none z-0" />
            </div>

            {loadingA ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                    <Skeleton className="h-3 w-16 flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center gap-2 text-center">
                <Activity size={20} className="text-fg-subtle" />
                <p className="text-sm text-fg-muted">{t('adminPresencePage.noRecentActivity')}</p>
              </div>
            ) : (
              <div className="overflow-y-auto thin-scroll divide-y divide-border/50">
                {activity.map(log => (
                  <ActivityItem
                    key={log.id}
                    log={log}
                    fresh={freshIds.has(log.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Métriques par membre ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={15} className="text-primary flex-shrink-0" />
          <h2 className="text-sm font-semibold text-fg">{t('adminPresencePage.activityByMember')}</h2>
          <span className="text-xs text-fg-subtle">{t('adminPresencePage.entriesRangeHint')}</span>
        </div>

        <div className="card overflow-hidden">
          {loadingS ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-8 ml-auto" />
                  <Skeleton className="h-2 w-32 rounded-full" />
                  <Skeleton className="h-4 w-8" />
                </div>
              ))}
            </div>
          ) : parUser.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-fg-muted">{t('adminPresencePage.noActivityData')}</p>
              <p className="text-xs text-fg-subtle mt-1">{t('adminPresencePage.metricsAppearHint')}</p>
            </div>
          ) : (
            /* Scroll vertical si > 8 membres, horizontal toujours */
            <div className="overflow-x-auto thin-scroll">
              <div className={`overflow-y-auto thin-scroll ${parUser.length > 8 ? 'max-h-[420px]' : ''}`}>
                <table className="w-full text-sm min-w-[540px]">
                  <thead className="sticky top-0 z-10 bg-surface datatable-thead">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-fg-subtle uppercase tracking-wide border-b border-border">
                        {t('adminPresencePage.colMembre')}
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-fg-subtle uppercase tracking-wide border-b border-border w-24">
                        {t('adminPresencePage.col7j')}
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-fg-subtle uppercase tracking-wide border-b border-border w-56">
                        {t('adminPresencePage.col30j')}
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-fg-subtle uppercase tracking-wide border-b border-border hidden lg:table-cell">
                        {t('adminPresencePage.colDerniereAction')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parUser.map((entry, i) => (
                      <UserStatRow
                        key={entry.user.id}
                        entry={entry}
                        maxSaisies={maxSaisies}
                        barsVisible={barsVisible}
                        rank={i}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] text-fg-subtle mt-2 px-1">
          {t('adminPresencePage.entriesFootnotePrefix')}{' '}
          <span className="inline-flex items-center gap-0.5 text-warning align-middle">
            <AlertTriangle size={9} /> {t('adminPresencePage.inactiveOverOneDay')}
          </span>
        </p>
      </div>

    </div>
  );
}
