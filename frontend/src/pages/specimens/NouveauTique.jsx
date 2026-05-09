import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Microscope, FlaskConical, FileText, PawPrint, Check, Loader2, Info, Tag } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import MethodeCascade from '../../components/MethodeCascade';
import IdTerrainField from '../../components/IdTerrainField';
import ContainerSelector from '../../components/ContainerSelector';
import { Card } from '../../components/ui';
import SpecimenIcon from '../../components/SpecimenIcon';

export default function NouveauTique() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    methodeId: '', hoteId: '', taxonomieId: '', idTerrain: '',
    nombre: '1', sexe: 'inconnu', stade: '', gorge: false,
    partieCorpsHote: '', solutionId: '',
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
      api.get('/dictionnaire/taxonomie-specimens', { params: { type: 'tique', niveau: 'espece', actif: 'true' } }),
      api.get('/dictionnaire/solutions-conservation', { params: { actif: 'true' } }),
    ]).then(([hRes, tRes, sRes]) => {
      setHotes(hRes.data.hotes       || []);
      setTaxonomies(tRes.data.items  || []);
      setSolutions(sRes.data.items   || []);
    }).catch(console.error);
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setErrors({ ...errors, [name]: null });
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  // ── Cascade biologique : Stade → Sexe → Gorgée ──
  const stadeImmature = form.stade === 'Larve' || form.stade === 'Nymphe';
  const sexeDisabled  = stadeImmature; // larve/nymphe = sexe pas déterminable
  const sexeForce     = stadeImmature ? 'inconnu' : form.sexe;
  const gorgeDisabled = sexeForce === 'M'; // un mâle adulte ne se gorge pas

  useEffect(() => {
    setForm((f) => {
      const next = { ...f };
      if (sexeDisabled && f.sexe !== 'inconnu') next.sexe = 'inconnu';
      if (gorgeDisabled && f.gorge)             next.gorge = false;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.stade, form.sexe]);

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
      await api.post('/tiques', {
        ...form,
        methodeId:    parseInt(form.methodeId),
        hoteId:       form.hoteId ? parseInt(form.hoteId) : null,
        taxonomieId:  parseInt(form.taxonomieId),
        solutionId:   form.solutionId  ? parseInt(form.solutionId)  : null,
        containerId:  form.containerId ? parseInt(form.containerId) : null,
        position:     form.position    || null,
        nombre:       parseInt(form.nombre),
        gorge:        form.gorge,
        dateCollecte: form.dateCollecte || null,
      });
      navigate('/specimens/tiques');
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
  const sexeOptions    = [{ value:'M', label:'Mâle' }, { value:'F', label:'Femelle' }, { value:'inconnu', label:'Inconnu' }];
  const stadeOptions   = [{ value:'Adulte', label:'Adulte' }, { value:'Nymphe', label:'Nymphe' }, { value:'Larve', label:'Larve' }];
  const partieOptions  = [
    { value:'Tête', label:'Tête' }, { value:'Cou', label:'Cou' },
    { value:'Oreille', label:'Oreille' }, { value:'Dos', label:'Dos' },
    { value:'Ventre', label:'Ventre' }, { value:'Patte', label:'Patte' },
    { value:'Queue', label:'Queue' }, { value:'Autre', label:'Autre' },
  ];

  const selectedTaxo = taxonomies.find((t) => t.id === parseInt(form.taxonomieId));
  const selectedHote = hotes.find((h) => h.id === parseInt(form.hoteId));

  return (
    <div className="space-y-5">
      <Link to="/specimens/tiques" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> Tiques
      </Link>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr,280px] gap-5 items-start">
          <div className="space-y-5">
            {errors.submit && (
              <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-sm text-danger">{errors.submit}</div>
            )}

        <div className="card p-6">
          <h2 className="section-title">
            <SpecimenIcon type="tique" size={18} />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FormField label="Hôte" name="hoteId" type="select"
                value={form.hoteId} onChange={handleChange} options={hoteOptions}
                hint="Animal hôte sur lequel la tique a été prélevée" />
            </div>
            <FormField label="Partie du corps" name="partieCorpsHote" type="select"
              value={form.partieCorpsHote} onChange={handleChange} options={partieOptions} />
          </div>
        </div>

        {/* Morphologie — Stade AVANT Sexe + cascade */}
        <div className="card p-6">
          <h2 className="section-title">
            <Microscope size={17} className="text-blue-500" />
            Morphologie
          </h2>

          {stadeImmature && (
            <div className="mb-4 p-3 bg-info/10 border border-info/20 rounded-xl flex items-start gap-2 text-xs text-info">
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              <span>Au stade <strong>{form.stade}</strong>, le sexe ne peut pas être déterminé.</span>
            </div>
          )}
          {!stadeImmature && form.sexe === 'M' && (
            <div className="mb-4 p-3 bg-info/10 border border-info/20 rounded-xl flex items-start gap-2 text-xs text-info">
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              <span>Un mâle adulte ne se gorge pas — l'option « gorgée » est désactivée.</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField label="Nombre" name="nombre" type="number" value={form.nombre} onChange={handleChange} required error={errors.nombre} />
            <FormField label="Stade" name="stade" type="select" value={form.stade} onChange={handleChange} options={stadeOptions} />
            <FormField label="Sexe" name="sexe" type="select"
              value={sexeForce} onChange={handleChange}
              options={sexeOptions} disabled={sexeDisabled}
              hint={sexeDisabled ? 'Indéterminable à ce stade' : undefined} />
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" id="gorge" name="gorge"
                checked={form.gorge} onChange={handleChange}
                disabled={gorgeDisabled}
                className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 disabled:opacity-40" />
              <label htmlFor="gorge" className={`text-sm cursor-pointer ${gorgeDisabled ? 'text-gray-300' : 'text-gray-600'}`}>
                Gorgée de sang
              </label>
            </div>
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
          <Link to="/specimens/tiques" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? <><Loader2 size={15} className="animate-spin" /> Enregistrement…</> : <><Check size={15} /> Enregistrer la tique</>}
          </button>
        </div>

          </div>{/* fin formulaire */}

          {/* ═══ Sidebar ═══ */}
          <aside className="space-y-4 xl:sticky xl:top-4 self-start">
            <Card padding="sm" tone="primary">
              <div className="flex items-center gap-2 mb-3">
                <SpecimenIcon type="tique" size={22} />
                <p className="text-xs font-semibold text-fg uppercase tracking-wider">Aperçu</p>
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5">Espèce</p>
                  {selectedTaxo ? (
                    <p className="text-sm font-semibold italic text-specimen-tique">
                      {selectedTaxo.parent?.nom ? `${selectedTaxo.parent.nom} ` : ''}{selectedTaxo.nom}
                    </p>
                  ) : <p className="text-xs text-fg-subtle italic">— à sélectionner —</p>}
                </div>
                {form.idTerrain && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5 flex items-center gap-1"><Tag size={9} /> ID terrain</p>
                    <p className="text-sm font-mono font-bold text-primary">{form.idTerrain}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-fg-subtle mb-0.5">Nombre</p><p className="font-semibold text-fg">{form.nombre || '—'}</p></div>
                  <div><p className="text-fg-subtle mb-0.5">Sexe</p><p className="font-semibold text-fg capitalize">{sexeForce === 'inconnu' ? '—' : sexeForce === 'M' ? 'Mâle' : 'Femelle'}</p></div>
                  {form.stade && <div><p className="text-fg-subtle mb-0.5">Stade</p><p className="font-semibold text-fg">{form.stade}</p></div>}
                </div>
                {form.gorge && <p className="text-xs text-danger font-medium">Gorgée de sang : Oui</p>}
                {selectedHote && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5">Hôte</p>
                    <p className="text-xs font-medium text-fg italic">{selectedHote.taxonomieHote?.nom}</p>
                    {form.partieCorpsHote && <p className="text-[10px] text-fg-subtle">{form.partieCorpsHote}</p>}
                  </div>
                )}
              </div>
            </Card>

            <Card padding="sm">
              <p className="text-[11px] text-fg-muted space-y-1.5 leading-relaxed">
                <span className="block font-semibold text-fg mb-1">Conseils</span>
                <span className="block">• La <strong>taxonomie</strong> est obligatoire.</span>
                <span className="block">• Un <strong>mâle adulte</strong> ne se gorge pas.</span>
                <span className="block">• Le <strong>partie du corps hôte</strong> précise le site de fixation.</span>
              </p>
            </Card>
          </aside>
        </div>
      </form>
    </div>
  );
}
