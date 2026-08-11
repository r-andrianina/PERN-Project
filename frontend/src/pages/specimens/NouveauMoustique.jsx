import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { ChevronLeft, Microscope, FlaskConical, FileText, Check, Loader2, Info, Tag } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import MethodeCascade from '../../components/MethodeCascade';
import IdTerrainField from '../../components/IdTerrainField';
import ContainerSelector from '../../components/ContainerSelector';
import { Card } from '../../components/ui';
import SpecimenIcon from '../../components/SpecimenIcon';
import { STADE_OPTIONS_MOUSTIQUE, formatStade } from '../../utils/stade';
import { GORGEMENT_OPTIONS, formatGorgement } from '../../utils/gorgement';
import { useT, interpolate } from '../../lib/i18n';

export default function NouveauMoustique() {
  const t = useT();
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
    repasSang:      'N',
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
  const [isDirty,    setIsDirty]    = useState(false);

  useUnsavedChanges(isDirty);

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
    setIsDirty(true);
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  // ─── Cascade biologique : Stade → Sexe → Parité / Repas sang ───
  // Larve / Œuf : pas de sexe, pas de parité, pas de repas sang
  // Sexe = inconnu : pas de parité (on ne paritè que les femelles)
  // Sexe = M       : pas de repas sang (un mâle ne se gorge pas)
  const stadeImmature = form.stade === 'L' || form.stade === 'E';
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
      if (repasSangDisabled && f.repasSang !== 'N') next.repasSang = 'N';
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.stade, form.sexe]);


  const validate = () => {
    const errs = {};
    if (!form.methodeId)   errs.methodeId   = t('nouveauSpecimen.methodeRequired');
    if (!form.taxonomieId) errs.taxonomieId = t('nouveauSpecimen.taxonomieRequired');
    const n = parseInt(form.nombre);
    if (!n || n < 1) errs.nombre = t('nouveauSpecimen.nombreInvalide');
    if (form.containerId && !form.position && form.insertMode !== 'split') {
      errs.position = t('nouveauSpecimen.positionRequired');
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
      setIsDirty(false);
      navigate('/specimens/moustiques');
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || t('nouveauSpecimen.creationError') });
    } finally {
      setIsLoading(false);
    }
  };

  const taxonomieOptions = taxonomies.map(tx => ({
    value: tx.id,
    label: tx.parent ? `${tx.parent.nom} ${tx.nom}` : tx.nom,
  }));
  const solutionOptions  = solutions.map(s => ({ value: s.id, label: `${s.nom}${s.temperature ? ' (' + s.temperature + ')' : ''}` }));
  const sexeOptions    = [{ value:'M', label: t('sexe.M') }, { value:'F', label: t('sexe.F') }, { value:'inconnu', label: t('sexe.inconnu') }];
  const stadeOptions   = STADE_OPTIONS_MOUSTIQUE;
  const pariteOptions  = [{ value:'Nulle', label:'Nulle' }, { value:'Paucie', label:'Paucie' }, { value:'Multi', label:'Multi' }];
  const organeOptions  = [
    { value: 'Tête',    label: t('specimenDetail.organeTete') },
    { value: 'Thorax',  label: t('specimenDetail.organeThorax') },
    { value: 'Abdomen', label: t('specimenDetail.organeAbdomen') },
    { value: 'Entier',  label: t('specimenDetail.organeEntier') },
  ];

  const selectedTaxo = taxonomies.find((tx) => tx.id === parseInt(form.taxonomieId));

  return (
    <div className="space-y-5">
      <Link to="/specimens/moustiques" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> {t('dashboard.moustiques')}
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
            {t('nouveauSpecimen.identification')}
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
              label={t('nouveauSpecimen.genreEspece')} name="taxonomieId" type="select"
              value={form.taxonomieId} onChange={handleChange}
              options={taxonomieOptions} required error={errors.taxonomieId}
              hint={t('nouveauSpecimen.genreEspeceHint')}
            />
          </div>
        </div>

        {/* Morphologie — Stade AVANT sexe (ne peut pas déterminer le sexe d'une larve) */}
        <div className="card p-6">
          <h2 className="section-title">
            <Microscope size={17} className="text-blue-500" />
            {t('nouveauSpecimen.morphologie')}
          </h2>

          {stadeImmature && (
            <div className="mb-4 p-3 bg-info/10 border border-info/20 rounded-xl flex items-start gap-2 text-xs text-info">
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              <span>{t('nouveauSpecimen.stadePrefix')} <strong>{formatStade(form.stade)}</strong>, {t('nouveauSpecimen.stadeImmatureHint')}</span>
            </div>
          )}
          {!stadeImmature && form.sexe === 'M' && (
            <div className="mb-4 p-3 bg-info/10 border border-info/20 rounded-xl flex items-start gap-2 text-xs text-info">
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              <span>{t('nouveauSpecimen.maleHint')}</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField label={t('nouveauSpecimen.nombre')} name="nombre" type="number" value={form.nombre} onChange={handleChange} required error={errors.nombre} />
            <FormField label={t('nouveauSpecimen.stade')} name="stade" type="select" value={form.stade} onChange={handleChange} options={stadeOptions} />
            <FormField label={t('nouveauSpecimen.sexe')} name="sexe" type="select"
              value={sexeForce} onChange={handleChange}
              options={sexeOptions} disabled={sexeDisabled}
              hint={sexeDisabled ? t('nouveauSpecimen.sexeIndeterminable') : undefined}
            />
            <FormField label={t('nouveauSpecimen.parite')} name="parite" type="select"
              value={form.parite} onChange={handleChange}
              options={pariteOptions} disabled={pariteDisabled}
              hint={pariteDisabled ? t('nouveauSpecimen.femelleUniquement') : undefined}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <FormField label={t('nouveauSpecimen.organePreleve')} name="organePreleve" type="select"
              value={form.organePreleve} onChange={handleChange}
              options={organeOptions} disabled={stadeImmature}
            />
            <FormField label={t('nouveauSpecimen.statutSanguin')} name="repasSang" type="select"
              value={form.repasSang} onChange={handleChange}
              options={GORGEMENT_OPTIONS} disabled={repasSangDisabled}
              hint={repasSangDisabled ? (form.sexe === 'M' ? t('nouveauSpecimen.maleNeGorgePas') : t('nouveauSpecimen.femelleUniquement')) : undefined}
            />
          </div>
        </div>

        {/* Conservation refondue */}
        <div className="card p-6">
          <h2 className="section-title">
            <FlaskConical size={17} className="text-purple-500" />
            {t('nouveauSpecimen.conservation')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <FormField label={t('nouveauSpecimen.solutionConservation')} name="solutionId" type="select"
              value={form.solutionId} onChange={handleChange} options={solutionOptions} />
            <FormField label={t('nouveauSpecimen.dateCollecte')} name="dateCollecte" type="date"
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
            {t('nouveauSpecimen.notesObservations')}
          </h2>
          <FormField name="notes" type="textarea"
            value={form.notes} onChange={handleChange}
            placeholder={t('nouveauSpecimen.notesPlaceholder')}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to="/specimens/moustiques" className="btn-secondary">{t('common.cancel')}</Link>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading
              ? <><Loader2 size={15} className="animate-spin" /> {t('nouveauSpecimen.saving')}</>
              : <><Check size={15} /> {t('nouveauSpecimen.saveSpecimen')}</>
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
                <p className="text-xs font-semibold text-fg uppercase tracking-wider">{t('nouveauSpecimen.preview')}</p>
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5">{t('nouveauSpecimen.espece')}</p>
                  {selectedTaxo ? (
                    <p className="text-sm font-semibold italic text-specimen-moustique">
                      {selectedTaxo.parent?.nom ? `${selectedTaxo.parent.nom} ` : ''}{selectedTaxo.nom}
                    </p>
                  ) : (
                    <p className="text-xs text-fg-subtle italic">{t('nouveauSpecimen.toSelect')}</p>
                  )}
                </div>
                {form.idTerrain && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <Tag size={9} /> {t('nouveauSpecimen.idTerrain')}
                    </p>
                    <p className="text-sm font-mono font-bold text-primary">{form.idTerrain}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-fg-subtle mb-0.5">{t('nouveauSpecimen.nombre')}</p>
                    <p className="font-semibold text-fg">{form.nombre || '—'}</p>
                  </div>
                  <div>
                    <p className="text-fg-subtle mb-0.5">{t('nouveauSpecimen.sexe')}</p>
                    <p className="font-semibold text-fg capitalize">{sexeForce === 'inconnu' ? '—' : sexeForce === 'M' ? t('sexe.M') : t('sexe.F')}</p>
                  </div>
                  {form.stade && (
                    <div>
                      <p className="text-fg-subtle mb-0.5">{t('nouveauSpecimen.stade')}</p>
                      <p className="font-semibold text-fg">{formatStade(form.stade)}</p>
                    </div>
                  )}
                  {form.parite && (
                    <div>
                      <p className="text-fg-subtle mb-0.5">{t('nouveauSpecimen.parite')}</p>
                      <p className="font-semibold text-fg">{form.parite}</p>
                    </div>
                  )}
                </div>
                {form.repasSang !== 'N' && (
                  <p className="text-xs text-danger font-medium">{t('nouveauSpecimen.statutSanguin')} : {formatGorgement(form.repasSang)}</p>
                )}
              </div>
            </Card>

            {/* Conservation */}
            {(form.solutionId || form.containerId || form.dateCollecte) && (
              <Card padding="sm">
                <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-2">{t('nouveauSpecimen.conservation')}</p>
                {form.dateCollecte && <p className="text-xs text-fg-muted">{t('nouveauSpecimen.dateLabel')} {new Date(form.dateCollecte).toLocaleDateString(t('common.locale'))}</p>}
                {form.containerId && <p className="text-xs text-fg-muted mt-1">
                  Container {form.position ? `— ${interpolate(t('nouveauSpecimen.containerPositionChosen'), { pos: form.position })}` : t('nouveauSpecimen.containerPositionToChoose')}
                </p>}
              </Card>
            )}

            {/* Aide */}
            <Card padding="sm">
              <p className="text-[11px] text-fg-muted space-y-1.5 leading-relaxed">
                <span className="block font-semibold text-fg mb-1">{t('nouveauSpecimen.tips')}</span>
                <span className="block">• {t('nouveauSpecimen.helpTaxonomiePrefix')} <strong>{t('nouveauSpecimen.helpTaxonomieWord')}</strong> {t('nouveauSpecimen.helpTaxonomieSuffix')}</span>
                <span className="block">• {t('nouveauSpecimen.helpStadePrefix')} <strong>{t('nouveauSpecimen.helpStadeWord')}</strong> {t('nouveauSpecimen.helpStadeSuffix')}</span>
                <span className="block">• {t('nouveauSpecimen.helpMalePrefix')} <strong>{t('nouveauSpecimen.helpMaleWord')}</strong> {t('nouveauSpecimen.helpMaleSuffix')}</span>
                <span className="block">• {t('nouveauSpecimen.helpIdTerrainPrefix')}<code className="font-mono text-[10px]">AKZ_n</code>{t('nouveauSpecimen.helpIdTerrainSuffix')}</span>
              </p>
            </Card>
          </aside>

        </div>{/* fin grid */}
      </form>
    </div>
  );
}
