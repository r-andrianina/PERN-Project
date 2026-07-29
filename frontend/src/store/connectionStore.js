// frontend/src/store/connectionStore.js
// État global "le serveur est-il joignable ?" — alimenté par l'intercepteur
// Axios (src/api/axios.js) : passe à `down` dès qu'une requête échoue sans
// réponse du tout (panne réseau, backend injoignable, timeout), et revient
// à `up` dès qu'une requête aboutit. Consommé par <ConnectionBanner />.

import { create } from 'zustand';

const useConnectionStore = create((set) => ({
  isDown: false,
  setDown: () => set({ isDown: true }),
  setUp:   () => set({ isDown: false }),
}));

export default useConnectionStore;
