// frontend/src/pages/notifications/NotificationsPage.jsx
// Historique complet des notifications avec pagination et filtres.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ArrowRight } from 'lucide-react';
import api from '../../api/axios';
import { PageHeader, Card, Badge, Pagination, Spinner, Select } from '../../components/ui';
import { formatNotificationText, formatRelativeDate, resolveEntityUrl } from '../../utils/notifications';

const LIMIT = 25;

const ACTION_OPTS = [
  { value: '',            label: 'Toutes les actions' },
  { value: 'CREATE',      label: 'Création' },
  { value: 'UPDATE',      label: 'Modification' },
  { value: 'DELETE',      label: 'Suppression' },
  { value: 'ACTIVATE',    label: 'Activation' },
  { value: 'DEACTIVATE',  label: 'Désactivation' },
];

const ENTITY_OPTS = [
  { value: '',                   label: 'Toutes les entités' },
  { value: 'Moustique',          label: 'Moustique' },
  { value: 'Tique',              label: 'Tique' },
  { value: 'Puce',               label: 'Puce' },
  { value: 'Mission',            label: 'Mission' },
  { value: 'Projet',             label: 'Projet' },
  { value: 'Localite',           label: 'Localité' },
  { value: 'MethodeCollecte',    label: 'Méthode de collecte' },
  { value: 'Hote',               label: 'Hôte' },
  { value: 'Container',          label: 'Container' },
  { value: 'TaxonomieSpecimen',  label: 'Taxonomie spécimen' },
  { value: 'TaxonomieHote',      label: 'Taxonomie hôte' },
  { value: 'TypeMethodeCollecte','label': 'Type méthode' },
  { value: 'User',               label: 'Utilisateur' },
];

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

function UserAvatar({ user }) {
  const initials = user
    ? `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase()
    : '?';
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
      user ? 'bg-primary/10' : 'bg-surface-3'
    }`}>
      <span className={`text-xs font-bold ${user ? 'text-primary' : 'text-fg-subtle'}`}>
        {initials}
      </span>
    </div>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();

  const [items,       setItems]       = useState([]);
  const [total,       setTotal]       = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [page,        setPage]        = useState(1);
  const [readFilter,   setReadFilter]   = useState('all');   // 'all' | 'unread' | 'read'
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset: (page - 1) * LIMIT };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entity = entityFilter;
      if (readFilter === 'unread') params.isRead = 'false';
      if (readFilter === 'read')   params.isRead = 'true';
      const r = await api.get('/notifications', { params });
      setItems(r.data.items   || []);
      setTotal(r.data.total   || 0);
      setUnreadCount(r.data.unreadCount || 0);
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [page, readFilter, actionFilter, entityFilter]);

  // Ref toujours à jour vers refresh — évite les closures périmées dans le listener SSE
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });

  // SSE — rafraîchit la page en temps réel quand une activité arrive
  useEffect(() => {
    const token  = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
    const es = new EventSource(`${apiUrl}/notifications/stream?token=${encodeURIComponent(token)}`);
    es.addEventListener('new_activity', () => refreshRef.current?.());
    return () => es.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remet à la page 1 quand un filtre change
  const setFilterAndReset = (setter) => (val) => { setter(val); setPage(1); };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setUnreadCount(0);
    setItems(prev => prev.map(it => ({ ...it, isRead: true })));
  };

  const markOneRead = async (item) => {
    if (item.isRead) return;
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, isRead: true } : it));
    setUnreadCount(c => Math.max(0, c - 1));
    try { await api.patch(`/notifications/${item.id}/read`); } catch { refresh(); }
  };

  const handleItemClick = (item) => {
    markOneRead(item);
    const url = resolveEntityUrl(item.entity, item.entityId, item.action);
    if (url) navigate(url);
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <PageHeader
        icon={Bell} iconTone="primary"
        title="Notifications"
        subtitle={`${unreadCount} non lue${unreadCount !== 1 ? 's' : ''} · ${total} au total`}
        actions={
          unreadCount > 0 ? (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck size={14} /> Tout marquer comme lu
            </button>
          ) : null
        }
      />

      {/* Filtres */}
      <Card padding="sm" className="flex flex-wrap items-center gap-3">
        {/* Tabs lu / non lu */}
        <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
          {[
            { key: 'all',    label: 'Toutes'   },
            { key: 'unread', label: 'Non lues' },
            { key: 'read',   label: 'Lues'     },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterAndReset(setReadFilter)(key)}
              className={`px-3 py-1.5 transition-colors ${
                readFilter === key
                  ? 'bg-primary text-fg-on-primary'
                  : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Select
          value={actionFilter}
          onChange={setFilterAndReset(setActionFilter)}
          wrapperClassName="w-48 flex-shrink-0"
          options={ACTION_OPTS}
        />
        <Select
          value={entityFilter}
          onChange={setFilterAndReset(setEntityFilter)}
          wrapperClassName="w-56 flex-shrink-0"
          options={ENTITY_OPTS}
        />
      </Card>

      {/* Liste */}
      {loading ? (
        <Spinner.Block />
      ) : items.length === 0 ? (
        <Card padding="lg" className="text-center text-sm text-fg-subtle py-12">
          Aucune notification correspondant aux filtres
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden divide-y divide-border">
          {items.map((item) => {
            const url = resolveEntityUrl(item.entity, item.entityId, item.action);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item)}
                className={`group w-full text-left px-4 py-3.5 flex items-start gap-3
                  hover:bg-surface-2 transition-colors
                  ${!item.isRead ? 'bg-primary/5' : ''}
                  ${url ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {/* Point non lu */}
                <div className="w-2 flex-shrink-0 flex justify-center pt-3">
                  {!item.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </div>

                {/* Avatar */}
                <UserAvatar user={item.user} />

                {/* Texte + date */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg leading-snug">{formatNotificationText(item)}</p>
                  <p className="text-xs text-fg-subtle mt-1">{formatRelativeDate(item.createdAt)}</p>
                </div>

                {/* Badge action + flèche */}
                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                  <Badge tone={ACTION_TONE[item.action] ?? 'default'} size="sm">
                    {ACTION_LABEL[item.action] ?? item.action}
                  </Badge>
                  {url && (
                    <ArrowRight
                      size={13}
                      className="text-fg-subtle opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  )}
                </div>
              </button>
            );
          })}

          <Pagination
            page={page}
            pages={pages}
            total={total}
            limit={LIMIT}
            onChange={setPage}
          />
        </Card>
      )}
    </div>
  );
}
