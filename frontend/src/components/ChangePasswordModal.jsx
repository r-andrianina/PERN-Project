// frontend/src/components/ChangePasswordModal.jsx
// Changement de mot de passe en libre-service (utilisateur déjà authentifié).

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, X, Eye, EyeOff, Check, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { useT } from '../lib/i18n';

export default function ChangePasswordModal({ onClose }) {
  const t = useT();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [showCurrent,     setShowCurrent]     = useState(false);
  const [showNew,         setShowNew]         = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [done,            setDone]            = useState(false);
  const [error,           setError]           = useState(null);

  const submit = async (e) => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      await api.patch('/auth/me/password', { currentPassword, newPassword });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden my-4 sm:my-auto sm:mt-16">
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface/20 flex items-center justify-center">
              <KeyRound size={16} className="text-white" />
            </div>
            <h2 className="text-base font-bold text-white">{t('changePasswordModal.title')}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">
          {done ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                <Check size={20} className="text-success" />
              </div>
              <p className="text-sm font-medium text-fg">{t('changePasswordModal.success')}</p>
              <button onClick={onClose} className="btn-primary mx-auto mt-2">{t('common.close')}</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">{error}</div>}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-fg-muted">{t('changePasswordModal.currentPassword')} <span className="text-danger">*</span></label>
                <div className="relative">
                  <input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    required autoComplete="current-password"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary pr-10" />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle">
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-fg-muted">{t('changePasswordModal.newPassword')} <span className="text-danger">*</span></label>
                <div className="relative">
                  <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    required minLength={8} autoComplete="new-password"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary pr-10"
                    placeholder={t('changePasswordModal.newPasswordHint')} />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle">
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  {t('changePasswordModal.submit')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
