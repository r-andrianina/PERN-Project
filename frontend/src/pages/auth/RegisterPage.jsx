import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../../api/axios';
import { Spinner } from '../../components/ui';
import { useT } from '../../lib/i18n';

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-border-strong rounded-xl bg-surface text-fg hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';
const labelCls = 'block text-xs font-semibold text-fg-muted tracking-wide mb-1.5';

export default function RegisterPage() {
  const t = useT();
  const [form, setForm]     = useState({ nom: '', prenom: '', email: '', password: '' });
  const [isLoading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => { setError(null); setForm({ ...form, [e.target.name]: e.target.value }); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await api.post('/auth/register', form); setSuccess(true); }
    catch (err) { setError(err.response?.data?.error || t('registerPage.genericError')); }
    finally { setLoading(false); }
  };

  const shell = (content) => (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-primary-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl mb-4 shadow-lg">
            <img src="/icons/logo.png" alt="SpécimenManager" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SpécimenManager</h1>
          <p className="text-primary-200 text-sm mt-1.5">{t('registerPage.subtitle')}</p>
        </div>
        {content}
      </div>
    </div>
  );

  if (success) return shell(
    <div className="bg-surface rounded-2xl shadow-2xl p-8 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-success/10 rounded-2xl mb-4">
        <CheckCircle2 size={28} className="text-success" />
      </div>
      <h2 className="text-base font-semibold text-fg mb-2">{t('registerPage.successTitle')}</h2>
      <p className="text-sm text-fg-muted mb-6">
        {t('registerPage.successMessage')}
      </p>
      <Link to="/login" className="btn-primary justify-center w-full">{t('registerPage.backToLogin')}</Link>
    </div>
  );

  return shell(
    <div className="bg-surface rounded-2xl shadow-2xl p-7">
      <h2 className="text-base font-semibold text-fg mb-5">{t('registerPage.requestTitle')}</h2>

      {error && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl flex items-start gap-2.5">
          <AlertCircle size={15} className="text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>{t('registerPage.lastName')}</label>
            <input type="text" name="nom" value={form.nom} onChange={handleChange} placeholder="RAKOTO" required className={inputCls} /></div>
          <div><label className={labelCls}>{t('registerPage.firstName')}</label>
            <input type="text" name="prenom" value={form.prenom} onChange={handleChange} placeholder="Jean" required className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>{t('registerPage.email')}</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="vous@pasteur.mg" required className={inputCls} /></div>
        <div><label className={labelCls}>{t('registerPage.password')}</label>
          <input type="password" name="password" value={form.password} onChange={handleChange} placeholder={t('registerPage.passwordPlaceholder')} required minLength={10} className={inputCls} /></div>
        <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center mt-2">
          {isLoading ? <><Spinner size={15} /> {t('registerPage.submitting')}</> : t('registerPage.submit')}
        </button>
      </form>

      <p className="text-center text-xs text-fg-subtle mt-5">
        {t('registerPage.hasAccount')}{' '}
        <Link to="/login" className="text-primary hover:brightness-110 font-semibold">{t('registerPage.login')}</Link>
      </p>
    </div>
  );
}
