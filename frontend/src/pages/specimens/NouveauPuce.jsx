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
import { STADE_OPTIONS_PUCE, formatStade } from '../../utils/stade';
import { useT } from '../../lib/i18n';

export default function NouveauPuce() {
  const t = useT();
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
  const stadeImmature = form.stade === 'L' || form.stade === 'E';
  const sexeDisabled  = stadeImmature;
  const sexeForce     = stadeImmature ? 'inconnu' : form.sexe;

  useEffect(() => {
    setForm((f) => sexeDisabled && f.sexe !== 'inconnu' ? { ...f, sexe: 'inconnu' } : f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.stade]);

  const validate = () => {
    const errs = {};
    if (!form.methodeId)   errs.methodeId   = t('nouveauSpecimen.methodeRequired');
    if (!form.taxonomieId) errs.taxonomieId = t('nouveauSpecimen.taxonomieRequired');
    if (!form.nombre || parseInt(form.nombre) < 1) errs.nombre = t('nouveauSpecimen.nombreInvalide');
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
      setErrors({ submit: err.response?.data?.error || t('nouveauSpecimen.creationError') });
    } finally {
      setIsLoading(false);
    }
  };

  const hoteOptions = hotes.map(h => ({
    value: h.id,
    label: `${h.idTerrain || `#${h.id}`} — ${h.taxonomieHote?.nom || t('nouveauTique.hoteFallback')}${h.especeLocale ? ` (${h.especeLocale})` : ''}`,
  }));
  const taxonomieOptions = taxonomies.map(tx => ({
    value: tx.id, label: tx.parent ? `${tx.parent.nom} ${tx.nom}` : tx.nom,
  }));
  const solutionOptions  = solutions.map(s => ({ value: s.id, label: `${s.nom}${s.temperature ? ' (' + s.temperature + ')' : ''}` }));
  const sexeOptions  = [{ value:'M', label: t('sexe.M') }, { value:'F', label: t('sexe.F') }, { value:'inconnu', label: t('sexe.inconnu') }];
  const stadeOptions = STADE_OPTIONS_PUCE;

  const selectedTaxo = taxonomies.find((tx) => tx.id === parseInt(form.taxonomieId));
  const selectedHote = hotes.find((h) => h.id === parseInt(form.hoteId));

  return (
    <div className="space-y-5">
      <Link to="/specimens/puces" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> {t('dashboard.puces')}
      </Link>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr,280px] gap-5 items-start">
          <div className="space-y-5">
            {errors.submit && (
              <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-sm text-danger">{errors.submit}</div>
            )}

        <div className="card p-6">
          <h2 className="section-title">
            <SpecimenIcon type="puce" size={18} />
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
            <FormField label={t('nouveauSpecimen.genreEspece')} name="taxonomieId" type="select"
              value={form.taxonomieId} onChange={handleChange}
              options={taxonomieOptions} required error={errors.taxonomieId} />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="section-title">
            <PawPrint size={17} className="text-amber-500" />
            {t('nouveauTique.hoteAssocie')}
          </h2>
          <FormField label={t('nouveauTique.hote')} name="hoteId" type="select"
            value={form.hoteId} onChange={handleChange} options={hoteOptions}
            hint={t('nouveauPuce.hoteHint')} />
        </div>

        {/* Morphologie — Stade AVANT Sexe */}
        <div className="card p-6">
          <h2 className="section-title">
            <Microscope size={17} className="text-blue-500" />
            {t('nouveauSpecimen.morphologie')}
          </h2>
          {stadeImmature && (
            <div className="mb-4 p-3 bg-info/10 border border-info/20 rounded-xl flex items-start gap-2 text-xs text-info">
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              <span>{t('nouveauSpecimen.stadePrefix')} <strong>{formatStade(form.stade)}</strong>, {t('nouveauTique.stadeImmatureHint')}</span>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <FormField label={t('nouveauSpecimen.nombre')} name="nombre" type="number" value={form.nombre} onChange={handleChange} required error={errors.nombre} />
            <FormField label={t('nouveauSpecimen.stade')} name="stade" type="select" value={form.stade} onChange={handleChange} options={stadeOptions} />
            <FormField label={t('nouveauSpecimen.sexe')} name="sexe" type="select"
              value={sexeForce} onChange={handleChange}
              options={sexeOptions} disabled={sexeDisabled}
              hint={sexeDisabled ? t('nouveauTique.sexeIndeterminable') : undefined} />
          </div>
        </div>

        {/* Conservation */}
        <div className="card p-6">
          <h2 className="section-title">
            <FlaskConical size={17} className="text-purple-500" />
            {t('nouveauSpecimen.conservation')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <FormField label={t('nouveauSpecimen.solutionConservation')} name="solutionId" type="select" value={form.solutionId} onChange={handleChange} options={solutionOptions} />
            <FormField label={t('nouveauSpecimen.dateCollecte')} name="dateCollecte" type="date" value={form.dateCollecte} onChange={handleChange} />
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
            {t('nouveauSpecimen.notesObservations')}
          </h2>
          <FormField name="notes" type="textarea" value={form.notes} onChange={handleChange}
            placeholder={t('nouveauSpecimen.notesPlaceholder')} />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to="/specimens/puces" className="btn-secondary">{t('common.cancel')}</Link>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? <><Loader2 size={15} className="animate-spin" /> {t('nouveauSpecimen.saving')}</> : <><Check size={15} /> {t('nouveauPuce.savePuce')}</>}
          </button>
        </div>

          </div>{/* fin formulaire */}

          {/* ═══ Sidebar ═══ */}
          <aside className="space-y-4 xl:sticky xl:top-4 self-start">
            <Card padding="sm" tone="primary">
              <div className="flex items-center gap-2 mb-3">
                <SpecimenIcon type="puce" size={22} />
                <p className="text-xs font-semibold text-fg uppercase tracking-wider">{t('nouveauSpecimen.preview')}</p>
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5">{t('nouveauSpecimen.espece')}</p>
                  {selectedTaxo ? (
                    <p className="text-sm font-semibold italic text-specimen-puce">
                      {selectedTaxo.parent?.nom ? `${selectedTaxo.parent.nom} ` : ''}{selectedTaxo.nom}
                    </p>
                  ) : <p className="text-xs text-fg-subtle italic">{t('nouveauSpecimen.toSelect')}</p>}
                </div>
                {form.idTerrain && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5 flex items-center gap-1"><Tag size={9} /> {t('nouveauSpecimen.idTerrain')}</p>
                    <p className="text-sm font-mono font-bold text-primary">{form.idTerrain}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-fg-subtle mb-0.5">{t('nouveauSpecimen.nombre')}</p><p className="font-semibold text-fg">{form.nombre || '—'}</p></div>
                  <div><p className="text-fg-subtle mb-0.5">{t('nouveauSpecimen.sexe')}</p><p className="font-semibold text-fg capitalize">{sexeForce === 'inconnu' ? '—' : sexeForce === 'M' ? t('sexe.M') : t('sexe.F')}</p></div>
                  {form.stade && <div><p className="text-fg-subtle mb-0.5">{t('nouveauSpecimen.stade')}</p><p className="font-semibold text-fg">{formatStade(form.stade)}</p></div>}
                </div>
                {selectedHote && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5">{t('nouveauTique.hoteLabel')}</p>
                    <p className="text-xs font-medium text-fg italic">{selectedHote.taxonomieHote?.nom}</p>
                  </div>
                )}
              </div>
            </Card>

            <Card padding="sm">
              <p className="text-[11px] text-fg-muted space-y-1.5 leading-relaxed">
                <span className="block font-semibold text-fg mb-1">{t('nouveauSpecimen.tips')}</span>
                <span className="block">• {t('nouveauTique.helpTiqueTaxonomiePrefix')} <strong>{t('nouveauTique.helpTiqueTaxonomieWord')}</strong> {t('nouveauTique.helpTiqueTaxonomieSuffix')}</span>
                <span className="block">• {t('nouveauPuce.helpRongeurPrefix')} <strong>{t('nouveauPuce.helpRongeurWord')}</strong>{t('nouveauPuce.helpRongeurSuffix')}</span>
                <span className="block">• {t('nouveauPuce.helpBoitePrefix')} <strong>{t('nouveauPuce.helpBoiteWord')}</strong> {t('nouveauPuce.helpBoiteSuffix')}</span>
              </p>
            </Card>
          </aside>
        </div>
      </form>
    </div>
  );
}
