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

  // =============================================================
  //  LOGIN
  // =============================================================
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;

      // Persister dans localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      set({ token, user, isLoading: false, error: null });
      return { success: true };

    } catch (err) {
      const message = err.response?.data?.error || 'Erreur de connexion';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
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
  //  CLEAR ERROR
  // =============================================================
  clearError: () => set({ error: null }),
}));

export default useAuthStore;