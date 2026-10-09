// « + Ajouter une personne » — crée une fiche du dictionnaire Personnel sans
// quitter le formulaire de mission. Remplace l'ancien texte libre « personne
// externe » : la personne n'est saisie qu'une fois, puis choisie dans la liste.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../FormField';
import { toast } from '../../lib/toast';
import { useT, interpolate } from '../../lib/i18n';
import { PERSONNEL_URL } from './usePersonnel';

/**
 * @param {object}   props
 * @param {string}   [props.nomInitial] texte déjà tapé dans la recherche
 * @param {string[]} [props.equipes]    équipes existantes, proposées en saisie
 * @param {(item) => void} props.onCreated
 * @param {() => void}     props.onClose
 */
export default function AjoutPersonnelModal({ nomInitial = '', equipes = [], onCreated, onClose }) {
  const t = useT();
  const [form, setForm] = useState({ nom: nomInitial, fonction: '', equipe: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Formulaire imbriqué dans celui de la mission : sans stopPropagation, le
  // submit remonterait jusqu'au formulaire parent et créerait la mission.
  const submit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setLoading(true);
    try {
      const r = await api.post(PERSONNEL_URL, form);
      toast.success(interpolate(t('personnel.created'), { nom: r.data.item.nom }));
      onCreated(r.data.item);
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  // Portail : la modale peut s'ouvrir depuis une autre modale (édition de
  // mission) dont le conteneur défile et rognerait celle-ci.
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 my-4 sm:mt-24">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-fg flex items-center gap-2">
            <UserPlus size={16} className="text-primary" /> {t('personnel.addTitle')}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-fg-subtle hover:text-fg">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-fg-subtle">{t('personnel.addHint')}</p>

        {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs text-danger">{error}</div>}

        <FormField label={t('personnel.fieldNom')} name="nom" value={form.nom} onChange={change}
          required hint={t('personnel.fieldNomHint')} />
        <FormField label={t('personnel.fieldFonction')} name="fonction" value={form.fonction} onChange={change}
          placeholder={t('personnel.fieldFonctionPlaceholder')} />
        <div className="space-y-1.5">
          <label htmlFor="ajout-personnel-equipe" className="block text-xs font-semibold text-fg-muted tracking-wide">
            {t('personnel.fieldEquipe')}
          </label>
          <input
            id="ajout-personnel-equipe" name="equipe" list="ajout-personnel-equipes"
            value={form.equipe} onChange={change}
            className="w-full text-sm rounded-xl border border-border-strong bg-surface text-fg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <datalist id="ajout-personnel-equipes">
            {equipes.map((e) => <option key={e} value={e} />)}
          </datalist>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          <button type="submit" disabled={loading || !form.nom.trim()} className="btn-primary">
            {t('personnel.addSubmit')}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
