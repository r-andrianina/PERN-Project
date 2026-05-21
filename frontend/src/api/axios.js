// frontend/src/api/axios.js
// Instance Axios centralisée avec gestion automatique du token JWT

import axios from 'axios';
import { toast } from '../lib/toast';

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

// Intercepteur réponse — gestion centralisée des erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status;
    const message = error.response?.data?.error;

    if (status === 401) {
      // Session expirée ou token invalide → redirection login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      toast.warning('Session expirée — veuillez vous reconnecter.');
      setTimeout(() => { window.location.href = '/login'; }, 1200);
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
