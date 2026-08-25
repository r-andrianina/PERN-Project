import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Bug, FlaskConical, FileText, Plus, Minus, Microscope, Tag } from 'lucide-react';
import api from '../../api/axios';
import { toast } from '../../lib/toast';
import FormField from '../../components/FormField';
import MethodeCascade from '../../components/MethodeCascade';
import IdTerrainField from '../../components/IdTerrainField';
import ContainerSelector from '../../components/ContainerSelector';
import { useT } from '../../lib/i18n';

function SectionTitle({ icon: Icon, iconClass = 'text-primary', children, sub }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-current/10 ${iconClass}`}>
        <Icon size={15} />
      </div>
      <div>
        <h2 className="text-sm font-bold text-fg tracking-tight">{children}</h2>
        {sub && <p className="text-[11px] text-fg-subtle mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionDivider() {
  return <hr className="border-border my-5" />;
}

export default function NouvelAutreSpecimen() {
  const t = useT();
  const SEXE_OPTIONS  = [
    { value: 'inconnu', label: t('sexe.inconnu') },
    { value: 'M',       label: t('sexe.M')   },
    { value: 'F',       label: t('sexe.F') },
  ];
  const STADE_OPTIONS = [
    { value: 'Ad', label: t('autreSpecimenDetail.stadeAdulte') },
    { value: 'L',  label: t('autreSpecimenDetail.stadeLarve')  },
    { value: 'N',  label: t('autreSpecimenDetail.stadeNymphe') },
    { value: 'E',  label: t('autreSpecimenDetail.stadeOeuf')    },
  ];

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    methodeId:      searchParams.get('methodeId') || '',
    typeSpecimenId: '',
    taxonomieId:    '',
    idTerrain:      '',
    nombre:         '1',
    sexe:           'inconnu',
    stade:          '',
    solutionId:     '',
    containerId:    '',
    position:       '',
    insertMode:     'single',
    dateCollecte:   '',
    notes:          '',
  });
  const [attributs, setAttributs] = useState([{ cle: '', valeur: '' }]);
  const [missionId,  setMissionId]  = useState(null);
  const [typesSpec,  setTypesSpec]  = useState([]);
  const [taxonomies, setTaxonomies] = useState([]);
  const [solutions,  setSolutions]  = useState([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [errors,     setErrors]     = useState({});

  useEffect(() => {
    Promise.all([
      api.get('/dictionnaire/types-autre-specimen', { params: { actif: 'true' } }),
      api.get('/dictionnaire/taxonomie-specimens',  { params: { actif: 'true', niveau: 'espece' } }),
      api.get('/dictionnaire/solutions-conservation', { params: { actif: 'true' } }),
    ]).then(([tRes, taxRes, sRes]) => {
      setTypesSpec(tRes.data.items   || []);
      setTaxonomies(taxRes.data.items || []);
      setSolutions(sRes.data.items   || []);
    }).catch(() => toast.error(t('nouveauSpecimen.loadRefsError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setErrors((p) => ({ ...p, [name]: null }));
    setForm((f) => ({ ...f, [name]: value }));
  };

  const setAttrField = (i, field, val) =>
    setAttributs((p) => p.map((a, idx) => idx === i ? { ...a, [field]: val } : a));

  const validate = () => {
    const errs = {};
    if (!form.methodeId)      errs.methodeId      = t('nouveauSpecimen.methodeRequired');
    if (!form.typeSpecimenId) errs.typeSpecimenId = t('nouvelAutreSpecimen.typeSpecimenRequired');
    if (!parseInt(form.nombre) || parseInt(form.nombre) < 1) errs.nombre = t('nouveauSpecimen.nombreInvalide');
    if (form.containerId && !form.position && form.insertMode !== 'split')
      errs.position = t('nouveauSpecimen.positionRequired');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      const attrsObj = {};
      attributs.forEach(({ cle, valeur }) => { if (cle.trim()) attrsObj[cle.trim()] = valeur; });
      const payload = {
        methodeId:      parseInt(form.methodeId),
        typeSpecimenId: parseInt(form.typeSpecimenId),
        taxonomieId:    form.taxonomieId ? parseInt(form.taxonomieId) : null,
        idTerrain:      form.idTerrain   || null,
        nombre:         parseInt(form.nombre),
        sexe:           form.sexe,
        stade:          form.stade       || null,
        solutionId:     form.solutionId  ? parseInt(form.solutionId)  : null,
        containerId:    form.containerId ? parseInt(form.containerId) : null,
        position:       form.position    || null,
        insertMode:     form.insertMode,
        dateCollecte:   form.dateCollecte || null,
        notes:          form.notes       || null,
        attributs:      Object.keys(attrsObj).length ? attrsObj : null,
      };
      await api.post('/autres-specimens', payload);
      navigate('/specimens/autres');
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || t('nouveauSpecimen.creationError') });
    } finally {
      setIsLoading(false);
    }
  };

  // Options sans option vide — FormField l'ajoute automatiquement
  const typeOptions    = typesSpec.map((tp)  => ({ value: tp.id, label: `${tp.code} — ${tp.nom}` }));
  const taxoOptions    = taxonomies.map((tx) => ({
    value: tx.id,
    label: tx.parent ? `${tx.parent.nom} ${tx.nom}` : tx.nom,
  }));
  const solutionOptions = solutions.map((s) => ({
    value: s.id,
    label: `${s.nom}${s.temperature ? ` · ${s.temperature}` : ''}`,
  }));

  return (
    <div className="max-w-screen-2xl space-y-4">

      {/* ── Fil d'Ariane ── */}
      <Link
        to="/specimens/autres"
        className="inline-flex items-center gap-1.5 text-xs text-fg-subtle hover:text-fg transition-colors group"
      >
        <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        {t('nouvelAutreSpecimen.backToList')}
      </Link>

      {/* ── Titre ── */}
      <div className="flex items-center gap-3 pb-1">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bug size={17} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-fg">{t('nouvelAutreSpecimen.title')}</h1>
          <p className="text-xs text-fg-subtle">{t('nouvelAutreSpecimen.subtitle')}</p>
        </div>
      </div>

      {errors.submit && (
        <div className="p-3.5 bg-danger/8 border border-danger/25 rounded-xl text-sm text-danger flex items-center gap-2">
          <span className="font-semibold">{t('nouvelAutreSpecimen.errorPrefix')}</span> {errors.submit}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_380px] gap-5 2xl:gap-8 items-start">

          {/* ══════════════════════════════════════════
              COLONNE PRINCIPALE
          ══════════════════════════════════════════ */}
          <div className="space-y-4">

            {/* ── 1. Rattachement terrain ── */}
            <div className="card p-6">
              <SectionTitle icon={Bug} iconClass="text-primary" sub={t('nouvelAutreSpecimen.identificationSub')}>
                {t('specimenDetail.identification')}
              </SectionTitle>

              <div className="space-y-4">
                <MethodeCascade
                  methodeId={form.methodeId}
                  onChange={(id) => {
                    setErrors((e) => ({ ...e, methodeId: null }));
                    setForm((f) => ({ ...f, methodeId: id, containerId: '', position: '' }));
                  }}
                  onMissionChange={setMissionId}
                  error={errors.methodeId}
                />

                <IdTerrainField
                  methodeId={form.methodeId}
                  value={form.idTerrain}
                  onChange={(v) => setForm((f) => ({ ...f, idTerrain: v }))}
                  error={errors.idTerrain}
                />
              </div>

              <SectionDivider />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* FormField ajoute déjà "— Sélectionner —", ne pas le dupliquer */}
                <div className="sm:col-span-2">
                  <FormField
                    label={t('nouvelAutreSpecimen.typeSpecimen')} name="typeSpecimenId" type="select"
                    value={form.typeSpecimenId} onChange={handleChange}
                    options={typeOptions}
                    required error={errors.typeSpecimenId}
                    hint={t('nouvelAutreSpecimen.typeSpecimenHint')}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FormField
                    label={t('nouvelAutreSpecimen.taxonomie')} name="taxonomieId" type="select"
                    value={form.taxonomieId} onChange={handleChange}
                    options={taxoOptions}
                    hint={t('nouvelAutreSpecimen.taxonomieHint')}
                  />
                </div>
              </div>
            </div>

            {/* ── 2. Morphologie ── */}
            <div className="card p-6">
              <SectionTitle icon={Microscope} iconClass="text-info" sub={t('nouvelAutreSpecimen.morphologieSub')}>
                {t('nouveauSpecimen.morphologie')}
              </SectionTitle>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <FormField
                  label={t('nouveauSpecimen.nombre')} name="nombre" type="number"
                  value={form.nombre} onChange={handleChange}
                  required error={errors.nombre}
                />
                <FormField
                  label={t('nouveauSpecimen.stade')} name="stade" type="select"
                  value={form.stade} onChange={handleChange}
                  options={STADE_OPTIONS}
                />
                <FormField
                  label={t('nouveauSpecimen.sexe')} name="sexe" type="select"
                  value={form.sexe} onChange={handleChange}
                  options={SEXE_OPTIONS}
                />
                <FormField
                  label={t('nouveauSpecimen.dateCollecte')} name="dateCollecte" type="date"
                  value={form.dateCollecte} onChange={handleChange}
                />
              </div>
            </div>

            {/* ── 3. Attributs spécifiques ── */}
            <div className="card p-6">
              <SectionTitle icon={Tag} iconClass="text-warning" sub={t('nouvelAutreSpecimen.attributsSub')}>
                {t('nouvelAutreSpecimen.attributsSpecifiques')}
              </SectionTitle>

              <div className="space-y-2.5">
                {attributs.map((attr, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <input
                      type="text"
                      placeholder={t('nouvelAutreSpecimen.keyPlaceholder')}
                      value={attr.cle}
                      onChange={(e) => setAttrField(i, 'cle', e.target.value)}
                      className="input-base text-sm font-mono"
                    />
                    <input
                      type="text"
                      placeholder={t('nouvelAutreSpecimen.valuePlaceholder')}
                      value={attr.valeur}
                      onChange={(e) => setAttrField(i, 'valeur', e.target.value)}
                      className="input-base text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setAttributs((p) => p.filter((_, idx) => idx !== i))}
                      disabled={attributs.length === 1}
                      className="p-2 rounded-lg text-fg-subtle hover:text-danger hover:bg-danger/8 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Minus size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAttributs((p) => [...p, { cle: '', valeur: '' }])}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-1"
                >
                  <Plus size={13} /> {t('nouvelAutreSpecimen.addAttribute')}
                </button>
              </div>
            </div>

            {/* ── 4. Observations ── */}
            <div className="card p-6">
              <SectionTitle icon={FileText} iconClass="text-fg-subtle" sub={t('nouvelAutreSpecimen.observationsSub')}>
                {t('nouvelAutreSpecimen.observations')}
              </SectionTitle>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                placeholder={t('nouvelAutreSpecimen.notesPlaceholder')}
                className="input-base w-full text-sm resize-none"
              />
            </div>
          </div>

          {/* ══════════════════════════════════════════
              SIDEBAR STICKY
          ══════════════════════════════════════════ */}
          <div className="xl:sticky xl:top-5 space-y-4">

            {/* Conservation */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <FlaskConical size={14} className="text-warning" />
                <h3 className="text-xs font-bold text-fg uppercase tracking-wider">{t('nouvelAutreSpecimen.conservation')}</h3>
              </div>

              <div className="space-y-4">
                <FormField
                  label={t('nouvelAutreSpecimen.solution')} name="solutionId" type="select"
                  value={form.solutionId} onChange={handleChange}
                  options={solutionOptions}
                />
                <ContainerSelector
                  missionId={missionId || undefined}
                  containerId={form.containerId}
                  position={form.position}
                  insertMode={form.insertMode}
                  nombre={parseInt(form.nombre) || 1}
                  onContainerChange={(id) => setForm((f) => ({ ...f, containerId: id, position: '' }))}
                  onPositionChange={(pos) => setForm((f) => ({ ...f, position: pos }))}
                  onInsertModeChange={(mode) => setForm((f) => ({ ...f, insertMode: mode }))}
                  error={errors.position}
                />
              </div>
            </div>

            {/* Bouton submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 rounded-xl disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-fg-on-primary/30 border-t-fg-on-primary rounded-full animate-spin" />
                  {t('nouvelAutreSpecimen.saving')}
                </>
              ) : (
                <>
                  <Plus size={15} /> {t('nouvelAutreSpecimen.saveSpecimen')}
                </>
              )}
            </button>

            <p className="text-[11px] text-fg-subtle text-center leading-relaxed">
              {t('nouvelAutreSpecimen.idTerrainAutoHint')}<br />{t('nouvelAutreSpecimen.idTerrainAutoHint2')}
            </p>
          </div>

        </div>
      </form>
    </div>
  );
}
