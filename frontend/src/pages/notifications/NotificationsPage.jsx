// frontend/src/pages/notifications/NotificationsPage.jsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, ArrowRight, BellOff, Filter,
  CheckCircle2, Clock, Inbox, Users, Layers,
} from 'lucide-react';
import api from '../../api/axios';
import { Badge, Pagination, Select } from '../../components/ui';
import {
  formatNotificationText,
  formatRelativeDate,
  resolveEntityUrl,
} from '../../utils/notifications';

// ── Tokens visuels ─────────────────────────────────────────────
const ACTION_TONE = {
  CREATE:     'success',
  UPDATE:     'info',
  DELETE:     'danger',
  ACTIVATE:   'primary',
  DEACTIVATE: 'default',
  READ:       'default',
};

const ACTION_LABEL = {
  CREATE:     'Créé',
  UPDATE:     'Modifié',
  DELETE:     'Supprimé',
  ACTIVATE:   'Activé',
  DEACTIVATE: 'Désactivé',
  READ:       'Consulté',
};

const ACTION_COLOR = {
  CREATE:     'rgb(var(--success))',
  UPDATE:     'rgb(var(--info))',
  DELETE:     'rgb(var(--danger))',
  ACTIVATE:   'rgb(var(--primary))',
  DEACTIVATE: 'rgb(var(--fg-subtle))',
  READ:       'rgb(var(--fg-subtle))',
};

const ENTITY_CFG = {
  Moustique:            { label: 'Moustique',    tone: 'specimen-moustique' },
  Tique:                { label: 'Tique',         tone: 'specimen-tique'    },
  Puce:                 { label: 'Puce',          tone: 'specimen-puce'     },
  Mission:              { label: 'Mission',       tone: 'primary'           },
  Projet:               { label: 'Projet',        tone: 'info'              },
  Localite:             { label: 'Localité',      tone: 'success'           },
  MethodeCollecte:      { label: 'Méthode',       tone: 'warning'           },
  Hote:                 { label: 'Hôte',          tone: 'default'           },
  Container:            { label: 'Container',     tone: 'default'           },
  User:                 { label: 'Utilisateur',   tone: 'role-admin'        },
  TaxonomieSpecimen:    { label: 'Taxonomie',     tone: 'default'           },
  TaxonomieHote:        { label: 'Taxo. hôte',   tone: 'default'           },
  TypeMethodeCollecte:  { label: 'Type méthode',  tone: 'default'           },
};

const AVATAR_COLORS = [
  'bg-primary/15 text-primary',
  'bg-success/15 text-success',
  'bg-info/15 text-info',
  'bg-warning/15 text-warning',
  'bg-danger/15 text-danger',
  'bg-purple-100 text-purple-600',
];

const LIMIT = 25;

const ACTION_OPTS = [
  { value: '',           label: 'Toutes les actions' },
  { value: 'CREATE',     label: 'Création'           },
  { value: 'UPDATE',     label: 'Modification'       },
  { value: 'DELETE',     label: 'Suppression'        },
  { value: 'ACTIVATE',   label: 'Activation'         },
  { value: 'DEACTIVATE', label: 'Désactivation'      },
];

const ENTITY_OPTS = [
  { value: '',                  label: 'Toutes les entités'  },
  { value: 'Moustique',         label: 'Moustique'           },
  { value: 'Tique',             label: 'Tique'               },
  { value: 'Puce',              label: 'Puce'                },
  { value: 'Mission',           label: 'Mission'             },
  { value: 'Projet',            label: 'Projet'              },
  { value: 'Localite',          label: 'Localité'            },
  { value: 'MethodeCollecte',   label: 'Méthode de collecte' },
  { value: 'Hote',              label: 'Hôte'                },
  { value: 'TaxonomieSpecimen', label: 'Taxonomie spécimen'  },
  { value: 'User',              label: 'Utilisateur'         },
];

