import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, MapPin, ClipboardList, Plus, Trash2, Check, Loader2, Calendar, User,
  Navigation, UserCheck, UserX, Beaker, X, Edit2, Layers,
} from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import LocaliteFieldsForm from '../../components/LocaliteFieldsForm';
import MethodeFieldsForm from '../../components/MethodeFieldsForm';
import AgentMultiSelect from '../../components/AgentMultiSelect';
import { useApiQuery } from '../../hooks';

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
  const [form, setForm] = useState(initial ?? defaultMethode());
  const isEdit = !!initial;

  const { data: typesMethode } = useApiQuery('/dictionnaire/types-methode', {
    params: { actif: 'true' }, select: (r) => r.items ?? [],
  });
  const selectedType = (typesMethode ?? []).find((t) => t.id === parseInt(form.typeMethodeId));
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
                {isEdit ? 'Modifier la méthode' : 'Nouvelle méthode'}
              </h2>
              <p className="text-xs text-white/80">{localite.nom || 'Localité sans nom'}{identifiant ? ` — ${identifiant}` : ''}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <MethodeFieldsForm value={form} onChange={handleFieldsChange} localiteCoords={localite} />

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">
              <Check size={15} /> {isEdit ? 'Enregistrer' : 'Ajouter la méthode'}
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
  const [typeMethodeId, setTypeMethodeId] = useState('');
  const [count, setCount] = useState('1');

  const { data: typesMethode } = useApiQuery('/dictionnaire/types-methode', {
    params: { actif: 'true' }, select: (r) => r.items ?? [],
  });
  const selectedType = (typesMethode ?? []).find((t) => t.id === parseInt(typeMethodeId));
  const typeOptions  = (typesMethode ?? []).map((t) => ({ value: t.id, label: t.nom, keywords: t.code }));

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
              <h2 className="text-base font-bold text-white">Générer des pièges en série</h2>
              <p className="text-xs text-white/80">{localite.nom || 'Localité sans nom'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <FormField label="Type de méthode" name="typeMethodeId" type="select"
            value={typeMethodeId} onChange={(e) => setTypeMethodeId(e.target.value)}
            options={typeOptions} required />
          <FormField label="Nombre de pièges" name="count" type="number"
            value={count} onChange={(e) => setCount(e.target.value)}
            hint="Une carte sera créée par piège, à compléter individuellement (habitat, environnement, position…)." />

          {preview.length > 0 && (
            <div className="text-xs text-fg-subtle bg-surface-2/60 rounded-lg px-3 py-2">
              <span className="font-medium text-fg-muted">Génèrera : </span>
              <span className="font-mono">{preview.join(', ')}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={!typeMethodeId} className="btn-primary">
              <Check size={15} /> Générer{n > 1 ? ` (${n})` : ''}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NouvelleMission() {
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
      }).catch(console.error);
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
    if (!mission.ordreMission) errs.ordreMission = 'Ordre de mission obligatoire';
    if (!mission.projetId)     errs.projetId     = 'Projet obligatoire';
    if (!mission.dateDebut)    errs.dateDebut    = 'Date de début obligatoire';
    localites.forEach((l, i) => {
      if (!l.nom)       errs[`localite_${i}_nom`]       = 'Nom obligatoire';
      if (!l.region)    errs[`localite_${i}_region`]    = 'Région obligatoire';
      if (!l.district)  errs[`localite_${i}_district`]  = 'District obligatoire';
      if (!l.commune)   errs[`localite_${i}_commune`]   = 'Commune obligatoire';
      if (!l.fokontany) errs[`localite_${i}_fokontany`] = 'Fokontany obligatoire';
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
      setErrors({ submit: err.response?.data?.error || 'Erreur lors de la création' });
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
        <ChevronLeft size={16} /> Missions
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
            Informations sur la mission
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Ordre de mission" name="ordreMission"
              value={mission.ordreMission} onChange={handleMissionChange}
              placeholder="ex: 0256/2025" required error={errors.ordreMission}
              hint="Format libre — ex: 0256/2025 ou MSN-2025-01"
            />
            <FormField
              label="Projet" name="projetId" type="select"
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
                <User size={12} /> Chef de mission
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
                  <UserCheck size={12} /> Utilisateur du système
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
                  <UserX size={12} /> Personne externe
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
                  placeholder="Nom et prénom du chef de mission (personne externe)"
                  hint="Cette personne n'a pas de compte dans l'application"
                />
              )}
            </div>
            <FormField
              label="Date de début" name="dateDebut" type="date"
              value={mission.dateDebut} onChange={handleMissionChange}
              required error={errors.dateDebut}
            />
            <FormField
              label="Date de fin" name="dateFin" type="date"
              value={mission.dateFin} onChange={handleMissionChange}
            />
            <div className="md:col-span-2">
              <AgentMultiSelect
                label="Agents de terrain"
                value={mission.agentIds}
                onChange={(ids) => setMission((m) => ({ ...m, agentIds: ids }))}
                users={users}
                max={20}
                hint="Maximum 20 agents — sélection parmi les utilisateurs actifs"
              />
            </div>
            <div className="md:col-span-2">
              <FormField
                label="Objet de la mission" name="objet" type="textarea"
                value={mission.objet} onChange={handleMissionChange}
                placeholder="Objectif / cadre de la mission..."
              />
            </div>
            <div className="md:col-span-2">
              <FormField
                label="Observations" name="observations" type="textarea"
                value={mission.observations} onChange={handleMissionChange}
                placeholder="Notes, contexte de la mission..."
              />
            </div>
          </div>
        </div>

        {/* Section Localités */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
            <h2 className="flex items-center gap-2.5 text-sm font-semibold text-gray-700">
              <MapPin size={17} className="text-primary-500" />
              Localités
              <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {localites.length}
              </span>
            </h2>
            <button
              type="button" onClick={addLocalite}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={13} /> Ajouter
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
                  {i + 1}. {l.nom || 'Sans nom'}{l.methodes?.length > 0 ? ` (${l.methodes.length})` : ''}
                </button>
              ))}
            </div>
          )}

          {localites.map((loc, index) => (
            <div key={index} className={index === activeLocalite ? 'block' : 'hidden'}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Localité n°{index + 1}{loc.nom ? ` — ${loc.nom}` : ''}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-info/10 text-info border border-info/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    <Beaker size={9} /> {loc.methodes?.length ?? 0} méthode{(loc.methodes?.length ?? 0) > 1 ? 's' : ''}
                  </span>
                </div>
                {localites.length > 1 && (
                  <button
                    type="button" onClick={() => removeLocalite(index)}
                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} /> Supprimer
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
                    <Beaker size={12} /> Méthodes de collecte ({loc.methodes?.length ?? 0})
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBulkModal({ localiteIndex: index })}
                      className="inline-flex items-center gap-1 text-xs font-medium text-fg-subtle hover:text-primary-600 bg-surface-2/60 hover:bg-primary-50 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <Layers size={12} /> Générer en série
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethodeModal({ localiteIndex: index })}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <Plus size={12} /> Ajouter
                    </button>
                  </div>
                </div>

                {loc.methodes?.length > 0 ? (
                  <div className="space-y-1">
                    {loc.methodes.map((m, mIndex) => {
                      const type = (typesMethode ?? []).find((t) => t.id === parseInt(m.typeMethodeId));
                      const identifiant = type ? `${type.code}_${m.numero || 1}` : `Méthode ${mIndex + 1}`;
                      const habitat = (typesHabitat ?? []).find((t) => t.id === parseInt(m.typeHabitatId));
                      const env     = (typesEnv ?? []).find((t) => t.id === parseInt(m.typeEnvironnementId));
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
                                m.interieurExterieur === 'interieur' ? 'Intérieur' : m.interieurExterieur === 'exterieur' ? 'Extérieur' : null,
                              ].filter(Boolean).join(' · ')}
                            </span>
                            {m.datePose && (
                              <span className="text-fg-subtle whitespace-nowrap">
                                {new Date(m.datePose).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                            {!Number.isNaN(lat) && !Number.isNaN(lng) && (
                              <span
                                className={`inline-flex items-center gap-1 font-mono whitespace-nowrap ${m.latitude ? 'text-fg-subtle' : 'text-fg-subtle/60'}`}
                                title={m.latitude ? 'Position propre au piège' : 'Position héritée de la localité'}
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
                  <p className="text-xs text-fg-subtle italic">Aucune méthode ajoutée.</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link to="/missions" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading
              ? <><Loader2 size={15} className="animate-spin" /> Création…</>
              : <><Check size={15} /> Créer la mission</>
            }
          </button>
        </div>

        </div>{/* fin colonne principale */}

          {/* ═══ Sidebar récap ═══ */}
          <aside className="space-y-4 xl:sticky xl:top-4 self-start">

            {/* Récap mission */}
            <div className="card p-4 bg-primary/5 border-primary/10">
              <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ClipboardList size={13} className="text-primary" /> Récapitulatif
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5">Ordre de mission</p>
                  <p className="text-sm font-mono font-bold text-primary">
                    {mission.ordreMission || <span className="text-fg-subtle font-normal italic">— à définir —</span>}
                  </p>
                </div>
                {selectedProjet && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5">Projet</p>
                    <p className="text-xs font-medium text-fg">{selectedProjet.nom}{selectedProjet.porteur ? ` / ${selectedProjet.porteur}` : ''}</p>
                  </div>
                )}
                {(mission.dateDebut || mission.dateFin) && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5 flex items-center gap-1"><Calendar size={9} /> Période</p>
                    <p className="text-xs text-fg">
                      {mission.dateDebut ? new Date(mission.dateDebut).toLocaleDateString('fr-FR') : '?'}
                      {' → '}
                      {mission.dateFin ? new Date(mission.dateFin).toLocaleDateString('fr-FR') : '?'}
                    </p>
                  </div>
                )}
                {chefLabel && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <User size={9} /> Chef
                      {chefMode === 'externe' && <span className="ml-1 text-warning">(externe)</span>}
                    </p>
                    <p className="text-xs text-fg">{chefLabel}</p>
                  </div>
                )}
                {selectedAgents.length > 0 && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-1.5">Agents ({selectedAgents.length}/20)</p>
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
                <Navigation size={13} className="text-primary" /> Localités ({localites.length})
              </p>
              <div className="space-y-1.5">
                {localites.map((l, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${i === activeLocalite ? 'bg-primary/10 text-primary' : 'text-fg-muted'}`}>
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                    <span className="truncate">{l.nom || <span className="italic text-fg-subtle">Sans nom</span>}</span>
                    {l.code && <span className="font-mono text-[10px] ml-auto">{l.code}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Aide */}
            <div className="card p-4">
              <p className="text-[11px] text-fg-muted space-y-1.5 leading-relaxed">
                <span className="block">• L'<strong>ordre de mission</strong> doit être unique.</span>
                <span className="block">• Chaque localité a un <strong>code à 3 lettres</strong> (ex: AKZ) qui préfixe les ID terrain des spécimens.</span>
                <span className="block">• Cliquez sur la carte pour <strong>auto-remplir</strong> région / district / commune / fokontany.</span>
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
