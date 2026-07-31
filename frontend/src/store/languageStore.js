import { create } from 'zustand';

const VALID_LANGS = ['fr', 'en'];

const stored = localStorage.getItem('sm_lang');
const initialLang = VALID_LANGS.includes(stored) ? stored : 'en';

const useLangStore = create((set) => ({
  lang: initialLang,
  setLang: (lang) => {
    if (!VALID_LANGS.includes(lang)) return;
    localStorage.setItem('sm_lang', lang);
    set({ lang });
  },
}));

export default useLangStore;
