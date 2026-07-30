// frontend/src/api/axios.js
// Instance Axios centralisée avec gestion automatique du token JWT

import axios from 'axios';
import { toast } from '../lib/toast';
import useConnectionStore from '../store/connectionStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Intercepteur requête — ajoute le token JWT automatiquement
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Garde : évite d'empiler redirections + toasts quand plusieurs requêtes
// échouent en 401 simultanément (F3).
let isRedirecting401 = false;

// Intercepteur réponse — gestion centralisée des erreurs
api.interceptors.response.use(
  (response) => {
    // Toute requête qui aboutit prouve que le serveur est de nouveau joignable
    useConnectionStore.getState().setUp();
    return response;
  },
  (error) => {
    const status  = error.response?.status;
    const message = error.response?.data?.error;

    if (!error.response) {
      // Aucune réponse du tout : panne réseau, backend injoignable, timeout,
      // CORS bloqué… — signalé via <ConnectionBanner />, pas un toast (qui
      // spammerait un message par requête en échec au lieu d'un état global).
      useConnectionStore.getState().setDown();
    } else if (status === 401) {
      // Session expirée ou token invalide → redirection login (une seule fois)
      if (!isRedirecting401) {
        isRedirecting401 = true;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        toast.warning('Session expirée — veuillez vous reconnecter.');
        setTimeout(() => { window.location.href = '/login'; }, 1200);
      }
    } else if (status === 429) {
      // Rate limit atteint
      toast.error(message || 'Trop de tentatives — réessayez dans quelques minutes.');
    } else if (status >= 500) {
      // Erreur serveur inattendue
      toast.error('Erreur serveur inattendue. Veuillez réessayer.');
    }
    // Les erreurs 400/403/404/409 sont gérées localement par chaque composant

    return Promise.reject(error);
  }
);

export default api;
