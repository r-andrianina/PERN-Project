// frontend/src/store/authStore.js
// État global d'authentification avec Zustand

import { create } from 'zustand';
import api from '../api/axios';

const useAuthStore = create((set) => ({
  // État initial — récupéré depuis localStorage si déjà connecté
  user:  JSON.parse(localStorage.getItem('user'))  || null,
  token: localStorage.getItem('token') || null,
  isLoading: false,
  error: null,
  isNetworkError: false,

  // =============================================================
  //  LOGIN
  // =============================================================
  login: async (email, password) => {
    set({ isLoading: true, error: null, isNetworkError: false });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;

      // Persister dans localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // user contient déjà specimensAutorises depuis la réponse login
      set({ token, user, isLoading: false, error: null, isNetworkError: false });
      return { success: true };

    } catch (err) {
      // Pas de réponse du tout (panne réseau/serveur injoignable/timeout) vs
      // une réponse HTTP avec un message métier (identifiants invalides…) —
      // deux cas très différents, affichés différemment par LoginPage.
      const isNetworkError = !err.response;
      const message = err.response?.data?.error || 'Erreur de connexion';
      set({ isLoading: false, error: message, isNetworkError });
      return { success: false, error: message, isNetworkError };
    }
  },

  // =============================================================
  //  LOGOUT
  // =============================================================
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, error: null });
  },

  // =============================================================
  //  UPDATE USER (SSE permissions_changed)
  //  Met à jour les données utilisateur en mémoire + localStorage
  //  sans forcer une reconnexion complète.
  // =============================================================
  updateUser: (patch) =>
    set((state) => {
      const updated = { ...state.user, ...patch };
      localStorage.setItem('user', JSON.stringify(updated));
      return { user: updated };
    }),

  // =============================================================
  //  CLEAR ERROR
  // =============================================================
  clearError: () => set({ error: null, isNetworkError: false }),
}));

export default useAuthStore;