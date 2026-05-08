import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Bug, Microscope, FlaskConical, FileText, Check, Loader2, Info } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import MethodeCascade from '../../components/MethodeCascade';
import IdTerrainField from '../../components/IdTerrainField';
import ContainerSelector from '../../components/ContainerSelector';

export default function NouveauMoustique() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    methodeId:      searchParams.get('methodeId') || '',
    taxonomieId:    '',
    idTerrain:      '',
    nombre:         '1',
    sexe:           'inconnu',
    stade:          '',
    parite:         '',
    repasSang:      false,
    organePreleve:  '',
    solutionId:     '',
    containerId:    '',
    position:       '',
    insertMode:     'single',
    dateCollecte:   '',
    notes:          '',
  });
  const [missionId, setMissionId] = useState(null);
  const [taxonomies, setTaxonomies] = useState([]);
  const [solutions,  setSolutions]  = useState([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [errors,     setErrors]     = useState({});

  useEffect(() => {
    Promise.all([
      api.get('/dictionnaire/taxonomie-specimens', { params: { type: 'moustique', niveau: 'espece', actif: 'true' } }),
      api.get('/dictionnaire/solutions-conservation', { params: { actif: 'true' } }),
    ]).then(([tRes, sRes]) => {
      setTaxonomies(tRes.data.items || []);
      setSolutions(sRes.data.items  || []);
    }).catch(console.error);
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setErrors({ ...errors, [name]: null });
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  // ─── Cascade biologique : Stade → Sexe → Parité / Repas sang ───
  // Larve / Œuf : pas de sexe, pas de parité, pas de repas sang
  // Sexe = inconnu : pas de parité (on ne paritè que les femelles)
  // Sexe = M       : pas de repas sang (un mâle ne se gorge pas)
  const stadeImmature = form.stade === 'Larve' || form.stade === 'Oeuf';
  const sexeDisabled  = stadeImmature;
  const sexeForce     = stadeImmature ? 'inconnu' : form.sexe;
  const pariteDisabled = stadeImmature || sexeForce !== 'F';
  const repasSangDisabled = stadeImmature || sexeForce !== 'F';

  // Synchroniser sexe / parité / repasSang quand contraintes changent
  useEffect(() => {
    setForm((f) => {
      const next = { ...f };
      if (sexeDisabled && f.sexe !== 'inconnu') next.sexe = 'inconnu';
      if (pariteDisabled && f.parite)          next.parite = '';
      if (repasSangDisabled && f.repasSang)    next.repasSang = false;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.stade, form.sexe]);

  // Si plaque → forcer nombre=1 (UI)
  const isPlaqueSelected = useMemo(() => {
    return form.containerId && form.insertMode === 'single' && form.nombre > 1
      ? false : true; // logique gérée côté backend, mais on affiche un warning
  }, [form.containerId, form.insertMode, form.nombre]);

  const validate = () => {
    const errs = {};
    if (!form.methodeId)   errs.methodeId   = 'La méthode de collecte est obligatoire';
    if (!form.taxonomieId) errs.taxonomieId = 'La taxonomie est obligatoire (référentiel)';
    const n = parseInt(form.nombre);
    if (!n || n < 1) errs.nombre = 'Nombre invalide';
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
      const payload = {
        ...form,
        methodeId:    parseInt(form.methodeId),
        taxonomieId:  parseInt(form.taxonomieId),
        solutionId:   form.solutionId  ? parseInt(form.solutionId)  : null,
        containerId:  form.containerId ? parseInt(form.containerId) : null,
        position:     form.position    || null,
        nombre:       parseInt(form.nombre),
        repasSang:    form.repasSang,
        dateCollecte: form.dateCollecte || null,
      };
      await api.post('/moustiques', payload);
      navigate('/specimens/moustiques');
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Erreur lors de la création' });
    } finally {
      setIsLoading(false);
    }
  };

  const taxonomieOptions = taxonomies.map(t => ({
    value: t.id,
    label: t.parent ? `${t.parent.nom} ${t.nom}` : t.nom,
  }));
  const solutionOptions  = solutions.map(s => ({ value: s.id, label: `${s.nom}${s.temperature ? ' (' + s.temperature + ')' : ''}` }));
  const sexeOptions    = [{ value:'M', label:'Mâle' }, { value:'F', label:'Femelle' }, { value:'inconnu', label:'Inconnu' }];
  const stadeOptions   = [{ value:'Adulte', label:'Adulte' }, { value:'Nymphe', label:'Nymphe' }, { value:'Larve', label:'Larve' }, { value:'Oeuf', label:'Œuf' }];
  const pariteOptions  = [{ value:'Nulle', label:'Nulle' }, { value:'Paucie', label:'Paucie' }, { value:'Multi', label:'Multi' }];
  const organeOptions  = [{ value:'Tête', label:'Tête' }, { value:'Thorax', label:'Thorax' }, { value:'Abdomen', label:'Abdomen' }, { value:'Entier', label:'Entier' }];

  return (
    <div className="max-w-4xl space-y-5">
      <Link to="/specimens/moustiques" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> Moustiques
      </Link>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errors.submit && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-sm text-danger">
            {errors.submit}
          </div>
        )}

        {/* Identification */}
        <div className="card p-6">
          <h2 className="section-title">
            <Bug size={17} className="text-emerald-600" />
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
            <FormField
              label="Espèce (référentiel)" name="taxonomieId" type="select"
              value={form.taxonomieId} onChange={handleChange}
              options={taxonomieOptions} required error={errors.taxonomieId}
              hint="Sélection obligatoire depuis le dictionnaire"
            />
          </div>
        </div>

        {/* Morphologie — Stade AVANT sexe (ne peut pas déterminer le sexe d'une larve) */}
        <div className="card p-6">
          <h2 className="section-title">
            <Microscope size={17} className="text-blue-500" />
            Morphologie
          </h2>

          {stadeImmature && (
            <div className="mb-4 p-3 bg-info/10 border border-info/20 rounded-xl flex items-start gap-2 text-xs text-info">
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              <span>Au stade <strong>{form.stade}</strong>, le sexe ne peut pas être déterminé — Sexe, Parité et Repas sang sont désactivés.</span>
            </div>
          )}
          {!stadeImmature && form.sexe === 'M' && (
            <div className="mb-4 p-3 bg-info/10 border border-info/20 rounded-xl flex items-start gap-2 text-xs text-info">
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              <span>Un mâle ne se gorge pas de sang — la parité et le repas sang sont désactivés.</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField label="Nombre" name="nombre" type="number" value={form.nombre} onChange={handleChange} required error={errors.nombre} />
            <FormField label="Stade" name="stade" type="select" value={form.stade} onChange={handleChange} options={stadeOptions} />
            <FormField label="Sexe" name="sexe" type="select"
              value={sexeForce} onChange={handleChange}
              options={sexeOptions} disabled={sexeDisabled}
              hint={sexeDisabled ? 'Indéterminable au stade larvaire' : undefined}
            />
            <FormField label="Parité" name="parite" type="select"
              value={form.parite} onChange={handleChange}
              options={pariteOptions} disabled={pariteDisabled}
              hint={pariteDisabled ? 'Femelle adulte uniquement' : undefined}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <FormField label="Organe prélevé" name="organePreleve" type="select"
              value={form.organePreleve} onChange={handleChange}
              options={organeOptions} disabled={stadeImmature}
            />
            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox" id="repasSang" name="repasSang"
                checked={form.repasSang} onChange={handleChange}
                disabled={repasSangDisabled}
                className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 disabled:opacity-40"
              />
              <label htmlFor="repasSang" className={`text-sm cursor-pointer ${repasSangDisabled ? 'text-gray-300' : 'text-gray-600'}`}>
                Repas de sang effectué
                {repasSangDisabled && form.sexe === 'M' && <span className="text-xs text-gray-400 ml-2">(mâle)</span>}
              </label>
            </div>
          </div>
        </div>

        {/* Conservation refondue */}
        <div className="card p-6">
          <h2 className="section-title">
            <FlaskConical size={17} className="text-purple-500" />
            Conservation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <FormField label="Solution de conservation" name="solutionId" type="select"
              value={form.solutionId} onChange={handleChange} options={solutionOptions} />
            <FormField label="Date de collecte" name="dateCollecte" type="date"
              value={form.dateCollecte} onChange={handleChange} />
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

        {/* Notes */}
        <div className="card p-6">
          <h2 className="section-title">
            <FileText size={17} className="text-gray-400" />
            Notes et observations
          </h2>
          <FormField name="notes" type="textarea"
            value={form.notes} onChange={handleChange}
            placeholder="Conditions de collecte, état du spécimen, observations particulières..."
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to="/specimens/moustiques" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading
              ? <><Loader2 size={15} className="animate-spin" /> Enregistrement...</>
              : <><Check size={15} /> Enregistrer le spécimen</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
