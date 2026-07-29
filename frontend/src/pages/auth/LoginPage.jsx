import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, WifiOff, RotateCw, HelpCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { Spinner } from '../../components/ui';

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-border-strong rounded-xl bg-surface text-fg hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

export default function LoginPage() {
  const [form, setForm]         = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { login, isLoading, error, isNetworkError, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleChange = (e) => {
    clearError();
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(form.email, form.password);
    if (result.success) navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-primary-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl mb-4 shadow-lg">
            <img src="/icons/logo.png" alt="SpécimenManager" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SpécimenManager</h1>
          <p className="text-primary-200 text-sm mt-1.5">Unité Entomologie Médicale</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-2xl p-7">
          <h2 className="text-base font-semibold text-fg mb-5">Connexion</h2>

          {error && isNetworkError && (
            <div className="mb-4 p-3.5 bg-warning/10 border border-warning/25 rounded-xl">
              <div className="flex items-start gap-2.5">
                <WifiOff size={16} className="text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fg">Impossible de joindre le serveur</p>
                  <p className="text-xs text-fg-subtle mt-1 leading-relaxed">
                    Vérifiez votre connexion réseau — si vous êtes hors du réseau IPM,
                    assurez-vous d'être connecté en VPN/Tailscale.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSubmit({ preventDefault: () => {} })}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning hover:brightness-90 mt-2"
                  >
                    <RotateCw size={12} className={isLoading ? 'animate-spin' : ''} /> Réessayer
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && !isNetworkError && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl flex items-start gap-2.5">
              <AlertCircle size={15} className="text-danger flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-fg-muted tracking-wide">Adresse email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="vous@pasteur.mg" required autoComplete="email" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-fg-muted tracking-wide">Mot de passe</label>
                <button type="button" onClick={() => setShowForgot(!showForgot)}
                  className="text-xs font-medium text-primary hover:brightness-110">
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password" value={form.password} onChange={handleChange}
                  placeholder="••••••••" required autoComplete="current-password"
                  className={`${inputCls} pr-10`}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {showForgot && (
                <div className="p-3 bg-info/10 border border-info/20 rounded-xl flex items-start gap-2.5">
                  <HelpCircle size={15} className="text-info flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-fg-muted leading-relaxed">
                    Contactez un administrateur de l'application — il peut réinitialiser votre mot de passe depuis la gestion des utilisateurs.
                  </p>
                </div>
              )}
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center mt-2">
              {isLoading ? <><Spinner size={15} /> Connexion…</> : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-xs text-fg-subtle mt-5">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-primary hover:brightness-110 font-semibold">
              Demander un accès
            </Link>
          </p>
        </div>

        <p className="text-center text-primary-300 text-xs mt-6">
          © 2026 Henintsoa Andrianina — Institut Pasteur Madagascar
        </p>
      </div>
    </div>
  );
}
