import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Microscope, FlaskConical, FileText, Check, Loader2, Info, Tag } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import MethodeCascade from '../../components/MethodeCascade';
import IdTerrainField from '../../components/IdTerrainField';
import ContainerSelector from '../../components/ContainerSelector';
import { Card } from '../../components/ui';
import SpecimenIcon from '../../components/SpecimenIcon';

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

  const selectedTaxo = taxonomies.find((t) => t.id === parseInt(form.taxonomieId));

  return (
    <div className="space-y-5">
      <Link to="/specimens/moustiques" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> Moustiques
      </Link>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr,280px] gap-5 items-start">

          {/* ═══ Formulaire ═══ */}
          <div className="space-y-5">
            {errors.submit && (
              <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-sm text-danger">
                {errors.submit}
              </div>
            )}

        {/* Identification */}
        <div className="card p-6">
          <h2 className="section-title">
            <SpecimenIcon type="moustique" size={18} />
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
              ? <><Loader2 size={15} className="animate-spin" /> Enregistrement…</>
              : <><Check size={15} /> Enregistrer le spécimen</>
            }
          </button>
        </div>

          </div>{/* fin formulaire */}

          {/* ═══ Sidebar ═══ */}
          <aside className="space-y-4 xl:sticky xl:top-4 self-start">

            {/* Aperçu du spécimen */}
            <Card padding="sm" tone="primary">
              <div className="flex items-center gap-2 mb-3">
                <SpecimenIcon type="moustique" size={22} />
                <p className="text-xs font-semibold text-fg uppercase tracking-wider">Aperçu</p>
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5">Espèce</p>
                  {selectedTaxo ? (
                    <p className="text-sm font-semibold italic text-specimen-moustique">
                      {selectedTaxo.parent?.nom ? `${selectedTaxo.parent.nom} ` : ''}{selectedTaxo.nom}
                    </p>
                  ) : (
                    <p className="text-xs text-fg-subtle italic">— à sélectionner —</p>
                  )}
                </div>
                {form.idTerrain && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <Tag size={9} /> ID terrain
                    </p>
                    <p className="text-sm font-mono font-bold text-primary">{form.idTerrain}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-fg-subtle mb-0.5">Nombre</p>
                    <p className="font-semibold text-fg">{form.nombre || '—'}</p>
                  </div>
                  <div>
                    <p className="text-fg-subtle mb-0.5">Sexe</p>
                    <p className="font-semibold text-fg capitalize">{sexeForce === 'inconnu' ? '—' : sexeForce === 'M' ? 'Mâle' : 'Femelle'}</p>
                  </div>
                  {form.stade && (
                    <div>
                      <p className="text-fg-subtle mb-0.5">Stade</p>
                      <p className="font-semibold text-fg">{form.stade}</p>
                    </div>
                  )}
                  {form.parite && (
                    <div>
                      <p className="text-fg-subtle mb-0.5">Parité</p>
                      <p className="font-semibold text-fg">{form.parite}</p>
                    </div>
                  )}
                </div>
                {form.repasSang && (
                  <p className="text-xs text-danger font-medium">Repas de sang : Oui</p>
                )}
              </div>
            </Card>

            {/* Conservation */}
            {(form.solutionId || form.containerId || form.dateCollecte) && (
              <Card padding="sm">
                <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-2">Conservation</p>
                {form.dateCollecte && <p className="text-xs text-fg-muted">Date : {new Date(form.dateCollecte).toLocaleDateString('fr-FR')}</p>}
                {form.containerId && <p className="text-xs text-fg-muted mt-1">
                  Container {form.position ? `— position ${form.position}` : '(position à choisir)'}
                </p>}
              </Card>
            )}

            {/* Aide */}
            <Card padding="sm">
              <p className="text-[11px] text-fg-muted space-y-1.5 leading-relaxed">
                <span className="block font-semibold text-fg mb-1">Conseils</span>
                <span className="block">• La <strong>taxonomie</strong> est obligatoire — choisissez au niveau espèce.</span>
                <span className="block">• Le <strong>stade</strong> détermine le sexe : une larve est toujours « inconnu ».</span>
                <span className="block">• Un <strong>mâle</strong> n'effectue pas de repas sang.</span>
                <span className="block">• L'ID terrain (<code className="font-mono text-[10px]">AKZ_n</code>) est généré automatiquement.</span>
              </p>
            </Card>
          </aside>

        </div>{/* fin grid */}
      </form>
    </div>
  );
}
