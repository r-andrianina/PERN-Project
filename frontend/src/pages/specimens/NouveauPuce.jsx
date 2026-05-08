import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Bug, Microscope, FlaskConical, FileText, PawPrint, Check, Loader2, Info } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import MethodeCascade from '../../components/MethodeCascade';
import IdTerrainField from '../../components/IdTerrainField';
import ContainerSelector from '../../components/ContainerSelector';

export default function NouveauPuce() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    methodeId: '', hoteId: '', taxonomieId: '', idTerrain: '',
    nombre: '1', sexe: 'inconnu', stade: '',
    solutionId: '',
    containerId: '', position: '', insertMode: 'single',
    dateCollecte: '', notes: '',
  });
  const [missionId, setMissionId] = useState(null);
  const [hotes,      setHotes]      = useState([]);
  const [taxonomies, setTaxonomies] = useState([]);
  const [solutions,  setSolutions]  = useState([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [errors,     setErrors]     = useState({});

  useEffect(() => {
    Promise.all([
      api.get('/hotes').catch(() => ({ data: { hotes: [] } })),
      api.get('/dictionnaire/taxonomie-specimens', { params: { type: 'puce', niveau: 'espece', actif: 'true' } }),
      api.get('/dictionnaire/solutions-conservation', { params: { actif: 'true' } }),
    ]).then(([hRes, tRes, sRes]) => {
      setHotes(hRes.data.hotes      || []);
      setTaxonomies(tRes.data.items || []);
      setSolutions(sRes.data.items  || []);
    }).catch(console.error);
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setErrors({ ...errors, [name]: null });
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  // ── Cascade : Stade larvaire/œuf → Sexe désactivé ──
  const stadeImmature = form.stade === 'Larve' || form.stade === 'Oeuf';
  const sexeDisabled  = stadeImmature;
  const sexeForce     = stadeImmature ? 'inconnu' : form.sexe;

  useEffect(() => {
    setForm((f) => sexeDisabled && f.sexe !== 'inconnu' ? { ...f, sexe: 'inconnu' } : f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.stade]);

  const validate = () => {
    const errs = {};
    if (!form.methodeId)   errs.methodeId   = 'La méthode de collecte est obligatoire';
    if (!form.taxonomieId) errs.taxonomieId = 'La taxonomie est obligatoire (référentiel)';
    if (!form.nombre || parseInt(form.nombre) < 1) errs.nombre = 'Nombre invalide';
    if (form.containerId && !form.position && form.insertMode !== 'split') {
      errs.position = 'Sélectionnez une position dans le container';
    }
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
        solutionId:   form.solutionId  ? parseInt(form.solutionId)  : null,
        containerId:  form.containerId ? parseInt(form.containerId) : null,
        position:     form.position    || null,
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

  const hoteOptions = hotes.map(h => ({
    value: h.id,
    label: `${h.taxonomieHote?.nom || 'Hôte'}${h.especeLocale ? ' — ' + h.especeLocale : ''}`,
  }));
  const taxonomieOptions = taxonomies.map(t => ({
    value: t.id, label: t.parent ? `${t.parent.nom} ${t.nom}` : t.nom,
  }));
  const solutionOptions  = solutions.map(s => ({ value: s.id, label: `${s.nom}${s.temperature ? ' (' + s.temperature + ')' : ''}` }));
  const sexeOptions  = [{ value:'M', label:'Mâle' }, { value:'F', label:'Femelle' }, { value:'inconnu', label:'Inconnu' }];
  const stadeOptions = [{ value:'Adulte', label:'Adulte' }, { value:'Nymphe', label:'Nymphe' }, { value:'Larve', label:'Larve' }, { value:'Oeuf', label:'Œuf' }];

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
            <MethodeCascade
              methodeId={form.methodeId}
              onChange={(id) => { setErrors((e) => ({ ...e, methodeId: null })); setForm((f) => ({ ...f, methodeId: id, containerId: '', position: '' })); }}
              onMissionChange={setMissionId}
              error={errors.methodeId}
            />
            <IdTerrainField
              methodeId={form.methodeId}
              value={form.idTerrain}
              onChange={(v) => setForm((f) => ({ ...f, idTerrain: v }))}
              error={errors.idTerrain}
            />
            <FormField label="Espèce (référentiel)" name="taxonomieId" type="select"
              value={form.taxonomieId} onChange={handleChange}
              options={taxonomieOptions} required error={errors.taxonomieId} />
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

        {/* Morphologie — Stade AVANT Sexe */}
        <div className="card p-6">
          <h2 className="section-title">
            <Microscope size={17} className="text-blue-500" />
            Morphologie
          </h2>
          {stadeImmature && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2 text-xs text-blue-700">
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              <span>Au stade <strong>{form.stade}</strong>, le sexe ne peut pas être déterminé.</span>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <FormField label="Nombre" name="nombre" type="number" value={form.nombre} onChange={handleChange} required error={errors.nombre} />
            <FormField label="Stade" name="stade" type="select" value={form.stade} onChange={handleChange} options={stadeOptions} />
            <FormField label="Sexe" name="sexe" type="select"
              value={sexeForce} onChange={handleChange}
              options={sexeOptions} disabled={sexeDisabled}
              hint={sexeDisabled ? 'Indéterminable à ce stade' : undefined} />
          </div>
        </div>

        {/* Conservation */}
        <div className="card p-6">
          <h2 className="section-title">
            <FlaskConical size={17} className="text-purple-500" />
            Conservation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <FormField label="Solution de conservation" name="solutionId" type="select" value={form.solutionId} onChange={handleChange} options={solutionOptions} />
            <FormField label="Date de collecte" name="dateCollecte" type="date" value={form.dateCollecte} onChange={handleChange} />
          </div>
          <ContainerSelector
            missionId={missionId}
            value={{ containerId: form.containerId, position: form.position, insertMode: form.insertMode }}
            onChange={({ containerId, position, insertMode }) =>
              setForm((f) => ({ ...f, containerId, position, insertMode }))}
            nombre={parseInt(form.nombre) || 1}
            error={errors.position}
          />
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
