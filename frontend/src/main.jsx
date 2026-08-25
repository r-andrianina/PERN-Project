// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import router from './router/index';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmDialogProvider } from './components/ui/ConfirmDialog';
import ErrorBoundary from './components/ErrorBoundary';
import { toast } from './lib/toast';
import './index.css';

// Statuts volontairement laissés à la charge de chaque appelant par
// l'intercepteur Axios (src/api/axios.js) — 401/429/5xx et pannes réseau y
// sont déjà gérés (toast + redirection ou <ConnectionBanner />). En pratique
// aucun composant utilisant useApiQuery/useApiQueries ne lisait jamais le
// champ `error` du hook (vérifié : aucun des ~20 appels ne le déstructure) —
// un 403 IDOR ou un 404 sur une page liste/détail passait donc totalement
// inaperçu, affichant un simple état "aucune donnée" indiscernable d'une
// vraie liste vide. Ce toast générique couvre tous les appels en lecture
// (présents ET futurs) sans avoir à toucher chaque page individuellement.
const LOCAL_ERROR_STATUSES = new Set([400, 403, 404, 409]);

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      const status = error?.response?.status;
      if (status && LOCAL_ERROR_STATUSES.has(status)) {
        toast.error(error.response?.data?.error ?? 'Erreur lors du chargement des données.');
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime:           30_000, // 30 s
      retry:               1,
      refetchOnWindowFocus: false, // pas de refetch intempestif au retour d'onglet
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ConfirmDialogProvider>
            <RouterProvider router={router} />
          </ConfirmDialogProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
