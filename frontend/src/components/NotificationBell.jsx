// frontend/src/components/NotificationBell.jsx
// Cloche de notifications — affiche l'activité récente des autres utilisateurs
// (audit_logs) avec pastille de non-lus. Rafraîchi par polling.

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck } from 'lucide-react';
import api from '../api/axios';
import { formatNotificationText, formatRelativeDate } from '../utils/notifications';

const POLL_INTERVAL_MS = 20000;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [coords, setCoords] = useState(null);
  const btnRef  = useRef(null);
  const menuRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const r = await api.get('/notifications', { params: { limit: 20 } });
      setItems(r.data.items || []);
      setUnreadCount(r.data.unreadCount || 0);
    } catch {
      // silencieux — ne doit pas perturber la navigation
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const tid = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(tid);
  }, [fetchNotifications]);

  const openMenu = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setOpen(true);
  };
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

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

  const markAllRead = async () => {
    setItems((prev) => prev.map((it) => ({ ...it, isRead: true })));
    setUnreadCount(0);
    try {
      await api.patch('/notifications/read-all');
    } catch {
      fetchNotifications();
    }
  };

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
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-danger text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && coords && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, right: coords.right }}
          className="z-[100] w-80 max-h-[28rem] flex flex-col bg-surface border border-border rounded-xl shadow-card-lg overflow-hidden"
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border flex-shrink-0">
            <p className="text-sm font-semibold text-fg">Notifications</p>
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

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {items.length === 0 ? (
              <p className="px-3.5 py-8 text-center text-sm text-fg-subtle">Aucune notification</p>
            ) : items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => markOneRead(item)}
                className={`w-full text-left px-3.5 py-2.5 text-xs leading-snug transition-colors hover:bg-surface-2 ${
                  !item.isRead ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!item.isRead && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                  <div className={item.isRead ? 'pl-3.5' : ''}>
                    <p className="text-fg">{formatNotificationText(item)}</p>
                    <p className="text-fg-subtle mt-1">{formatRelativeDate(item.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
