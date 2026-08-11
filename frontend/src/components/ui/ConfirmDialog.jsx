// frontend/src/components/ui/ConfirmDialog.jsx
// Modal de confirmation custom — remplace window.confirm() dans toute l'app.

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, HelpCircle } from 'lucide-react';
import { dialogEmitter } from '../../lib/dialog';
import { useT } from '../../lib/i18n';

// ── Config par variante (labels résolus au rendu via t()) ──────
const VARIANT_CFG = {
  danger: {
    icon:      Trash2,
    iconBg:    'bg-danger/10',
    iconColor: 'text-danger',
    accentBar: 'bg-danger/20',
    confirmCls: 'btn-danger',
    confirmLabelKey: 'common.delete',
  },
  warning: {
    icon:      AlertTriangle,
    iconBg:    'bg-warning/10',
    iconColor: 'text-warning',
    accentBar: 'bg-warning/20',
    confirmCls: 'btn-primary',
    confirmLabelKey: 'common.confirm',
  },
  info: {
    icon:      HelpCircle,
    iconBg:    'bg-info/10',
    iconColor: 'text-info',
    accentBar: 'bg-info/20',
    confirmCls: 'btn-primary',
    confirmLabelKey: 'common.confirm',
  },
};

// ── Modal individuel ──────────────────────────────────────────
function ConfirmModal({ dlg, onResolve }) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const cfg  = VARIANT_CFG[dlg.variant] ?? VARIANT_CFG.danger;
  const Icon = cfg.icon;

  // Entrée animée
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const resolve = useCallback((value) => {
    setVisible(false);
    setTimeout(() => onResolve(value), 200);
  }, [onResolve]);

  // Fermeture Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') resolve(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resolve]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-[9998] flex items-center justify-center p-4 transition-all duration-200 ${
        visible ? 'bg-black/50 backdrop-blur-sm' : 'bg-transparent pointer-events-none'
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) resolve(false); }}
    >
      <div
        className={`bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transition-all duration-200 ${
          visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-3'
        }`}
      >
        {/* Bande de couleur en haut */}
        <div className={`h-1 w-full ${cfg.accentBar}`} />

        {/* Corps centré */}
        <div className="px-7 pt-7 pb-5 text-center">
          {/* Icône */}
          <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${cfg.iconBg}`}>
            <Icon size={26} className={cfg.iconColor} />
          </div>

          {/* Titre */}
          <h2 className="text-base font-bold text-fg leading-tight">{dlg.title}</h2>

          {/* Message */}
          {dlg.message && (
            <p className="text-sm text-fg-muted mt-2 leading-relaxed">{dlg.message}</p>
          )}
        </div>

        {/* Séparateur */}
        <div className="mx-6 h-px bg-border" />

        {/* Actions */}
        <div className="px-6 py-4 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => resolve(false)}
            className="btn-secondary text-sm"
          >
            {dlg.cancelLabel ?? t('common.cancel')}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => resolve(true)}
            className={`${cfg.confirmCls} text-sm`}
          >
            {dlg.confirmLabel ?? t(cfg.confirmLabelKey)}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Provider — à placer une seule fois autour de l'app ────────
export function ConfirmDialogProvider({ children }) {
  const [dlg,     setDlg]     = useState(null);
  const [resolve, setResolve] = useState(null);

  useEffect(() => {
    const unsub = dialogEmitter.subscribe((payload) => {
      const { resolve: res, ...rest } = payload;
      setResolve(() => res);
      setDlg(rest);
    });
    return unsub;
  }, []);

  const handleResolve = useCallback((value) => {
    resolve?.(value);
    setDlg(null);
    setResolve(null);
  }, [resolve]);

  return (
    <>
      {children}
      {dlg && <ConfirmModal dlg={dlg} onResolve={handleResolve} />}
    </>
  );
}
