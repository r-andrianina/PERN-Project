import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Bug, FlaskConical, FileText, Plus, Minus, Microscope, Tag } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import MethodeCascade from '../../components/MethodeCascade';
import IdTerrainField from '../../components/IdTerrainField';
import ContainerSelector from '../../components/ContainerSelector';

const SEXE_OPTIONS  = [
  { value: 'inconnu', label: 'Inconnu' },
  { value: 'M',       label: 'Mâle'   },
  { value: 'F',       label: 'Femelle' },
];
const STADE_OPTIONS = [
  { value: 'Ad', label: 'Adulte' },
  { value: 'L',  label: 'Larve'  },
  { value: 'N',  label: 'Nymphe' },
  { value: 'E',  label: 'Œuf'    },
];

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
    }).catch(console.error);
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
    if (!form.methodeId)      errs.methodeId      = 'La méthode de collecte est obligatoire';
    if (!form.typeSpecimenId) errs.typeSpecimenId = 'Le type de spécimen est obligatoire';
    if (!parseInt(form.nombre) || parseInt(form.nombre) < 1) errs.nombre = 'Nombre invalide';
    if (form.containerId && !form.position && form.insertMode !== 'split')
      errs.position = 'Sélectionnez une position dans le container';
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
      setErrors({ submit: err.response?.data?.error || 'Erreur lors de la création' });
    } finally {
      setIsLoading(false);
    }
  };

  // Options sans option vide — FormField l'ajoute automatiquement
  const typeOptions    = typesSpec.map((t)  => ({ value: t.id, label: `${t.code} — ${t.nom}` }));
  const taxoOptions    = taxonomies.map((t) => ({
    value: t.id,
    label: t.parent ? `${t.parent.nom} ${t.nom}` : t.nom,
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
        Autres spécimens
      </Link>

      {/* ── Titre ── */}
      <div className="flex items-center gap-3 pb-1">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bug size={17} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-fg">Nouveau spécimen</h1>
          <p className="text-xs text-fg-subtle">Phlébotome, Culicoïde ou autre vecteur</p>
        </div>
      </div>

      {errors.submit && (
        <div className="p-3.5 bg-danger/8 border border-danger/25 rounded-xl text-sm text-danger flex items-center gap-2">
          <span className="font-semibold">Erreur :</span> {errors.submit}
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
              <SectionTitle icon={Bug} iconClass="text-primary" sub="Mission, localité et méthode de collecte associées">
                Identification
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
                    label="Type de spécimen" name="typeSpecimenId" type="select"
                    value={form.typeSpecimenId} onChange={handleChange}
                    options={typeOptions}
                    required error={errors.typeSpecimenId}
                    hint="Phlébotome, Culicoïde… — depuis le dictionnaire"
                  />
                </div>
                <div className="sm:col-span-2">
                  <FormField
                    label="Taxonomie" name="taxonomieId" type="select"
                    value={form.taxonomieId} onChange={handleChange}
                    options={taxoOptions}
                    hint="Optionnelle — si le genre/espèce est identifié"
                  />
                </div>
              </div>
            </div>

            {/* ── 2. Morphologie ── */}
            <div className="card p-6">
              <SectionTitle icon={Microscope} iconClass="text-info" sub="Caractéristiques physiques de l'individu">
                Morphologie
              </SectionTitle>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <FormField
                  label="Nombre" name="nombre" type="number"
                  value={form.nombre} onChange={handleChange}
                  required error={errors.nombre}
                />
                <FormField
                  label="Stade" name="stade" type="select"
                  value={form.stade} onChange={handleChange}
                  options={STADE_OPTIONS}
                />
                <FormField
                  label="Sexe" name="sexe" type="select"
                  value={form.sexe} onChange={handleChange}
                  options={SEXE_OPTIONS}
                />
                <FormField
                  label="Date de collecte" name="dateCollecte" type="date"
                  value={form.dateCollecte} onChange={handleChange}
                />
              </div>
            </div>

            {/* ── 3. Attributs spécifiques ── */}
            <div className="card p-6">
              <SectionTitle icon={Tag} iconClass="text-warning" sub="Champs libres propres à ce type d'insecte">
                Attributs spécifiques
              </SectionTitle>

              <div className="space-y-2.5">
                {attributs.map((attr, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Clé  (ex: longueur_mm)"
                      value={attr.cle}
                      onChange={(e) => setAttrField(i, 'cle', e.target.value)}
                      className="input-base text-sm font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Valeur"
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
                  <Plus size={13} /> Ajouter un attribut
                </button>
              </div>
            </div>

            {/* ── 4. Observations ── */}
            <div className="card p-6">
              <SectionTitle icon={FileText} iconClass="text-fg-subtle" sub="Comportement, état, conditions terrain…">
                Observations
              </SectionTitle>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Notes libres…"
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
                <h3 className="text-xs font-bold text-fg uppercase tracking-wider">Conservation</h3>
              </div>

              <div className="space-y-4">
                <FormField
                  label="Solution" name="solutionId" type="select"
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
                  Enregistrement…
                </>
              ) : (
                <>
                  <Plus size={15} /> Enregistrer le spécimen
                </>
              )}
            </button>

            <p className="text-[11px] text-fg-subtle text-center leading-relaxed">
              L'ID terrain est généré automatiquement<br />si le champ est laissé vide.
            </p>
          </div>

        </div>
      </form>
    </div>
  );
}

