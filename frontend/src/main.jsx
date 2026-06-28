// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import router from './router/index';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmDialogProvider } from './components/ui/ConfirmDialog';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

const queryClient = new QueryClient({
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
