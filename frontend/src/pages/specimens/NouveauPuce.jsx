import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Bug, Microscope, FlaskConical, FileText, PawPrint, Check, Loader2 } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import BoiteTubes from '../../components/BoiteTubes';

export default function NouveauPuce() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    methodeId: '', hoteId: '', taxonomieId: '',
    nombre: '1', sexe: 'inconnu', stade: '',
    solutionId: '', contenant: '',
    positionPlaque: '', dateCollecte: '', notes: '',
  });

  const [methodes,   setMethodes]   = useState([]);
  const [hotes,      setHotes]      = useState([]);
  const [taxonomies, setTaxonomies] = useState([]);
  const [solutions,  setSolutions]  = useState([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [errors,     setErrors]     = useState({});

  useEffect(() => {
    Promise.all([
      api.get('/methodes'),
      api.get('/hotes').catch(() => ({ data: { hotes: [] } })),
      api.get('/dictionnaire/taxonomie-specimens', { params: { type: 'puce', niveau: 'espece', actif: 'true' } }),
      api.get('/dictionnaire/solutions-conservation', { params: { actif: 'true' } }),
    ]).then(([mRes, hRes, tRes, sRes]) => {
      setMethodes(mRes.data.methodes || []);
      setHotes(hRes.data.hotes        || []);
      setTaxonomies(tRes.data.items   || []);
      setSolutions(sRes.data.items    || []);
    }).catch(console.error);
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setErrors({ ...errors, [name]: null });
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const validate = () => {
    const errs = {};
    if (!form.methodeId)   errs.methodeId   = 'La méthode de collecte est obligatoire';
    if (!form.taxonomieId) errs.taxonomieId = 'La taxonomie est obligatoire (référentiel)';
    if (!form.nombre || parseInt(form.nombre) < 1) errs.nombre = 'Nombre invalide';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await api.post('/puces', {
        ...form,
        methodeId:    parseInt(form.methodeId),
        hoteId:       form.hoteId ? parseInt(form.hoteId) : null,
        taxonomieId:  parseInt(form.taxonomieId),
        solutionId:   form.solutionId ? parseInt(form.solutionId) : null,
        nombre:       parseInt(form.nombre),
        dateCollecte: form.dateCollecte || null,
      });
      navigate('/specimens/puces');
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Erreur lors de la création' });
    } finally {
      setIsLoading(false);
    }
  };

  const methodeOptions   = methodes.map(m => ({
    value: m.id, label: `${m.typeMethode?.nom || 'Méthode'} — ${m.localite?.nom || ''}`,
  }));
  const hoteOptions      = hotes.map(h => ({
    value: h.id,
    label: `${h.taxonomieHote?.nom || 'Hôte'}${h.especeLocale ? ' — ' + h.especeLocale : ''}`,
  }));
  const taxonomieOptions = taxonomies.map(t => ({
    value: t.id, label: t.parent ? `${t.parent.nom} ${t.nom}` : t.nom,
  }));
  const solutionOptions  = solutions.map(s => ({ value: s.id, label: `${s.nom}${s.temperature ? ' (' + s.temperature + ')' : ''}` }));
  const sexeOptions  = [{ value:'M', label:'Mâle' }, { value:'F', label:'Femelle' }, { value:'inconnu', label:'Inconnu' }];
  const stadeOptions = [{ value:'Adulte', label:'Adulte' }, { value:'Nymphe', label:'Nymphe' }, { value:'Larve', label:'Larve' }, { value:'Oeuf', label:'Oeuf' }];

  return (
    <div className="max-w-4xl space-y-5">
      <Link to="/specimens/puces" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
        <ChevronLeft size={16} /> Puces
      </Link>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errors.submit && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600">{errors.submit}</div>
        )}

        <div className="card p-6">
          <h2 className="section-title">
            <Bug size={17} className="text-amber-600" />
            Identification du spécimen
          </h2>
          <div className="space-y-4">
            <FormField label="Méthode de collecte" name="methodeId" type="select"
              value={form.methodeId} onChange={handleChange}
              options={methodeOptions} required error={errors.methodeId} />
            <FormField label="Espèce (référentiel)" name="taxonomieId" type="select"
              value={form.taxonomieId} onChange={handleChange}
              options={taxonomieOptions} required error={errors.taxonomieId}
              hint="Sélection obligatoire depuis le dictionnaire" />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="section-title">
            <PawPrint size={17} className="text-amber-500" />
            Hôte associé
          </h2>
          <FormField label="Hôte" name="hoteId" type="select"
            value={form.hoteId} onChange={handleChange} options={hoteOptions}
            hint="Animal hôte sur lequel la puce a été prélevée" />
        </div>

        <div className="card p-6">
          <h2 className="section-title">
            <Microscope size={17} className="text-blue-500" />
            Morphologie
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <FormField label="Nombre" name="nombre" type="number" value={form.nombre} onChange={handleChange} required error={errors.nombre} />
            <FormField label="Sexe" name="sexe" type="select" value={form.sexe} onChange={handleChange} options={sexeOptions} />
            <FormField label="Stade" name="stade" type="select" value={form.stade} onChange={handleChange} options={stadeOptions} />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="section-title">
            <FlaskConical size={17} className="text-purple-500" />
            Conservation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <FormField label="Solution de conservation" name="solutionId" type="select" value={form.solutionId} onChange={handleChange} options={solutionOptions} />
            <FormField label="Contenant" name="contenant" value={form.contenant} onChange={handleChange} placeholder="ex: Tube cryogénique 1.8ml" />
            <FormField label="Date de collecte" name="dateCollecte" type="date" value={form.dateCollecte} onChange={handleChange} />
          </div>
          <BoiteTubes value={form.positionPlaque} onChange={(pos) => setForm({ ...form, positionPlaque: pos })} />
        </div>

        <div className="card p-6">
          <h2 className="section-title">
            <FileText size={17} className="text-gray-400" />
            Notes et observations
          </h2>
          <FormField name="notes" type="textarea" value={form.notes} onChange={handleChange}
            placeholder="Conditions de collecte, état du spécimen..." />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to="/specimens/puces" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading
              ? <><Loader2 size={15} className="animate-spin" /> Enregistrement...</>
              : <><Check size={15} /> Enregistrer la puce</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
