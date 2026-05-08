import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, PawPrint, Stethoscope, FileText } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import { useFormSubmit, useApiQueries } from '../../hooks';

export default function NouvelHote() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { results, loading: loadingRefs } = useApiQueries([
    { url: '/methodes',                                                key: 'methodes',   select: (r) => r.methodes ?? [] },
    { url: '/dictionnaire/taxonomie-hotes', params: { niveau: 'espece', actif: 'true' }, key: 'taxonomies', select: (r) => r.items ?? [] },
  ]);
  const methodes   = results.methodes   ?? [];
  const taxonomies = results.taxonomies ?? [];

  const { form, handleChange, errors, isLoading, handleSubmit } = useFormSubmit({
    initial: {
      methodeId:       searchParams.get('methodeId') || '',
      taxonomieHoteId: '',
      especeLocale:    '',
      age:             '',
      sexe:            'inconnu',
      etatSante:       '',
      vaccination:     '',
      notes:           '',
    },
    validate: (f) => ({
      methodeId:       !f.methodeId       && 'La méthode de collecte est obligatoire',
      taxonomieHoteId: !f.taxonomieHoteId && "L'espèce hôte est obligatoire",
    }),
    onSubmit: (f) => api.post('/hotes', {
      methodeId:       parseInt(f.methodeId),
      taxonomieHoteId: parseInt(f.taxonomieHoteId),
      especeLocale:    f.especeLocale || null,
      age:             f.age          || null,
      sexe:            f.sexe,
      etatSante:       f.etatSante    || null,
      vaccination:     f.vaccination  || null,
      notes:           f.notes        || null,
    }),
    onSuccess: () => navigate('/hotes'),
  });

  const methodeOptions   = methodes.map((m) => ({ value: m.id, label: `${m.typeMethode?.nom || 'Méthode'} — ${m.localite?.nom || ''}` }));
  const taxonomieOptions = taxonomies.map((t) => ({ value: t.id, label: `${t.parent ? t.parent.nom + ' ' : ''}${t.nom}${t.nomCommun ? ' (' + t.nomCommun + ')' : ''}` }));
  const sexeOptions = [{ value: 'M', label: 'Mâle' }, { value: 'F', label: 'Femelle' }, { value: 'inconnu', label: 'Inconnu' }];
  const etatOptions = [{ value: 'Bon', label: 'Bon' }, { value: 'Moyen', label: 'Moyen' }, { value: 'Mauvais', label: 'Mauvais' }, { value: 'Mort', label: 'Mort' }];

  return (
    <div className="max-w-3xl space-y-5">
      <Link to="/hotes" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> Hôtes
      </Link>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errors.submit && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-sm text-danger">{errors.submit}</div>
        )}

        <div className="card p-6">
          <h2 className="section-title"><PawPrint size={17} className="text-warning" /> Identification</h2>
          <div className="space-y-4">
            <FormField label="Méthode de collecte" name="methodeId" type="select"
              value={form.methodeId} onChange={handleChange}
              options={methodeOptions} required error={errors.methodeId} disabled={loadingRefs} />
            <FormField label="Espèce hôte (référentiel)" name="taxonomieHoteId" type="select"
              value={form.taxonomieHoteId} onChange={handleChange}
              options={taxonomieOptions} required error={errors.taxonomieHoteId}
              hint="Sélection obligatoire depuis le dictionnaire" disabled={loadingRefs} />
            <FormField label="Espèce locale (nom vernaculaire)" name="especeLocale"
              value={form.especeLocale} onChange={handleChange}
              placeholder="ex: Voalavo, Andriaka…" hint="Nom local malgache si applicable" />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="section-title"><Stethoscope size={17} className="text-success" /> Caractéristiques</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Sexe" name="sexe" type="select" value={form.sexe} onChange={handleChange} options={sexeOptions} />
            <FormField label="Âge" name="age" value={form.age} onChange={handleChange} placeholder="ex: Adulte, Juvénile" />
            <FormField label="État de santé" name="etatSante" type="select" value={form.etatSante} onChange={handleChange} options={etatOptions} />
          </div>
          <div className="mt-4">
            <FormField label="Vaccination" name="vaccination" type="textarea"
              value={form.vaccination} onChange={handleChange}
              placeholder="Vaccins reçus, date du dernier rappel, etc." />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="section-title"><FileText size={17} className="text-fg-subtle" /> Notes</h2>
          <FormField name="notes" type="textarea" value={form.notes} onChange={handleChange}
            placeholder="Conditions de capture, comportement, observations particulières..." />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to="/hotes" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={isLoading || loadingRefs} className="btn-primary">
            {isLoading ? 'Enregistrement…' : "Enregistrer l'hôte"}
          </button>
        </div>
      </form>
    </div>
  );
}
