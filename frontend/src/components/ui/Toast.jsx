// frontend/src/components/ui/Toast.jsx
// Système de notifications toast : Provider + composants visuels.
//
// Usage (n'importe où dans l'app) :
//   import { toast } from '../../lib/toast';
//   toast.success('Projet enregistré !');
//   toast.error('Erreur lors de la sauvegarde');
//   toast.warning('Attention : données incomplètes');
//   toast.info('Redirection en cours…');

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { toastEmitter } from '../../lib/toast';

// ── Config par type ───────────────────────────────────────────
const TYPE_CFG = {
  success: {
    icon:      CheckCircle,
    bar:       'bg-success',
    bg:        'bg-surface border border-success/20',
    icon_bg:   'bg-success/10',
    icon_cls:  'text-success',
    title_cls: 'text-success',
  },
  error: {
    icon:      XCircle,
    bar:       'bg-danger',
    bg:        'bg-surface border border-danger/20',
    icon_bg:   'bg-danger/10',
    icon_cls:  'text-danger',
    title_cls: 'text-danger',
  },
  warning: {
    icon:      AlertTriangle,
    bar:       'bg-warning',
    bg:        'bg-surface border border-warning/20',
    icon_bg:   'bg-warning/10',
    icon_cls:  'text-warning',
    title_cls: 'text-warning',
  },
  info: {
    icon:      Info,
    bar:       'bg-info',
    bg:        'bg-surface border border-info/20',
    icon_bg:   'bg-info/10',
    icon_cls:  'text-info',
    title_cls: 'text-info',
  },
};

// ── Item individuel ───────────────────────────────────────────
function ToastItem({ id, type, message, title, duration, onRemove }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  const cfg = TYPE_CFG[type] ?? TYPE_CFG.info;
  const Icon = cfg.icon;

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onRemove(id), 320);
  }, [id, onRemove]);

  // Animation d'entrée
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Barre de progression + auto-dismiss
  // rafId est une ref React pour survivre aux re-renders et être proprement annulé
  const rafId = useRef(null);
  useEffect(() => {
    const start = Date.now();
    const end   = start + duration;

    const frame = () => {
      const pct = Math.max(0, ((end - Date.now()) / duration) * 100);
      setProgress(pct);
      if (pct > 0) {
        rafId.current = requestAnimationFrame(frame);
      } else {
        dismiss();
      }
    };
    rafId.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId.current);
  }, [duration, dismiss]);

  return (
    <div
      className={`
        relative w-[340px] max-w-[calc(100vw-2rem)]
        rounded-2xl shadow-xl overflow-hidden
        transition-all duration-300 ease-out
        ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${cfg.bg}
      `}
    >
      {/* Bande colorée gauche */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${cfg.bar}`} />

      {/* Barre de progression en bas */}
      <div className="absolute bottom-0 left-[3px] right-0 h-[2px] bg-border/40">
        <div
          className={`h-full transition-none ${cfg.bar} opacity-40`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-start gap-3 pl-5 pr-4 py-3.5">
        {/* Icône dans un cercle coloré */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.icon_bg}`}>
          <Icon size={15} className={cfg.icon_cls} />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          {title && (
            <p className={`text-xs font-bold mb-0.5 ${cfg.title_cls}`}>{title}</p>
          )}
          <p className="text-sm text-fg leading-snug">{message}</p>
        </div>

        <button
          onClick={dismiss}
          className="flex-shrink-0 p-0.5 -mr-0.5 mt-0.5 text-fg-subtle hover:text-fg transition-colors rounded"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Provider — à placer une seule fois autour de l'app ────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((payload) => {
    setToasts(prev => {
      const next = [...prev, payload];
      return next.slice(-5); // max 5 toasts simultanés
    });
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // S'abonner à l'émetteur global
  useEffect(() => {
    const unsub = toastEmitter.subscribe(addToast);
    return unsub;
  }, [addToast]);

  return (
    <>
      {children}
      {createPortal(
        <div
          className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none"
          aria-live="polite"
          aria-label="Notifications"
        >
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem {...t} onRemove={removeToast} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
