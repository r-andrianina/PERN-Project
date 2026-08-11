// Écran affiché quand React Router n'arrive pas à rendre une route — que ce
// soit un vrai bug (erreur JS pendant le rendu) ou, cas le plus fréquent en
// pratique, un échec de chargement d'un chunk lazy() : l'appli a été
// redéployée pendant qu'un onglet restait ouvert, les anciens fichiers JS
// n'existent plus, et le navigateur ne peut plus les récupérer. Un simple
// rechargement de page résout ce second cas — c'est justement ce que
// l'écran par défaut de React Router n'explique pas.

import { useRouteError } from 'react-router-dom';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useT } from '../lib/i18n';

const CHUNK_LOAD_PATTERN = /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i;

export default function RouteErrorBoundary() {
  const t = useT();
  const error = useRouteError();
  const message = error?.message || String(error ?? '');
  const isChunkLoadError = CHUNK_LOAD_PATTERN.test(message);

  const reload = () => window.location.reload();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-primary-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl mb-4 shadow-lg">
            <img src="/icons/logo.png" alt="SpécimenManager" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SpécimenManager</h1>
        </div>

        <div className="bg-surface rounded-2xl shadow-2xl p-7 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-warning/10 mb-4">
            {isChunkLoadError
              ? <RefreshCw size={22} className="text-warning" />
              : <AlertTriangle size={22} className="text-warning" />
            }
          </div>

          {isChunkLoadError ? (
            <>
              <h2 className="text-base font-semibold text-fg mb-2">{t('routeError.chunkTitle')}</h2>
              <p className="text-sm text-fg-subtle leading-relaxed mb-5">
                {t('routeError.chunkMessage')}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-fg mb-2">{t('routeError.genericTitle')}</h2>
              <p className="text-sm text-fg-subtle leading-relaxed mb-5">
                {t('routeError.genericMessage')}
              </p>
            </>
          )}

          <button type="button" onClick={reload} className="btn-primary w-full justify-center">
            <RefreshCw size={15} /> {t('routeError.reloadPage')}
          </button>

          {!isChunkLoadError && message && (
            <p className="text-[10px] text-fg-subtle/70 font-mono mt-4 break-words">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
