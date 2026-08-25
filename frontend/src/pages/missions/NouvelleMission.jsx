import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, MapPin, ClipboardList, Plus, Trash2, Check, Loader2, Calendar, User,
  Navigation, UserCheck, UserX, Beaker, X, Edit2, Layers,
} from 'lucide-react';
import api from '../../api/axios';
import { toast } from '../../lib/toast';
import FormField from '../../components/FormField';
import LocaliteFieldsForm from '../../components/LocaliteFieldsForm';
import MethodeFieldsForm from '../../components/MethodeFieldsForm';
import AgentMultiSelect from '../../components/AgentMultiSelect';
import { useApiQuery } from '../../hooks';
import { useT, interpolate } from '../../lib/i18n';

const defaultLocalite = () => ({
  nom: '', pays: 'Madagascar',
  region: '', district: '', commune: '', fokontany: '',
  contacts: [],
  methodes: [],
  latitude: '', longitude: '', altitudeM: '',
});

const defaultMethode = () => ({
  typeMethodeId: '', numero: '1', typeHabitatId: '', typeEnvironnementId: '', interieurExterieur: '',
  datePose: '', dateReleve: '', notes: '', latitude: '', longitude: '', altitudeM: '',
});

// ── Modal d'ajout/édition d'une méthode brouillon (pas encore persistée —
//    la localité elle-même n'existe pas encore tant que la mission n'est
//    pas créée). Ne fait aucun appel API, se contente de renvoyer l'objet
//    au parent via onSave.
function MethodeDraftModal({ localite, initial, onClose, onSave }) {
  const t = useT();
  const [form, setForm] = useState(initial ?? defaultMethode());
  const isEdit = !!initial;

  const { data: typesMethode } = useApiQuery('/dictionnaire/types-methode', {
    params: { actif: 'true' }, select: (r) => r.items ?? [],
  });
  const selectedType = (typesMethode ?? []).find((tm) => tm.id === parseInt(form.typeMethodeId));
  const identifiant  = selectedType ? `${selectedType.code}_${form.numero || 1}` : null;

  // Numéro auto-incrémenté : dès qu'un type de méthode est (re)choisi lors
  // d'un ajout, on propose le prochain numéro libre pour ce type sur cette
  // localité brouillon.
  const handleFieldsChange = (patch) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      if (!isEdit && patch.typeMethodeId !== undefined) {
        const siblingNums = (localite.methodes || [])
          .filter((m) => String(m.typeMethodeId) === String(patch.typeMethodeId))
          .map((m) => parseInt(m.numero) || 1);
        next.numero = String((siblingNums.length ? Math.max(...siblingNums) : 0) + 1);
      }
      return next;
    });
  };

  const submit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl my-4 sm:my-8">
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-5 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface/20 flex items-center justify-center">
              <Beaker size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEdit ? t('nouvelleMission.editMethodTitle') : t('nouvelleMission.newMethodTitle')}
              </h2>
              <p className="text-xs text-white/80">{localite.nom || t('nouvelleMission.unnamedLocality')}{identifiant ? ` — ${identifiant}` : ''}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <MethodeFieldsForm value={form} onChange={handleFieldsChange} localiteCoords={localite} />

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" className="btn-primary">
              <Check size={15} /> {isEdit ? t('common.save') : t('nouvelleMission.addMethod')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Modal de génération en série : "type de méthode + nombre" → N cartes
//    piège brouillon (ex: CDC_2, CDC_3, CDC_4), chacune vide à part son
//    type/numéro — à compléter individuellement ensuite, comme les localités.
function MethodeBulkModal({ localite, onClose, onGenerate }) {
  const t = useT();
  const [typeMethodeId, setTypeMethodeId] = useState('');
  const [count, setCount] = useState('1');

  const { data: typesMethode } = useApiQuery('/dictionnaire/types-methode', {
    params: { actif: 'true' }, select: (r) => r.items ?? [],
  });
  const selectedType = (typesMethode ?? []).find((tm) => tm.id === parseInt(typeMethodeId));
  const typeOptions  = (typesMethode ?? []).map((tm) => ({ value: tm.id, label: tm.nom, keywords: tm.code }));

  const nextNumero = selectedType
    ? (() => {
        const siblingNums = (localite.methodes || [])
          .filter((m) => String(m.typeMethodeId) === String(typeMethodeId))
          .map((m) => parseInt(m.numero) || 1);
        return (siblingNums.length ? Math.max(...siblingNums) : 0) + 1;
      })()
    : 1;

  const n = Math.max(1, Math.min(20, parseInt(count) || 1));
  const preview = selectedType
    ? Array.from({ length: n }, (_, i) => `${selectedType.code}_${nextNumero + i}`)
    : [];

  const submit = (e) => {
    e.preventDefault();
    if (!typeMethodeId) return;
    onGenerate(typeMethodeId, n);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="bg-surface rounded-2xl shadow-2xl w-full max-w-md my-4 sm:my-8">
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-5 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface/20 flex items-center justify-center">
              <Layers size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{t('nouvelleMission.bulkTitle')}</h2>
              <p className="text-xs text-white/80">{localite.nom || t('nouvelleMission.unnamedLocality')}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <FormField label={t('methodeForm.typeMethode')} name="typeMethodeId" type="select"
            value={typeMethodeId} onChange={(e) => setTypeMethodeId(e.target.value)}
            options={typeOptions} required />
          <FormField label={t('nouvelleMission.trapCount')} name="count" type="number"
            value={count} onChange={(e) => setCount(e.target.value)}
            hint={t('nouvelleMission.trapCountHint')} />

          {preview.length > 0 && (
            <div className="text-xs text-fg-subtle bg-surface-2/60 rounded-lg px-3 py-2">
              <span className="font-medium text-fg-muted">{t('nouvelleMission.willGenerate')} </span>
              <span className="font-mono">{preview.join(', ')}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" disabled={!typeMethodeId} className="btn-primary">
              <Check size={15} /> {t('nouvelleMission.generate')}{n > 1 ? ` (${n})` : ''}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NouvelleMission() {
  const t = useT();
  const navigate = useNavigate();

  const [mission, setMission] = useState({
    ordreMission: '', projetId: '', chefMissionId: '', chefMissionNom: '',
    dateDebut: '', dateFin: '', objet: '', observations: '',
    agentIds: [],
  });
  const [chefMode, setChefMode] = useState('systeme'); // 'systeme' | 'externe'
  const [localites, setLocalites]   = useState([defaultLocalite()]);
  const [projets, setProjets]       = useState([]);
  const [users, setUsers]           = useState([]);
  const [isLoading, setIsLoading]   = useState(false);
  const [errors, setErrors]         = useState({});
  const [activeLocalite, setActiveLocalite] = useState(0);
  const [methodeModal, setMethodeModal] = useState(null); // { localiteIndex, methodeIndex? }
  const [bulkModal, setBulkModal] = useState(null); // { localiteIndex }

  useEffect(() => {
    Promise.all([api.get('/projets'), api.get('/auth/users')])
      .then(([pRes, uRes]) => {
        setProjets(pRes.data.projets);
        setUsers(uRes.data.actifs);
      }).catch(() => toast.error(t('nouvelleMission.loadRefsError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: typesMethode } = useApiQuery('/dictionnaire/types-methode', {
    params: { actif: 'true' }, select: (r) => r.items ?? [],
  });
  const { data: typesHabitat } = useApiQuery('/dictionnaire/types-habitat', {
    params: { actif: 'true' }, select: (r) => r.items ?? [],
  });
  const { data: typesEnv } = useApiQuery('/dictionnaire/types-environnement', {
    params: { actif: 'true' }, select: (r) => r.items ?? [],
  });

  const saveMethode = (localiteIndex, methodeIndex, draft) => {
    setLocalites((prev) => {
      const updated = [...prev];
      const methodes = [...(updated[localiteIndex].methodes || [])];
      if (methodeIndex === undefined || methodeIndex === null) methodes.push(draft);
      else methodes[methodeIndex] = draft;
      updated[localiteIndex] = { ...updated[localiteIndex], methodes };
      return updated;
    });
    setMethodeModal(null);
  };

  // Génération en série : N cartes piège vides (sauf type/numéro), à
  // compléter individuellement — même logique d'auto-incrément que l'ajout
  // unitaire (handleFieldsChange de MethodeDraftModal), appliquée N fois.
  const generateMethodes = (localiteIndex, typeMethodeId, count) => {
    setLocalites((prev) => {
      const updated = [...prev];
      const existing = updated[localiteIndex].methodes || [];
      const siblingNums = existing
        .filter((m) => String(m.typeMethodeId) === String(typeMethodeId))
        .map((m) => parseInt(m.numero) || 1);
      let next = (siblingNums.length ? Math.max(...siblingNums) : 0) + 1;
      const generated = [];
      for (let i = 0; i < count; i++) {
        generated.push({ ...defaultMethode(), typeMethodeId: String(typeMethodeId), numero: String(next) });
        next += 1;
      }
      updated[localiteIndex] = { ...updated[localiteIndex], methodes: [...existing, ...generated] };
      return updated;
    });
    setBulkModal(null);
  };

  const removeMethode = (localiteIndex, methodeIndex) => {
    setLocalites((prev) => {
      const updated = [...prev];
      updated[localiteIndex] = {
        ...updated[localiteIndex],
        methodes: updated[localiteIndex].methodes.filter((_, i) => i !== methodeIndex),
      };
      return updated;
    });
  };

  const handleMissionChange = (e) => {
    setErrors({ ...errors, [e.target.name]: null });
    setMission({ ...mission, [e.target.name]: e.target.value });
  };

  // patch : objet partiel — mergé sur l'état le plus récent (évite les races
  // entre lookups PostGIS/altitude concurrents résolus dans le désordre).
  const updateLocalite = (index, patch) => {
    setLocalites((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  const addLocalite = () => {
    setLocalites([...localites, defaultLocalite()]);
    setActiveLocalite(localites.length);
  };

  const removeLocalite = (index) => {
    if (localites.length === 1) return;
    const updated = localites.filter((_, i) => i !== index);
    setLocalites(updated);
    setActiveLocalite(Math.min(activeLocalite, updated.length - 1));
  };

  const validate = () => {
    const errs = {};
    if (!mission.ordreMission) errs.ordreMission = t('nouvelleMission.ordreMissionRequired');
    if (!mission.projetId)     errs.projetId     = t('nouvelleMission.projetRequired');
    if (!mission.dateDebut)    errs.dateDebut    = t('nouvelleMission.dateDebutRequired');
    localites.forEach((l, i) => {
      if (!l.nom)       errs[`localite_${i}_nom`]       = t('nouvelleMission.nomRequired');
      if (!l.region)    errs[`localite_${i}_region`]    = t('nouvelleMission.regionRequired');
      if (!l.district)  errs[`localite_${i}_district`]  = t('nouvelleMission.districtRequired');
      if (!l.commune)   errs[`localite_${i}_commune`]   = t('nouvelleMission.communeRequired');
      if (!l.fokontany) errs[`localite_${i}_fokontany`] = t('nouvelleMission.fokontanyRequired');
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      const missionRes = await api.post('/missions', {
        ...mission,
        projetId:       parseInt(mission.projetId),
        chefMissionId:  chefMode === 'systeme' && mission.chefMissionId ? parseInt(mission.chefMissionId) : null,
        chefMissionNom: chefMode === 'externe' ? mission.chefMissionNom || null : null,
        agentIds:       mission.agentIds.map((id) => parseInt(id)),
        dateFin:        mission.dateFin || null,
      });
      const missionId = missionRes.data.mission.id;
      const localiteResults = await Promise.all(
        localites.map((l) => api.post('/localites', {
          ...l,
          methodes:  undefined, // brouillon local — créées séparément ci-dessous une fois l'id réel connu
          missionId,
          latitude:  l.latitude  ? parseFloat(l.latitude)  : null,
          longitude: l.longitude ? parseFloat(l.longitude) : null,
          altitudeM: l.altitudeM ? parseFloat(l.altitudeM) : null,
        }))
      );
      // Une fois les localités créées (et leur id réel connu), on crée les
      // méthodes brouillon rattachées à chacune.
      await Promise.all(
        localiteResults.flatMap((res, i) => {
          const localiteId = res.data.localite.id;
          return (localites[i].methodes || []).map((m) => api.post('/methodes', {
            ...m,
            localiteId,
            typeMethodeId:       m.typeMethodeId       ? parseInt(m.typeMethodeId)       : null,
            numero:              parseInt(m.numero) || 1,
            typeHabitatId:       m.typeHabitatId       ? parseInt(m.typeHabitatId)       : null,
            typeEnvironnementId: m.typeEnvironnementId ? parseInt(m.typeEnvironnementId) : null,
            interieurExterieur:  m.interieurExterieur || null,
            datePose:            m.datePose   || null,
            dateReleve:          m.dateReleve || null,
            latitude:            m.latitude  || null,
            longitude:           m.longitude || null,
            altitudeM:           m.altitudeM || null,
          }));
        })
      );
      navigate(`/missions/${missionId}`);
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || t('nouvelleMission.creationError') });
    } finally {
      setIsLoading(false);
    }
  };

  const projetOptions = projets.map(p => ({ value: p.id, label: p.porteur ? `${p.nom} / ${p.porteur}` : p.nom }));
  const userOptions   = users.map(u  => ({ value: u.id, label: `${u.prenom} ${u.nom} (${u.role})` }));
  const selectedProjet   = projets.find((p) => p.id === parseInt(mission.projetId));
  const selectedChef     = chefMode === 'systeme' ? users.find((u) => u.id === parseInt(mission.chefMissionId)) : null;
  const chefLabel        = chefMode === 'systeme' ? (selectedChef ? `${selectedChef.prenom} ${selectedChef.nom}` : null) : (mission.chefMissionNom || null);
  const selectedAgents   = users.filter((u) => mission.agentIds.includes(u.id));

  return (
    <div className="space-y-5">

      <Link to="/missions" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> {t('nouvelleMission.backToList')}
      </Link>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr,300px] gap-5 items-start">

          {/* ═══ Colonne principale ═══ */}
          <div className="space-y-5">

        {errors.submit && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-sm text-danger">
            {errors.submit}
          </div>
        )}

        {/* Section Mission */}
        <div className="card p-6">
          <h2 className="section-title">
            <ClipboardList size={17} className="text-primary-500" />
            {t('nouvelleMission.missionInfo')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label={t('nouvelleMission.ordreMission')} name="ordreMission"
              value={mission.ordreMission} onChange={handleMissionChange}
              placeholder={t('nouvelleMission.ordreMissionPlaceholder')} required error={errors.ordreMission}
              hint={t('nouvelleMission.ordreMissionHint')}
            />
            <FormField
              label={t('nouvelleMission.projet')} name="projetId" type="select"
              value={mission.projetId} onChange={handleMissionChange}
              options={projetOptions} required error={errors.projetId}
            />
            {/* Chef de mission — utilisateur du système ou personne externe.
                Pleine largeur : plus haut que les autres champs (label +
                bascule + select/texte), le mettre en pleine largeur évite un
                appariement de ligne déséquilibré et laisse Date de
                début/Date de fin se retrouver naturellement côte à côte. */}
            <div className="space-y-2 md:col-span-2">
              <p className="text-xs font-semibold text-fg-muted tracking-wide flex items-center gap-1.5">
                <User size={12} /> {t('nouvelleMission.missionLead')}
              </p>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => { setChefMode('systeme'); setMission((m) => ({ ...m, chefMissionNom: '' })); }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    chefMode === 'systeme'
                      ? 'bg-primary text-white border-primary-600'
                      : 'bg-surface text-fg-muted border-border-strong hover:bg-surface-2'
                  }`}
                >
                  <UserCheck size={12} /> {t('nouvelleMission.systemUser')}
                </button>
                <button
                  type="button"
                  onClick={() => { setChefMode('externe'); setMission((m) => ({ ...m, chefMissionId: '' })); }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    chefMode === 'externe'
                      ? 'bg-primary text-white border-primary-600'
                      : 'bg-surface text-fg-muted border-border-strong hover:bg-surface-2'
                  }`}
                >
                  <UserX size={12} /> {t('nouvelleMission.externalPerson')}
                </button>
              </div>
              {chefMode === 'systeme' ? (
                <FormField
                  name="chefMissionId" type="select"
                  value={mission.chefMissionId} onChange={handleMissionChange}
                  options={userOptions}
                />
              ) : (
                <FormField
                  name="chefMissionNom"
                  value={mission.chefMissionNom} onChange={handleMissionChange}
                  placeholder={t('nouvelleMission.leadNamePlaceholder')}
                  hint={t('nouvelleMission.leadNameHint')}
                />
              )}
            </div>
            <FormField
              label={t('nouvelleMission.startDate')} name="dateDebut" type="date"
              value={mission.dateDebut} onChange={handleMissionChange}
              required error={errors.dateDebut}
            />
            <FormField
              label={t('nouvelleMission.endDate')} name="dateFin" type="date"
              value={mission.dateFin} onChange={handleMissionChange}
            />
            <div className="md:col-span-2">
              <AgentMultiSelect
                label={t('agentMultiSelect.defaultLabel')}
                value={mission.agentIds}
                onChange={(ids) => setMission((m) => ({ ...m, agentIds: ids }))}
                users={users}
                max={20}
                hint={t('nouvelleMission.agentsHint')}
              />
            </div>
            <div className="md:col-span-2">
              <FormField
                label={t('nouvelleMission.missionObject')} name="objet" type="textarea"
                value={mission.objet} onChange={handleMissionChange}
                placeholder={t('nouvelleMission.missionObjectPlaceholder')}
              />
            </div>
            <div className="md:col-span-2">
              <FormField
                label={t('nouvelleMission.observations')} name="observations" type="textarea"
                value={mission.observations} onChange={handleMissionChange}
                placeholder={t('nouvelleMission.observationsPlaceholder')}
              />
            </div>
          </div>
        </div>

        {/* Section Localités */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
            <h2 className="flex items-center gap-2.5 text-sm font-semibold text-gray-700">
              <MapPin size={17} className="text-primary-500" />
              {t('nouvelleMission.localities')}
              <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {localites.length}
              </span>
            </h2>
            <button
              type="button" onClick={addLocalite}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={13} /> {t('nouvelleMission.add')}
            </button>
          </div>

          {/* Onglets */}
          {localites.length > 1 && (
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              {localites.map((l, i) => (
                <button
                  key={i} type="button"
                  onClick={() => setActiveLocalite(i)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    activeLocalite === i
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {i + 1}. {l.nom || t('nouvelleMission.unnamed')}{l.methodes?.length > 0 ? ` (${l.methodes.length})` : ''}
                </button>
              ))}
            </div>
          )}

          {localites.map((loc, index) => (
            <div key={index} className={index === activeLocalite ? 'block' : 'hidden'}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {interpolate(t('nouvelleMission.localityN'), { n: index + 1 })}{loc.nom ? ` — ${loc.nom}` : ''}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-info/10 text-info border border-info/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    <Beaker size={9} /> {loc.methodes?.length ?? 0} {t('nouvelleMission.methodCount')}
                  </span>
                </div>
                {localites.length > 1 && (
                  <button
                    type="button" onClick={() => removeLocalite(index)}
                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} /> {t('nouvelleMission.remove')}
                  </button>
                )}
              </div>

              <LocaliteFieldsForm
                value={loc}
                onChange={(patch) => updateLocalite(index, patch)}
                errors={{
                  nom:       errors[`localite_${index}_nom`],
                  region:    errors[`localite_${index}_region`],
                  district:  errors[`localite_${index}_district`],
                  commune:   errors[`localite_${index}_commune`],
                  fokontany: errors[`localite_${index}_fokontany`],
                }}
              />

              {/* Méthodes de collecte — brouillon, créées après la localité.
                  Encadré pour bien montrer qu'elles sont groupées sous cette localité. */}
              <div className="mt-5 p-3 rounded-xl border border-border bg-surface-2/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Beaker size={12} /> {t('nouvelleMission.collectionMethods')} ({loc.methodes?.length ?? 0})
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBulkModal({ localiteIndex: index })}
                      className="inline-flex items-center gap-1 text-xs font-medium text-fg-subtle hover:text-primary-600 bg-surface-2/60 hover:bg-primary-50 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <Layers size={12} /> {t('nouvelleMission.bulkGenerate')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethodeModal({ localiteIndex: index })}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <Plus size={12} /> {t('nouvelleMission.add')}
                    </button>
                  </div>
                </div>

                {loc.methodes?.length > 0 ? (
                  <div className="space-y-1">
                    {loc.methodes.map((m, mIndex) => {
                      const type = (typesMethode ?? []).find((tm) => tm.id === parseInt(m.typeMethodeId));
                      const identifiant = type ? `${type.code}_${m.numero || 1}` : interpolate(t('nouvelleMission.methodFallback'), { n: mIndex + 1 });
                      const habitat = (typesHabitat ?? []).find((tm) => tm.id === parseInt(m.typeHabitatId));
                      const env     = (typesEnv ?? []).find((tm) => tm.id === parseInt(m.typeEnvironnementId));
                      // Position propre au piège si précisée, sinon héritée de la localité brouillon.
                      const lat = parseFloat(m.latitude  || loc.latitude);
                      const lng = parseFloat(m.longitude || loc.longitude);
                      const alt = parseFloat(m.altitudeM || loc.altitudeM);
                      return (
                        <div key={mIndex} className="flex items-center justify-between gap-2 text-xs bg-surface-2/60 rounded-lg px-2.5 py-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-semibold text-fg flex-shrink-0">{identifiant}</span>
                            <span className="text-fg-subtle truncate">
                              {[
                                habitat?.nom,
                                env?.nom,
                                m.interieurExterieur === 'interieur' ? t('methodeForm.interieur') : m.interieurExterieur === 'exterieur' ? t('methodeForm.exterieur') : null,
                              ].filter(Boolean).join(' · ')}
                            </span>
                            {m.datePose && (
                              <span className="text-fg-subtle whitespace-nowrap">
                                {new Date(m.datePose).toLocaleDateString(t('common.locale'))}
                              </span>
                            )}
                            {!Number.isNaN(lat) && !Number.isNaN(lng) && (
                              <span
                                className={`inline-flex items-center gap-1 font-mono whitespace-nowrap ${m.latitude ? 'text-fg-subtle' : 'text-fg-subtle/60'}`}
                                title={m.latitude ? t('nouvelleMission.ownPosition') : t('nouvelleMission.inheritedPosition')}
                              >
                                <MapPin size={9} />
                                {lat.toFixed(4)}, {lng.toFixed(4)}
                                {!Number.isNaN(alt) && ` · ${Math.round(alt)} m`}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setMethodeModal({ localiteIndex: index, methodeIndex: mIndex })}
                              className="p-1 text-fg-subtle hover:text-primary hover:bg-primary/10 rounded"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeMethode(index, mIndex)}
                              className="p-1 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-fg-subtle italic">{t('nouvelleMission.noMethodAdded')}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link to="/missions" className="btn-secondary">{t('common.cancel')}</Link>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading
              ? <><Loader2 size={15} className="animate-spin" /> {t('nouvelleMission.creating')}</>
              : <><Check size={15} /> {t('nouvelleMission.createMission')}</>
            }
          </button>
        </div>

        </div>{/* fin colonne principale */}

          {/* ═══ Sidebar récap ═══ */}
          <aside className="space-y-4 xl:sticky xl:top-4 self-start">

            {/* Récap mission */}
            <div className="card p-4 bg-primary/5 border-primary/10">
              <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ClipboardList size={13} className="text-primary" /> {t('nouvelleMission.summary')}
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5">{t('nouvelleMission.ordreMission')}</p>
                  <p className="text-sm font-mono font-bold text-primary">
                    {mission.ordreMission || <span className="text-fg-subtle font-normal italic">{t('nouvelleMission.undefined')}</span>}
                  </p>
                </div>
                {selectedProjet && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5">{t('nouvelleMission.projet')}</p>
                    <p className="text-xs font-medium text-fg">{selectedProjet.nom}{selectedProjet.porteur ? ` / ${selectedProjet.porteur}` : ''}</p>
                  </div>
                )}
                {(mission.dateDebut || mission.dateFin) && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5 flex items-center gap-1"><Calendar size={9} /> {t('nouvelleMission.period')}</p>
                    <p className="text-xs text-fg">
                      {mission.dateDebut ? new Date(mission.dateDebut).toLocaleDateString(t('common.locale')) : '?'}
                      {' → '}
                      {mission.dateFin ? new Date(mission.dateFin).toLocaleDateString(t('common.locale')) : '?'}
                    </p>
                  </div>
                )}
                {chefLabel && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <User size={9} /> {t('nouvelleMission.lead')}
                      {chefMode === 'externe' && <span className="ml-1 text-warning">{t('nouvelleMission.external')}</span>}
                    </p>
                    <p className="text-xs text-fg">{chefLabel}</p>
                  </div>
                )}
                {selectedAgents.length > 0 && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-1.5">{interpolate(t('nouvelleMission.agentsCount'), { n: selectedAgents.length })}</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedAgents.map((u) => (
                        <span key={u.id} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {u.prenom} {u.nom?.[0]}.
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Localités résumé */}
            <div className="card p-4">
              <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Navigation size={13} className="text-primary" /> {interpolate(t('nouvelleMission.localitiesCount'), { n: localites.length })}
              </p>
              <div className="space-y-1.5">
                {localites.map((l, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${i === activeLocalite ? 'bg-primary/10 text-primary' : 'text-fg-muted'}`}>
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                    <span className="truncate">{l.nom || <span className="italic text-fg-subtle">{t('nouvelleMission.unnamed')}</span>}</span>
                    {l.code && <span className="font-mono text-[10px] ml-auto">{l.code}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Aide */}
            <div className="card p-4">
              <p className="text-[11px] text-fg-muted space-y-1.5 leading-relaxed">
                <span className="block">• {t('nouvelleMission.helpOrdrePrefix')} <strong>{t('nouvelleMission.helpOrdreWord')}</strong> {t('nouvelleMission.helpOrdreSuffix')}</span>
                <span className="block">• {t('nouvelleMission.helpCodePrefix')} <strong>{t('nouvelleMission.helpCodeWord')}</strong> {t('nouvelleMission.helpCodeSuffix')}</span>
                <span className="block">• {t('nouvelleMission.helpMapPrefix')} <strong>{t('nouvelleMission.helpMapWord')}</strong> {t('nouvelleMission.helpMapSuffix')}</span>
              </p>
            </div>
          </aside>

        </div>{/* fin grid 2-col */}
      </form>

      {methodeModal && (
        <MethodeDraftModal
          localite={localites[methodeModal.localiteIndex]}
          initial={
            methodeModal.methodeIndex !== undefined
              ? localites[methodeModal.localiteIndex].methodes[methodeModal.methodeIndex]
              : null
          }
          onClose={() => setMethodeModal(null)}
          onSave={(draft) => saveMethode(methodeModal.localiteIndex, methodeModal.methodeIndex, draft)}
        />
      )}

      {bulkModal && (
        <MethodeBulkModal
          localite={localites[bulkModal.localiteIndex]}
          onClose={() => setBulkModal(null)}
          onGenerate={(typeMethodeId, count) => generateMethodes(bulkModal.localiteIndex, typeMethodeId, count)}
        />
      )}
    </div>
  );
}
