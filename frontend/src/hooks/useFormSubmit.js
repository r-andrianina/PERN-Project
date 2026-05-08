// useFormSubmit — gestion complète d'un formulaire.
//
// Usage :
//   const { form, setField, handleChange, errors, isLoading, handleSubmit } = useFormSubmit({
//     initial:   { code: '', nom: '' },
//     validate:  (f) => ({
//       code: !f.code && 'Code obligatoire',
//       nom:  !f.nom  && 'Nom obligatoire',
//     }),
//     onSubmit:  (f) => api.post('/projets', f),
//     onSuccess: (result) => navigate(`/projets/${result.projet.id}`),
//   });
//
//   <form onSubmit={handleSubmit}>
//     <FormField name="code" value={form.code} onChange={handleChange} error={errors.code} />
//     {errors.submit && <p className="text-danger">{errors.submit}</p>}
//     <Button type="submit" loading={isLoading}>Créer</Button>
//   </form>

import { useState, useCallback } from 'react';

/**
 * @param {object} opts
 * @param {object}   opts.initial         État initial du formulaire
 * @param {function} [opts.validate]      (form) => { champ: 'message' | false }
 * @param {function} opts.onSubmit        async (form) => result — doit rejeter en cas d'erreur
 * @param {function} [opts.onSuccess]     (result) => void
 * @param {boolean}  [opts.resetOnSuccess] Réinitialiser le form après succès (défaut: false)
 */
export function useFormSubmit({ initial, validate, onSubmit, onSuccess, resetOnSuccess = false }) {
  const [form, setForm]         = useState(initial);
  const [errors, setErrors]     = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Mettre à jour un champ par nom + effacer son erreur
  const setField = useCallback((name, value) => {
    setErrors((e) => ({ ...e, [name]: null }));
    setForm((f) => ({ ...f, [name]: value }));
  }, []);

  // Handler natif pour input/select/textarea
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setField(name, type === 'checkbox' ? checked : value);
  }, [setField]);

  // Exécuter la validation, renseigner les erreurs, retourner true si OK
  const runValidate = useCallback(() => {
    if (!validate) return true;
    const raw = validate(form);
    if (!raw) return true;
    const errs = Object.fromEntries(Object.entries(raw).filter(([, v]) => !!v));
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return false;
    }
    return true;
  }, [form, validate]);

  // Soumettre le formulaire
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!runValidate()) return false;

    setIsLoading(true);
    try {
      const result = await onSubmit(form);
      if (resetOnSuccess) { setForm(initial); setErrors({}); }
      onSuccess?.(result);
      return true;
    } catch (err) {
      const message = err.response?.data?.error || 'Une erreur est survenue';
      setErrors((prev) => ({ ...prev, submit: message }));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [form, onSubmit, onSuccess, resetOnSuccess, runValidate, initial]);

  // Réinitialisation manuelle
  const reset = useCallback(() => {
    setForm(initial);
    setErrors({});
  }, [initial]);

  return {
    form, setForm,         // état brut + setter complet
    setField,              // setter par clé
    handleChange,          // handler onChange natif
    errors, setErrors,     // erreurs
    isLoading,             // état soumission
    handleSubmit,          // handler onSubmit
    reset,                 // réinitialisation
  };
}
