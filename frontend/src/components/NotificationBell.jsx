// frontend/src/components/NotificationBell.jsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, CheckCheck, ArrowRight, WifiOff } from 'lucide-react';
import api from '../api/axios';
import { toast } from '../lib/toast';
import { formatNotificationText, formatRelativeDate, resolveEntityUrl } from '../utils/notifications';
import useAuthStore from '../store/authStore';

// Poll de secours si SSE déconnecté (perte réseau, redémarrage serveur)
const FALLBACK_POLL_MS = 60000;

// Palette de couleurs d'avatars — assignée par userId pour cohérence visuelle
const AVATAR_COLORS = [
  'bg-primary/15 text-primary',
  'bg-success/15 text-success',
  'bg-info/15 text-info',
  'bg-warning/15 text-warning',
  'bg-danger/15 text-danger',
  'bg-purple-100 text-purple-600',
];

// Badge coloré par type d'action
const ACTION_CFG = {
  CREATE:     { label: 'Créé',      cls: 'bg-success/10 text-success    border-success/20' },
  UPDATE:     { label: 'Modifié',   cls: 'bg-info/10    text-info       border-info/20'    },
  DELETE:     { label: 'Supprimé',  cls: 'bg-danger/10  text-danger     border-danger/20'  },
  ACTIVATE:   { label: 'Activé',    cls: 'bg-primary/10 text-primary    border-primary/20' },
  DEACTIVATE: { label: 'Désactivé', cls: 'bg-surface-2  text-fg-subtle  border-border'     },
  READ:       { label: 'Consulté',  cls: 'bg-surface-2  text-fg-subtle  border-border'     },
};

function UserAvatar({ user }) {
  const initials = user
    ? `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase()
    : '?';
  const colorCls = user
    ? AVATAR_COLORS[(user.id ?? 0) % AVATAR_COLORS.length]
    : 'bg-surface-3 text-fg-subtle';
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${colorCls}`}>
      {initials}
    </div>
  );
}

