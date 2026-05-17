import { create } from 'zustand';

const useLangStore = create((set) => ({
  lang: localStorage.getItem('sm_lang') || 'fr',
  setLang: (lang) => {
    localStorage.setItem('sm_lang', lang);
    set({ lang });
  },
}));

export default useLangStore;
