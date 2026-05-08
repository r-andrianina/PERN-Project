import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../../api/axios';
import { Spinner } from '../../components/ui';

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-border-strong rounded-xl bg-surface text-fg hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';
const labelCls = 'block text-xs font-semibold text-fg-muted tracking-wide mb-1.5';

export default function RegisterPage() {
  const [form, setForm]     = useState({ nom: '', prenom: '', email: '', password: '' });
  const [isLoading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => { setError(null); setForm({ ...form, [e.target.name]: e.target.value }); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await api.post('/auth/register', form); setSuccess(true); }
    catch (err) { setError(err.response?.data?.error || "Erreur lors de l'inscription"); }
    finally { setLoading(false); }
  };

  const shell = (content) => (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-primary-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/15 rounded-2xl mb-4 ring-1 ring-white/20">
            <FlaskConical size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SpécimenManager</h1>
          <p className="text-primary-200 text-sm mt-1.5">Institut Pasteur de Madagascar</p>
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
      <h2 className="text-base font-semibold text-fg mb-2">Inscription envoyée !</h2>
      <p className="text-sm text-fg-muted mb-6">
        Votre demande a été transmise. Un administrateur validera votre compte prochainement.
      </p>
      <Link to="/login" className="btn-primary justify-center w-full">Retour à la connexion</Link>
    </div>
  );

  return shell(
    <div className="bg-surface rounded-2xl shadow-2xl p-7">
      <h2 className="text-base font-semibold text-fg mb-5">Demande d'accès</h2>

      {error && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl flex items-start gap-2.5">
          <AlertCircle size={15} className="text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Nom</label>
            <input type="text" name="nom" value={form.nom} onChange={handleChange} placeholder="RAKOTO" required className={inputCls} /></div>
          <div><label className={labelCls}>Prénom</label>
            <input type="text" name="prenom" value={form.prenom} onChange={handleChange} placeholder="Jean" required className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="vous@pasteur.mg" required className={inputCls} /></div>
        <div><label className={labelCls}>Mot de passe</label>
          <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Minimum 8 caractères" required className={inputCls} /></div>
        <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center mt-2">
          {isLoading ? <><Spinner size={15} /> Envoi…</> : 'Envoyer la demande'}
        </button>
      </form>

      <p className="text-center text-xs text-fg-subtle mt-5">
        Déjà un compte ?{' '}
        <Link to="/login" className="text-primary hover:brightness-110 font-semibold">Se connecter</Link>
      </p>
    </div>
  );
}
