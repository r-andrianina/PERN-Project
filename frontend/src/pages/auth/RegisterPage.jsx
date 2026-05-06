import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../../api/axios';

export default function RegisterPage() {
  const [form, setForm]           = useState({ nom: '', prenom: '', email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(false);

  const handleChange = (e) => {
    setError(null);
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('/auth/register', form);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'inscription");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-colors";
  const labelClass = "block text-xs font-semibold text-gray-600 tracking-wide mb-1.5";

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-primary-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-100 rounded-2xl mb-4">
            <CheckCircle2 size={28} className="text-primary-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-800 mb-2">Inscription envoyée !</h2>
          <p className="text-sm text-gray-500 mb-6">
            Votre demande a été transmise. Un administrateur validera votre compte prochainement.
          </p>
          <Link to="/login" className="btn-primary justify-center w-full">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-primary-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/15 rounded-2xl mb-4 ring-1 ring-white/20">
            <FlaskConical size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SpécimenManager</h1>
          <p className="text-primary-200 text-sm mt-1.5">Institut Pasteur de Madagascar</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-7">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Demande d'accès</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Nom</label>
                <input type="text" name="nom" value={form.nom}
                  onChange={handleChange} placeholder="RAKOTO" required
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Prénom</label>
                <input type="text" name="prenom" value={form.prenom}
                  onChange={handleChange} placeholder="Jean" required
                  className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input type="email" name="email" value={form.email}
                onChange={handleChange} placeholder="vous@pasteur.mg" required
                className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Mot de passe</label>
              <input type="password" name="password" value={form.password}
                onChange={handleChange} placeholder="Minimum 8 caractères" required
                className={inputClass} />
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center mt-2">
              {isLoading
                ? <><Loader2 size={15} className="animate-spin" /> Envoi...</>
                : "Envoyer la demande"
              }
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-5">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