// ── Helpers ───────────────────────────────────────────────────
function groupByDate(items) {
  const startOfToday     = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday - 86400000);
  const startOfWeek      = new Date(startOfToday - 6 * 86400000);

  const buckets = { today: [], yesterday: [], week: [], older: [] };
  for (const item of items) {
    const d = new Date(item.createdAt);
    if      (d >= startOfToday)     buckets.today.push(item);
    else if (d >= startOfYesterday) buckets.yesterday.push(item);
    else if (d >= startOfWeek)      buckets.week.push(item);
    else                            buckets.older.push(item);
  }
  return [
    { label: "Aujourd'hui",   items: buckets.today     },
    { label: 'Hier',          items: buckets.yesterday  },
    { label: 'Cette semaine', items: buckets.week       },
    { label: 'Plus ancien',   items: buckets.older      },
  ].filter(g => g.items.length > 0);
}

// ── Sous-composants ───────────────────────────────────────────
function Skeleton() {
  return (
    <div className="flex items-start gap-3 px-5 py-4 border-b border-border/60 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-surface-2 flex-shrink-0" />
      <div className="flex-1 space-y-2 py-0.5">
        <div className="h-3.5 bg-surface-2 rounded w-full" />
        <div className="h-3.5 bg-surface-2 rounded w-4/5" />
        <div className="flex gap-1.5 pt-1">
          <div className="h-4 w-14 bg-surface-2 rounded-full" />
          <div className="h-4 w-10 bg-surface-2 rounded-full" />
          <div className="h-4 w-20 bg-surface-2 rounded" />
        </div>
      </div>
    </div>
  );
}

function UserAvatar({ user, size = 'sm' }) {
  const initials = user
    ? `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase()
    : '?';
  const color = user
    ? AVATAR_COLORS[(user.id ?? 0) % AVATAR_COLORS.length]
    : 'bg-surface-3 text-fg-subtle';
  const sz = size === 'lg' ? 'w-10 h-10 text-sm' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sz} rounded-full flex items-center justify-center flex-shrink-0 font-bold ${color}`}>
      {initials}
    </div>
  );
}

function EntityBadge({ entity }) {
  const cfg = ENTITY_CFG[entity];
  if (!cfg) return null;
  return <Badge tone={cfg.tone} size="xs">{cfg.label}</Badge>;
}

