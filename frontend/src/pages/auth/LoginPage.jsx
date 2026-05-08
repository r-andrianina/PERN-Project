import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FlaskConical, Eye, EyeOff, AlertCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { Button, Spinner } from '../../components/ui';

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-border-strong rounded-xl bg-surface text-fg hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

export default function LoginPage() {
  const [form, setForm]         = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();
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
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/15 rounded-2xl mb-4 ring-1 ring-white/20">
            <FlaskConical size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SpécimenManager</h1>
          <p className="text-primary-200 text-sm mt-1.5">Institut Pasteur de Madagascar</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-2xl p-7">
          <h2 className="text-base font-semibold text-fg mb-5">Connexion</h2>

          {error && (
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
              <label className="block text-xs font-semibold text-fg-muted tracking-wide">Mot de passe</label>
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