function ActionBadge({ action }) {
  const cfg = ACTION_CFG[action];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export default function NotificationBell() {
  const navigate    = useNavigate();
  const updateUser  = useAuthStore((s) => s.updateUser);

  const [open,        setOpen]        = useState(false);
  const [items,       setItems]       = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sseStatus,   setSseStatus]   = useState('connecting'); // 'connecting' | 'connected' | 'offline'
  const [coords,      setCoords]      = useState(null);

  const btnRef  = useRef(null);
  const menuRef = useRef(null);
  const openRef = useRef(false); // ref pour les callbacks SSE (évite les closures périmées)

  // ── Fetch ──────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const r = await api.get('/notifications', { params: { limit: 20 } });
      const newItems = r.data.items || [];
      setItems(newItems);
      setUnreadCount(r.data.unreadCount || 0);
      return newItems;
    } catch {
      // silencieux — ne doit pas perturber la navigation
    }
  }, []);

  // ── Handler SSE new_activity — fetch + toast si dropdown fermé ─
  const handleNewActivity = useCallback(async () => {
    const newItems = await fetchNotifications();
    if (!openRef.current && newItems?.length > 0 && !newItems[0].isRead) {
      toast.info(formatNotificationText(newItems[0]), {
        title:    'Nouvelle activité',
        duration: 4000,
      });
    }
  }, [fetchNotifications]);

  // ── Handler SSE permissions_changed — mise à jour silencieuse ──
  const updateUserRef = useRef(updateUser);
  useEffect(() => { updateUserRef.current = updateUser; }, [updateUser]);

  const handlePermissionsChanged = useCallback((e) => {
    try {
      const data = JSON.parse(e.data);
      updateUserRef.current({ specimensAutorises: data.specimensAutorises });
      toast.info(data.message || 'Vos permissions ont été mises à jour.', {
        title:    'Permissions modifiées',
        duration: 8000,
      });
    } catch { /* non bloquant */ }
  }, []);

  // ── SSE + polling de secours ────────────────────────────────────
  useEffect(() => {
    fetchNotifications();

    const token  = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
    const es = new EventSource(`${apiUrl}/notifications/stream?token=${encodeURIComponent(token)}`);

    // unreadCount initial + refresh liste à chaque (re)connexion SSE
    es.addEventListener('init', async (e) => {
      setSseStatus('connected');
      try { setUnreadCount(JSON.parse(e.data).unreadCount ?? 0); } catch { /* non bloquant */ }
      await fetchNotifications(); // rattrape les événements manqués pendant une déconnexion
    });

    es.addEventListener('new_activity', handleNewActivity);
    es.addEventListener('permissions_changed', handlePermissionsChanged);
    es.onopen  = () => setSseStatus('connected');
    es.onerror = () => setSseStatus('offline');

    // Poll de secours — rattrape les événements SSE potentiellement manqués
    const tid = setInterval(fetchNotifications, FALLBACK_POLL_MS);

    return () => {
      es.close();
      clearInterval(tid);
    };
  }, [fetchNotifications, handleNewActivity, handlePermissionsChanged]);

  // ── Ouverture / fermeture du dropdown ─────────────────────────
  const openMenu = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    openRef.current = true;
    setOpen(true);
  };

  const close = useCallback(() => {
    openRef.current = false;
    setOpen(false);
  }, []);

  // ÉTAPE 1 : Fix scroll — exclure le scroll INTERNE au dropdown
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      close();
    };
    const onScroll = (e) => {
      // Ne pas fermer si l'utilisateur scrolle à l'intérieur du menu
      if (menuRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, close]);

  // ── Actions ────────────────────────────────────────────────────
  const markOneRead = async (item) => {
    if (item.isRead) return;
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, isRead: true } : it)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.patch(`/notifications/${item.id}/read`);
    } catch {
      fetchNotifications();
    }
  };

  const handleItemClick = (item) => {
    markOneRead(item);
    const url = resolveEntityUrl(item.entity, item.entityId, item.action);
    if (url) { close(); navigate(url); }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((it) => ({ ...it, isRead: true })));
    setUnreadCount(0);
    try {
      await api.patch('/notifications/read-all');
    } catch {
      fetchNotifications();
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? close() : openMenu())}
        className="relative p-2 rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={18} />

        {/* Pastille nombre non lus */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-danger text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {/* ÉTAPE 4 : Indicateur SSE offline (uniquement si pas de badge) */}
        {sseStatus === 'offline' && unreadCount === 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-warning border-2 border-surface" />
        )}
      </button>

      {open && coords && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, right: coords.right }}
          className="z-[100] w-80 max-h-[28rem] flex flex-col bg-surface border border-border rounded-xl shadow-card-lg overflow-hidden"
        >
          {/* En-tête */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-fg">Notifications</p>
              {/* ÉTAPE 4 : Indicateur SSE offline dans le header */}
              {sseStatus === 'offline' && (
                <span className="flex items-center gap-1 text-[10px] text-warning font-medium">
                  <WifiOff size={10} /> temps réel inactif
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck size={13} /> Tout marquer comme lu
              </button>
            )}
          </div>

          {/* ÉTAPE 2 : Liste enrichie avec avatar + badge d'action */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {items.length === 0 ? (
              <p className="px-3.5 py-8 text-center text-sm text-fg-subtle">Aucune notification</p>
            ) : items.map((item) => {
              const url = resolveEntityUrl(item.entity, item.entityId, item.action);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={`group w-full text-left px-3 py-2.5 transition-colors hover:bg-surface-2
                    ${!item.isRead ? 'bg-primary/5' : ''}
                    ${url ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-start gap-2">
                    {/* Point non lu */}
                    <div className="w-1.5 flex-shrink-0 flex justify-center pt-2.5">
                      {!item.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </div>

                    {/* Avatar utilisateur */}
                    <UserAvatar user={item.user} />

                    {/* Texte + méta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-fg leading-snug">{formatNotificationText(item)}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <ActionBadge action={item.action} />
                        <span className="text-[10px] text-fg-subtle">{formatRelativeDate(item.createdAt)}</span>
                      </div>
                    </div>

                    {url && (
                      <ArrowRight
                        size={13}
                        className="flex-shrink-0 mt-0.5 text-fg-subtle opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pied — lien vers page complète */}
          <div className="px-3.5 py-2 border-t border-border flex-shrink-0">
            <Link
              to="/notifications"
              onClick={close}
              className="flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Voir tout l'historique <ArrowRight size={11} />
            </Link>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