function NotifItem({ item, onRead, onNavigate }) {
  const [justRead, setJustRead] = useState(false);
  const url      = resolveEntityUrl(item.entity, item.entityId, item.action);
  const isUnread = !item.isRead && !justRead;

  const handleClick = () => {
    if (!item.isRead && !justRead) { setJustRead(true); onRead(item); }
    if (url) onNavigate(item);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group relative w-full text-left flex items-start gap-3.5 px-5 py-4 transition-all duration-200 hover:bg-surface-2/60 border-l-[3px] ${
        isUnread ? 'border-l-primary bg-primary/[0.025]' : 'border-l-transparent'
      } ${url ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {isUnread && (
        <span className="absolute left-[14px] top-[22px] w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
      )}

      <div className="ml-2 flex-shrink-0">
        <UserAvatar user={item.user} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug line-clamp-2 transition-colors ${
          isUnread ? 'text-fg font-medium' : 'text-fg-muted'
        }`}>
          {formatNotificationText(item)}
        </p>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <EntityBadge entity={item.entity} />
          <Badge tone={ACTION_TONE[item.action] ?? 'default'} size="xs">
            {ACTION_LABEL[item.action] ?? item.action}
          </Badge>
          <span className="flex items-center gap-1 text-[10px] text-fg-subtle">
            <Clock size={9} />
            {formatRelativeDate(item.createdAt)}
          </span>
        </div>
      </div>

      {url ? (
        <ArrowRight size={14} className="flex-shrink-0 mt-1 text-fg-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
      ) : isUnread ? (
        <CheckCircle2 size={14} className="flex-shrink-0 mt-1 text-fg-subtle opacity-0 group-hover:opacity-60 transition-opacity" />
      ) : null}
    </button>
  );
}

function DateDivider({ label }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2 bg-surface-2/60 border-b border-border sticky top-0 z-10 backdrop-blur-sm">
      <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-widest">{label}</span>
    </div>
  );
}

// ── Panneau stats (colonne droite) ────────────────────────────
function StatsPanel({ items, loading }) {
  const actionStats = items.reduce((acc, item) => {
    acc[item.action] = (acc[item.action] || 0) + 1;
    return acc;
  }, {});

  const entityStats = items.reduce((acc, item) => {
    acc[item.entity] = (acc[item.entity] || 0) + 1;
    return acc;
  }, {});

  const actorMap = items.reduce((acc, item) => {
    if (!item.user) return acc;
    const key = item.user.id;
    if (!acc[key]) acc[key] = { user: item.user, count: 0 };
    acc[key].count++;
    return acc;
  }, {});

  const topActors   = Object.values(actorMap).sort((a, b) => b.count - a.count).slice(0, 5);
  const maxAction   = Math.max(...Object.values(actionStats), 1);
  const topEntities = Object.entries(entityStats).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topActions  = Object.entries(actionStats).sort((a, b) => b[1] - a[1]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[3, 4, 3].map((rows, i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-3 w-24 bg-surface-2 rounded mb-4" />
            {Array.from({ length: rows }).map((_, j) => (
              <div key={j} className="h-5 bg-surface-2 rounded mb-2" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">

      {topActions.length > 0 && (
        <div className="card p-4">
          <h3 className="flex items-center gap-2 text-[11px] font-semibold text-fg-subtle uppercase tracking-wider mb-4">
            <Layers size={12} />
            Par action
          </h3>
          <div className="space-y-3">
            {topActions.map(([action, count]) => (
              <div key={action}>
                <div className="flex items-center justify-between mb-1">
                  <Badge tone={ACTION_TONE[action] ?? 'default'} size="xs">
                    {ACTION_LABEL[action] ?? action}
                  </Badge>
                  <span className="text-xs font-semibold text-fg-muted tabular-nums">{count}</span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{
                      width: `${(count / maxAction) * 100}%`,
                      backgroundColor: ACTION_COLOR[action] ?? 'rgb(var(--fg-subtle))',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topEntities.length > 0 && (
        <div className="card p-4">
          <h3 className="flex items-center gap-2 text-[11px] font-semibold text-fg-subtle uppercase tracking-wider mb-4">
            <Inbox size={12} />
            Entités concernées
          </h3>
          <div className="space-y-2">
            {topEntities.map(([entity, count]) => (
              <div key={entity} className="flex items-center justify-between">
                <EntityBadge entity={entity} />
                <span className="text-xs font-semibold text-fg-muted tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topActors.length > 0 && (
        <div className="card p-4">
          <h3 className="flex items-center gap-2 text-[11px] font-semibold text-fg-subtle uppercase tracking-wider mb-4">
            <Users size={12} />
            Acteurs
          </h3>
          <div className="space-y-3">
            {topActors.map(({ user, count }) => (
              <div key={user.id} className="flex items-center gap-2.5">
                <UserAvatar user={user} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-fg truncate">
                    {user.prenom} {user.nom}
                  </p>
                  <p className="text-[10px] text-fg-subtle">
                    {count} action{count > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────
export default function NotificationsPage() {
  const navigate = useNavigate();

  const [items,        setItems]        = useState([]);
  const [total,        setTotal]        = useState(0);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [page,         setPage]         = useState(1);
  const [readFilter,   setReadFilter]   = useState('all');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset: (page - 1) * LIMIT };
      if (actionFilter)            params.action = actionFilter;
      if (entityFilter)            params.entity = entityFilter;
      if (readFilter === 'unread') params.isRead = 'false';
      if (readFilter === 'read')   params.isRead = 'true';
      const r = await api.get('/notifications', { params });
      setItems(r.data.items      || []);
      setTotal(r.data.total      || 0);
      setUnreadCount(r.data.unreadCount || 0);
    } finally { setLoading(false); }
  }, [page, readFilter, actionFilter, entityFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });

  useEffect(() => {
    const token  = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
    const es = new EventSource(`${apiUrl}/notifications/stream?token=${encodeURIComponent(token)}`);
    es.addEventListener('new_activity', () => refreshRef.current?.());
    return () => es.close();
  }, []);

  const resetPage = (setter) => (val) => { setter(val); setPage(1); };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setUnreadCount(0);
    setItems(prev => prev.map(it => ({ ...it, isRead: true })));
  };

  const markOneRead = useCallback(async (item) => {
    if (item.isRead) return;
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, isRead: true } : it));
    setUnreadCount(c => Math.max(0, c - 1));
    try { await api.patch(`/notifications/${item.id}/read`); } catch { refresh(); }
  }, [refresh]);

  const handleNavigate = useCallback((item) => {
    const url = resolveEntityUrl(item.entity, item.entityId, item.action);
    if (url) navigate(url);
  }, [navigate]);

  const pages      = Math.ceil(total / LIMIT);
  const groups     = groupByDate(items);
  const hasFilters = readFilter !== 'all' || actionFilter || entityFilter;

  return (
    <div className="flex flex-col gap-5">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bell size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-fg">Notifications</h1>
            <p className="text-xs text-fg-subtle mt-0.5">Activité de l'équipe en temps réel</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            unreadCount > 0
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'bg-success/10 text-success border-success/20'
          }`}>
            {unreadCount > 0 ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</>
            ) : (
              <><CheckCircle2 size={12} />Tout à jour</>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-fg-muted bg-surface-2 border border-border">
            <Inbox size={11} />
            {total} au total
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              <CheckCheck size={14} />
              Tout marquer comme lu
            </button>
          )}
        </div>
      </div>

      {/* ── Corps : deux colonnes ── */}
      <div className="flex gap-5 items-start">

        {/* Colonne gauche */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Filtres */}
          <div className="card p-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl flex-shrink-0">
              {[
                { key: 'all',    label: 'Toutes'    },
                { key: 'unread', label: 'Non lues', count: unreadCount },
                { key: 'read',   label: 'Lues'      },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => resetPage(setReadFilter)(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                    readFilter === tab.key
                      ? 'bg-surface text-fg shadow-sm'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`text-[10px] px-1.5 py-px rounded-full font-bold ${
                      readFilter === tab.key ? 'bg-primary/10 text-primary' : 'bg-surface-3 text-fg-muted'
                    }`}>
                      {tab.count > 99 ? '99+' : tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
              <Filter size={13} className="text-fg-subtle flex-shrink-0" />
              <Select
                value={actionFilter}
                onChange={resetPage(setActionFilter)}
                wrapperClassName="flex-1 min-w-[150px] max-w-[190px]"
                options={ACTION_OPTS}
              />
              <Select
                value={entityFilter}
                onChange={resetPage(setEntityFilter)}
                wrapperClassName="flex-1 min-w-[170px] max-w-[210px]"
                options={ENTITY_OPTS}
              />
              {hasFilters && (
                <button
                  onClick={() => { resetPage(setReadFilter)('all'); setActionFilter(''); setEntityFilter(''); }}
                  className="text-xs text-fg-subtle hover:text-danger transition-colors px-2 py-1 rounded-lg hover:bg-danger/10 flex-shrink-0"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>

          {/* Liste */}
          {loading ? (
            <div className="card overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <div className="card p-12 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center">
                <BellOff size={24} className="text-fg-subtle" />
              </div>
              <div>
                <p className="text-sm font-semibold text-fg">
                  {hasFilters ? 'Aucune notification' : 'Tout est à jour'}
                </p>
                <p className="text-xs text-fg-subtle mt-1">
                  {hasFilters
                    ? 'Aucune notification ne correspond aux filtres sélectionnés.'
                    : "L'activité de l'équipe apparaîtra ici en temps réel."}
                </p>
              </div>
              {hasFilters && (
                <button
                  onClick={() => { resetPage(setReadFilter)('all'); setActionFilter(''); setEntityFilter(''); }}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Supprimer les filtres
                </button>
              )}
            </div>
          ) : (
            <div className="card overflow-hidden">
              {groups.map(group => (
                <div key={group.label}>
                  <DateDivider label={group.label} />
                  <div className="divide-y divide-border/60">
                    {group.items.map(item => (
                      <NotifItem
                        key={item.id}
                        item={item}
                        onRead={markOneRead}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {pages > 1 && (
                <div className="border-t border-border">
                  <Pagination page={page} pages={pages} total={total} limit={LIMIT} onChange={setPage} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Colonne droite — stats */}
        <div className="w-64 flex-shrink-0">
          <StatsPanel items={items} loading={loading} />
        </div>
      </div>
    </div>
  );
}
