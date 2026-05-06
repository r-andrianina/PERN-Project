import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, PawPrint, Stethoscope, FileText, Check, Loader2 } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';

export default function NouvelHote() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    methodeId:       searchParams.get('methodeId') || '',
    taxonomieHoteId: '',
    especeLocale:    '',
    age:             '',
    sexe:            'inconnu',
    etatSante:       '',
    vaccination:     '',
    notes:           '',
  });

  const [methodes, setMethodes]       = useState([]);
  const [taxonomies, setTaxonomies]   = useState([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [errors, setErrors]           = useState({});

  useEffect(() => {
    Promise.all([
      api.get('/methodes'),
      api.get('/dictionnaire/taxonomie-hotes', { params: { niveau: 'espece', actif: 'true' } }),
    ]).then(([mRes, tRes]) => {
      setMethodes(mRes.data.methodes || []);
      setTaxonomies(tRes.data.items  || []);
    }).catch(console.error);
  }, []);

  const handleChange = (e) => {
    setErrors({ ...errors, [e.target.name]: null });
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const errs = {};
    if (!form.methodeId)       errs.methodeId       = 'La méthode de collecte est obligatoire';
    if (!form.taxonomieHoteId) errs.taxonomieHoteId = 'L\'espèce hôte est obligatoire';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await api.post('/hotes', {
        methodeId:       parseInt(form.methodeId),
        taxonomieHoteId: parseInt(form.taxonomieHoteId),
        especeLocale:    form.especeLocale || null,
        age:             form.age          || null,
        sexe:            form.sexe,
        etatSante:       form.etatSante    || null,
        vaccination:     form.vaccination  || null,
        notes:           form.notes        || null,
      });
      navigate('/hotes');
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Erreur lors de la création' });
    } finally {
      setIsLoading(false);
    }
  };

  const methodeOptions   = methodes.map((m) => ({
    value: m.id,
    label: `${m.typeMethode?.nom || 'Méthode'} — ${m.localite?.nom || ''}`,
  }));
  const taxonomieOptions = taxonomies.map((t) => ({
    value: t.id,
    label: `${t.parent ? t.parent.nom + ' ' : ''}${t.nom}${t.nomCommun ? ' (' + t.nomCommun + ')' : ''}`,
  }));
  const sexeOptions = [
    { value: 'M', label: 'Mâle' },
    { value: 'F', label: 'Femelle' },
    { value: 'inconnu', label: 'Inconnu' },
  ];
  const etatOptions = [
    { value: 'Bon',     label: 'Bon' },
    { value: 'Moyen',   label: 'Moyen' },
    { value: 'Mauvais', label: 'Mauvais' },
    { value: 'Mort',    label: 'Mort' },
  ];

  return (
    <div className="max-w-3xl space-y-5">
      <Link to="/hotes" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
        <ChevronLeft size={16} /> Hôtes
      </Link>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errors.submit && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600">{errors.submit}</div>
        )}

        <div className="card p-6">
          <h2 className="section-title">
            <PawPrint size={17} className="text-amber-600" /> Identification
          </h2>
          <div className="space-y-4">
            <FormField
              label="Méthode de collecte" name="methodeId" type="select"
              value={form.methodeId} onChange={handleChange}
              options={methodeOptions} required error={errors.methodeId}
            />
            <FormField
              label="Espèce hôte (référentiel)" name="taxonomieHoteId" type="select"
              value={form.taxonomieHoteId} onChange={handleChange}
              options={taxonomieOptions} required error={errors.taxonomieHoteId}
              hint="Sélection obligatoire depuis le dictionnaire"
            />
            <FormField
              label="Espèce locale (nom vernaculaire)" name="especeLocale"
              value={form.especeLocale} onChange={handleChange}
              placeholder="ex: Voalavo, Andriaka..."
              hint="Nom local malgache si applicable"
            />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="section-title">
            <Stethoscope size={17} className="text-emerald-500" /> Caractéristiques
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Sexe" name="sexe" type="select" value={form.sexe} onChange={handleChange} options={sexeOptions} />
            <FormField label="Âge" name="age" value={form.age} onChange={handleChange} placeholder="ex: Adulte, Juvénile, 6 mois" />
            <FormField label="État de santé" name="etatSante" type="select" value={form.etatSante} onChange={handleChange} options={etatOptions} />
          </div>
          <div className="mt-4">
            <FormField
              label="Vaccination" name="vaccination" type="textarea"
              value={form.vaccination} onChange={handleChange}
              placeholder="Vaccins reçus, date du dernier rappel, etc."
            />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="section-title">
            <FileText size={17} className="text-gray-400" /> Notes
          </h2>
          <FormField name="notes" type="textarea" value={form.notes} onChange={handleChange}
            placeholder="Conditions de capture, comportement, observations particulières..." />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to="/hotes" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading
              ? <><Loader2 size={15} className="animate-spin" /> Enregistrement...</>
              : <><Check size={15} /> Enregistrer l'hôte</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
