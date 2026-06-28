import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // En production, envoyer vers un service de monitoring (ex: Sentry)
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const isDev  = import.meta.env.DEV;
    const msg    = this.state.error?.message;

    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="bg-surface border border-border rounded-2xl shadow-card-lg w-full max-w-md overflow-hidden">
          <div className="h-1 w-full bg-danger/30" />

          <div className="px-8 py-8 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center mb-5">
              <AlertTriangle size={26} className="text-danger" />
            </div>

            <h1 className="text-base font-bold text-fg leading-tight">
              Une erreur inattendue s'est produite
            </h1>
            <p className="text-sm text-fg-muted mt-2 leading-relaxed">
              L'application a rencontré un problème. Rechargez la page ou revenez au tableau de bord.
            </p>

            {isDev && msg && (
              <pre className="mt-4 text-left text-[11px] text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 overflow-auto max-h-32 whitespace-pre-wrap break-all">
                {msg}
              </pre>
            )}
          </div>

          <div className="mx-6 h-px bg-border" />

          <div className="px-6 py-4 flex items-center justify-end gap-2.5">
            <a
              href="/dashboard"
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              <Home size={14} /> Tableau de bord
            </a>
            <button
              type="button"
              className="btn-primary text-sm flex items-center gap-1.5"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={14} /> Recharger
            </button>
          </div>
        </div>
      </div>
    );
  }
}
