import { useParams, Link } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import {
  MapPin, Loader2, Navigation, Hash, Plus, Edit2, X, Check, Tag,
  Clock, Layers, Bug, Users, Beaker,
} from 'lucide-react';
import api from '../../api/axios';
import { toast } from '../../lib/toast';
import { Card, Breadcrumb } from '../../components/ui';
import FormField from '../../components/FormField';
import LocaliteFieldsForm from '../../components/LocaliteFieldsForm';
import AgentMultiSelect from '../../components/AgentMultiSelect';
import MethodeFieldsForm from '../../components/MethodeFieldsForm';
import useAuthStore from '../../store/authStore';
import { useApiQuery } from '../../hooks';
import { useT, interpolate } from '../../lib/i18n';
import { roleLabel } from '../../lib/roles';

const TYPE_COLOR = {
  moustique: 'bg-specimen-moustique',
  tique:     'bg-specimen-tique',
  puce:      'bg-specimen-puce',
};
const TYPE_PLURAL = {
  moustique: 'dashboard.moustiques',
  tique:     'dashboard.tiques',
  puce:      'dashboard.puces',
};

const ROLES = { admin: 5, superviseur: 4, chercheur: 3, technicien: 2, lecteur: 1 };
const isMin = (r, m) => (ROLES[r] || 0) >= ROLES[m];

function MiniBar({ value, max, colorClass = 'bg-primary' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold text-fg tabular-nums w-8 text-right">{value}</span>
    </div>
  );
}

// ── Modal création / édition de localité ──────────────────────
// ── Édition de la mission (chef, dates, agents, objet) ───────────────
// Les agents de terrain n'étaient saisissables qu'à la création : le backend
// acceptait pourtant `agentIds` en PUT, mais aucun écran ne l'appelait. Les
// missions créées autrement restaient donc sans agents, définitivement.
function MissionModal({ mission, onClose, onSaved }) {
  const t = useT();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    chefMissionId:  mission.chefMission?.id ? String(mission.chefMission.id) : '',
    chefMissionNom: mission.chefMissionNom || '',
    dateDebut:      mission.dateDebut ? mission.dateDebut.slice(0, 10) : '',
    dateFin:        mission.dateFin   ? mission.dateFin.slice(0, 10)   : '',
    objet:          mission.objet         || '',
    observations:   mission.observations  || '',
    agentIds:       mission.agents?.map((a) => a.user?.id).filter(Boolean) ?? [],
  });
  // Un chef hors application est saisi en texte libre ; les deux champs
  // s'excluent, c'est le mode qui décide lequel est envoyé.
  const [chefMode, setChefMode] = useState(mission.chefMissionNom && !mission.chefMission ? 'externe' : 'systeme');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    api.get('/auth/users')
      .then((r) => setUsers(r.data.users || r.data.items || []))
      .catch(() => toast.error(t('missionDetail.usersLoadError')));
  }, [t]);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.put(`/missions/${mission.id}`, {
        chefMissionId:  chefMode === 'systeme' ? (form.chefMissionId || null) : null,
        chefMissionNom: chefMode === 'externe' ? (form.chefMissionNom || null) : null,
        dateDebut:      form.dateDebut,
        dateFin:        form.dateFin || null,
        objet:          form.objet || null,
        observations:   form.observations || null,
        agentIds:       form.agentIds.map((i) => parseInt(i)),
      });
      toast.success(t('missionDetail.missionSaved'));
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const userOptions = [
    { value: '', label: t('missionDetail.noLead') },
    ...users.map((u) => ({ value: String(u.id), label: `${u.prenom} ${u.nom} — ${roleLabel(u.role, t)}` })),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl my-4 sm:my-8 max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-5 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface/20 flex items-center justify-center">
              <Users size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{t('missionDetail.editMission')}</h2>
              <p className="text-xs text-primary-200">{mission.ordreMission}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <button type="button" onClick={() => setChefMode('systeme')}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors min-h-[44px] md:min-h-0 ${
                    chefMode === 'systeme' ? 'bg-primary text-white border-primary-600'
                      : 'bg-surface text-fg-muted border-border-strong hover:bg-surface-2'}`}>
                  {t('missionDetail.leadSystemUser')}
                </button>
                <button type="button" onClick={() => setChefMode('externe')}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors min-h-[44px] md:min-h-0 ${
                    chefMode === 'externe' ? 'bg-primary text-white border-primary-600'
                      : 'bg-surface text-fg-muted border-border-strong hover:bg-surface-2'}`}>
                  {t('missionDetail.leadExternal')}
                </button>
              </div>
              {chefMode === 'systeme' ? (
                <FormField label={t('missionDetail.fieldLead')} name="chefMissionId" type="select"
                  value={form.chefMissionId} onChange={change} options={userOptions} />
              ) : (
                <FormField label={t('missionDetail.fieldLead')} name="chefMissionNom"
                  value={form.chefMissionNom} onChange={change}
                  placeholder={t('missionDetail.leadNamePlaceholder')} />
              )}
            </div>

            <FormField label={t('missionDetail.startDate')} name="dateDebut" type="date"
              value={form.dateDebut} onChange={change} required />
            <FormField label={t('missionDetail.endDate')} name="dateFin" type="date"
              value={form.dateFin} onChange={change} />

            <div className="md:col-span-2">
              <AgentMultiSelect
                value={form.agentIds}
                onChange={(ids) => setForm((f) => ({ ...f, agentIds: ids }))}
                users={users} max={20}
                hint={t('missionDetail.agentsHint')}
              />
            </div>

            <div className="md:col-span-2">
              <FormField label={t('missionDetail.missionObject')} name="objet" type="textarea"
                value={form.objet} onChange={change} />
            </div>
            <div className="md:col-span-2">
              <FormField label={t('missionDetail.observations')} name="observations" type="textarea"
                value={form.observations} onChange={change} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-5 mt-5 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {t('common.save')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function LocaliteModal({ missionId, localite, onClose, onSaved }) {
  const t = useT();
  const isEdit = !!localite?.id;
  const [form, setForm] = useState({
    code:      localite?.code      || '',
    nom:       localite?.nom       || '',
    region:    localite?.region    || '',
    district:  localite?.district  || '',
    commune:   localite?.commune   || '',
    fokontany: localite?.fokontany || '',
    contacts:  localite?.contacts  || [],
    latitude:  localite?.latitude  ? String(localite.latitude)  : '',
    longitude: localite?.longitude ? String(localite.longitude) : '',
    altitudeM: localite?.altitudeM ? String(localite.altitudeM) : '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = { ...form, missionId, code: form.code ? form.code.toUpperCase() : null };
      if (isEdit) await api.put(`/localites/${localite.id}`, body);
      else        await api.post('/localites', body);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="bg-surface rounded-2xl shadow-2xl w-full max-w-5xl my-4 sm:my-8">
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-5 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface/20 flex items-center justify-center">
              <Navigation size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEdit ? t('missionDetail.editLocality') : t('missionDetail.newLocality')}
              </h2>
              <p className="text-xs text-primary-200">
                {isEdit ? localite.nom : t('missionDetail.mapPrefillHint')}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-danger/10 border border-red-200 rounded-xl text-sm text-danger">{error}</div>}

          <div className="mb-6">
            <FormField
              label={t('missionDetail.codeLabel')} name="code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="AKZ" required
              hint={t('missionDetail.codeHint')}
            />
          </div>

          <LocaliteFieldsForm
            value={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            excludeId={localite?.id}
          />

          <div className="flex justify-end gap-2 pt-5 mt-5 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {isEdit ? t('common.save') : t('missionDetail.createLocality')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Modal création / édition de méthode de collecte ────────────
function MethodeModal({ localite, methode, onClose, onSaved }) {
  const t = useT();
  const isEdit = !!methode?.id;
  const [form, setForm] = useState({
    typeMethodeId:       methode?.typeMethode?.id       ? String(methode.typeMethode.id)       : '',
    numero:              methode?.numero ? String(methode.numero) : '1',
    typeHabitatId:       methode?.typeHabitat?.id       ? String(methode.typeHabitat.id)       : '',
    typeEnvironnementId: methode?.typeEnvironnement?.id ? String(methode.typeEnvironnement.id) : '',
    interieurExterieur:  methode?.interieurExterieur || '',
    datePose:            methode?.datePose   ? methode.datePose.slice(0, 16)   : '',
    dateReleve:          methode?.dateReleve ? methode.dateReleve.slice(0, 16) : '',
    notes:               methode?.notes      || '',
    latitude:            methode?.latitude  ? String(methode.latitude)  : '',
    longitude:           methode?.longitude ? String(methode.longitude) : '',
    altitudeM:           methode?.altitudeM != null ? String(methode.altitudeM) : '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Fetch léger juste pour l'identifiant du header (mis en cache par
  // TanStack Query — MethodeFieldsForm refait le même fetch sans coût réseau).
  const { data: typesMethode } = useApiQuery('/dictionnaire/types-methode', {
    params: { actif: 'true' }, select: (r) => r.items ?? [],
  });
  const selectedType = (typesMethode ?? []).find((tm) => tm.id === parseInt(form.typeMethodeId));
  const identifiant  = selectedType ? `${selectedType.code}_${form.numero || 1}` : null;

  // Numéro auto-incrémenté : dès qu'un type de méthode est (re)choisi lors
  // d'une création, on propose le prochain numéro libre pour ce type sur
  // cette localité — évite de retomber sur "1" et de devoir corriger à la main.
  const handleFieldsChange = (patch) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      if (!isEdit && patch.typeMethodeId !== undefined) {
        const siblingNums = (localite.methodes || [])
          .filter((m) => String(m.typeMethode?.id) === String(patch.typeMethodeId))
          .map((m) => m.numero || 1);
        next.numero = String((siblingNums.length ? Math.max(...siblingNums) : 0) + 1);
      }
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = {
        ...form,
        typeMethodeId:       form.typeMethodeId       ? parseInt(form.typeMethodeId)       : null,
        numero:              parseInt(form.numero) || 1,
        typeHabitatId:       form.typeHabitatId       ? parseInt(form.typeHabitatId)       : null,
        typeEnvironnementId: form.typeEnvironnementId ? parseInt(form.typeEnvironnementId) : null,
        interieurExterieur:  form.interieurExterieur || null,
        datePose:            form.datePose   || null,
        dateReleve:          form.dateReleve || null,
        latitude:            form.latitude     || null,
        longitude:           form.longitude    || null,
        altitudeM:           form.altitudeM    || null,
      };
      if (isEdit) await api.put(`/methodes/${methode.id}`, body);
      else        await api.post('/methodes', { ...body, localiteId: localite.id });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
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
                {isEdit ? t('missionDetail.editMethod') : t('missionDetail.newMethod')}
              </h2>
              <p className="text-xs text-white/80">{localite.nom}{identifiant ? ` — ${identifiant}` : ''}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-danger/10 border border-red-200 rounded-xl text-sm text-danger">{error}</div>}

          <MethodeFieldsForm
            value={form}
            onChange={handleFieldsChange}
            localiteCoords={localite}
            excludeMethodeId={methode?.id}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {isEdit ? t('common.save') : t('missionDetail.createMethod')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Modal de génération en série : "type de méthode + nombre" → N méthodes
//    persistées d'un coup (ex: CDC_2, CDC_3, CDC_4), chacune vide à part son
//    type/numéro — à compléter individuellement via le crayon d'édition.
function MethodeBulkModal({ localite, onClose, onGenerated }) {
  const t = useT();
  const [typeMethodeId, setTypeMethodeId] = useState('');
  const [count, setCount] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const { data: typesMethode } = useApiQuery('/dictionnaire/types-methode', {
    params: { actif: 'true' }, select: (r) => r.items ?? [],
  });
  const selectedType = (typesMethode ?? []).find((tm) => tm.id === parseInt(typeMethodeId));
  const typeOptions  = (typesMethode ?? []).map((tm) => ({ value: tm.id, label: tm.nom, keywords: tm.code }));

  const nextNumero = selectedType
    ? (() => {
        const siblingNums = (localite.methodes || [])
          .filter((m) => String(m.typeMethode?.id) === String(typeMethodeId))
          .map((m) => m.numero || 1);
        return (siblingNums.length ? Math.max(...siblingNums) : 0) + 1;
      })()
    : 1;

  const n = Math.max(1, Math.min(20, parseInt(count) || 1));
  const preview = selectedType
    ? Array.from({ length: n }, (_, i) => `${selectedType.code}_${nextNumero + i}`)
    : [];

  const submit = async (e) => {
    e.preventDefault();
    if (!typeMethodeId) return;
    setError(null);
    setLoading(true);
    try {
      for (let i = 0; i < n; i++) {
        await api.post('/methodes', {
          localiteId:    localite.id,
          typeMethodeId: parseInt(typeMethodeId),
          numero:        nextNumero + i,
        });
      }
      onGenerated();
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
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
              <h2 className="text-base font-bold text-white">{t('missionDetail.bulkTitle')}</h2>
              <p className="text-xs text-white/80">{localite.nom}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-danger/10 border border-red-200 rounded-xl text-sm text-danger">{error}</div>}

          <FormField label={t('methodeForm.typeMethode')} name="typeMethodeId" type="select"
            value={typeMethodeId} onChange={(e) => setTypeMethodeId(e.target.value)}
            options={typeOptions} required />
          <FormField label={t('missionDetail.trapCount')} name="count" type="number"
            value={count} onChange={(e) => setCount(e.target.value)}
            hint={t('missionDetail.trapCountHint')} />

          {preview.length > 0 && (
            <div className="text-xs text-fg-subtle bg-surface-2/60 rounded-lg px-3 py-2">
              <span className="font-medium text-fg-muted">{t('missionDetail.willGenerate')} </span>
              <span className="font-mono">{preview.join(', ')}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" disabled={!typeMethodeId || loading} className="btn-primary">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {t('missionDetail.generate')}{n > 1 ? ` (${n})` : ''}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────
export default function MissionDetail() {
  const t = useT();
  const { id } = useParams();
  const { user } = useAuthStore();
  const canEdit = isMin(user?.role, 'chercheur');

  const [mission,       setMission]       = useState(null);
  const [loadError,     setLoadError]     = useState(null);
  const [modal,         setModal]         = useState(null);
  const [methodeModal,  setMethodeModal]  = useState(null);
  const [missionModal,  setMissionModal]  = useState(false);
  const [bulkModal,     setBulkModal]     = useState(null);

  const refresh = () => {
    api.get(`/missions/${id}`)
      .then((r) => { setMission(r.data.mission); setLoadError(null); })
      .catch((err) => {
        const message = err.response?.data?.error || t('missionDetail.loadError');
        // Un premier chargement en échec bloque la page (pas de données du
        // tout) ; un rafraîchissement post-mutation en échec laisse les
        // données précédentes affichées et se contente d'un toast.
        if (mission) toast.error(t('missionDetail.refreshError'));
        else setLoadError(message);
      });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [id]);

  // ── Calculs dérivés ────────────────────────────────────────────
  const progress = useMemo(() => {
    if (!mission?.dateDebut || !mission?.dateFin) return null;
    // eslint-disable-next-line react-hooks/purity
    const now   = Date.now();
    const start = new Date(mission.dateDebut).getTime();
    const end   = new Date(mission.dateFin).getTime();
    return {
      pct:      Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)),
      daysLeft: Math.ceil((end - now) / 86400000),
    };
  }, [mission]);

  const specimenStats = useMemo(() => {
    const methodes   = mission?.localites?.flatMap(l => l.methodes ?? []) ?? [];
    const moustique  = methodes.reduce((s, m) => s + (m._count?.moustiques ?? 0), 0);
    const tique      = methodes.reduce((s, m) => s + (m._count?.tiques     ?? 0), 0);
    const puce       = methodes.reduce((s, m) => s + (m._count?.puces      ?? 0), 0);
    return { moustique, tique, puce, total: moustique + tique + puce };
  }, [mission]);

  const totalMethodes = useMemo(
    () => mission?.localites?.flatMap(l => l.methodes ?? []).length ?? 0,
    [mission]
  );

  const agents = useMemo(
    () => mission?.agents?.map(a => a.user).filter(Boolean) ?? [],
    [mission]
  );

  if (loadError) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-fg-muted">{loadError}</p>
        <Link to="/missions" className="text-primary text-sm hover:underline">{t('missionDetail.backToMissions')}</Link>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="flex items-center gap-2 text-fg-subtle text-sm">
          <Loader2 size={18} className="animate-spin" /> {t('missionDetail.loading')}
        </div>
      </div>
    );
  }

  const progressColor = !progress
    ? 'bg-primary'
    : progress.daysLeft < 0
      ? 'bg-fg-subtle'
      : progress.daysLeft < 30
        ? 'bg-warning'
        : 'bg-info';

  return (
    <div className="max-w-screen-2xl space-y-5">
      <Breadcrumb items={[
        { label: t('missionDetail.projects'), to: '/projets' },
        { label: mission.projet?.nom,    to: `/projets/${mission.projet?.id}` },
        { label: t('missionDetail.missions'), to: '/missions' },
        { label: mission.ordreMission },
      ]} />

      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] 2xl:grid-cols-[1fr,400px] gap-5 2xl:gap-8 items-start">

        {/* ── Colonne gauche ── */}
        <div className="space-y-5">

          {/* Carte mission */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-info/10 flex items-center justify-center flex-shrink-0">
                  <MapPin size={20} className="text-info" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 text-xs font-mono bg-surface-3 text-fg-muted px-2 py-0.5 rounded-lg border border-border-strong">
                      <Hash size={10} /> {mission.ordreMission}
                    </span>
                  </div>
                  <h1 className="text-xl font-bold text-fg">{mission.ordreMission}</h1>
                  <p className="text-sm text-fg-subtle mt-0.5">{mission.projet?.nom}</p>
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => setMissionModal(true)}
                  className="btn-secondary text-sm flex items-center gap-2 min-h-[44px] flex-shrink-0"
                  title={t('missionDetail.editMission')}
                >
                  <Edit2 size={14} /> {t('common.edit')}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(mission.chefMission || mission.chefMissionNom) && (
                <div className="text-xs">
                  <p className="text-fg-subtle font-medium mb-0.5">{t('missionDetail.missionLead')}</p>
                  <p className="text-fg">
                    {mission.chefMission
                      ? `${mission.chefMission.prenom} ${mission.chefMission.nom}`
                      : mission.chefMissionNom}
                  </p>
                  {mission.chefMissionNom && !mission.chefMission && (
                    <p className="text-[10px] text-fg-subtle mt-0.5">{t('missionDetail.externalPerson')}</p>
                  )}
                </div>
              )}
              {mission.dateDebut && (
                <div className="text-xs">
                  <p className="text-fg-subtle font-medium mb-0.5">{t('missionDetail.period')}</p>
                  <p className="text-fg">
                    {new Date(mission.dateDebut).toLocaleDateString(t('common.locale'))}
                    {mission.dateFin && ` → ${new Date(mission.dateFin).toLocaleDateString(t('common.locale'))}`}
                  </p>
                </div>
              )}
              {mission.agents?.length > 0 && (
                <div className="text-xs">
                  <p className="text-fg-subtle font-medium mb-0.5">{t('missionDetail.fieldAgents')}</p>
                  <p className="text-fg">{mission.agents.length} {t('missionDetail.agentsCount')}</p>
                </div>
              )}
            </div>

            {mission.objet && (
              <div className="mt-4 p-3.5 bg-primary/10 border border-primary/20 rounded-xl">
                <p className="text-xs font-semibold text-primary mb-1">{t('missionDetail.missionObject')}</p>
                <p className="text-sm text-primary">{mission.objet}</p>
              </div>
            )}

            {mission.observations && (
              <div className="mt-4 p-3.5 bg-warning/10 border border-warning/20 rounded-xl">
                <p className="text-xs font-semibold text-warning mb-1">{t('missionDetail.observations')}</p>
                <p className="text-sm text-warning">{mission.observations}</p>
              </div>
            )}
          </div>

          {/* Localités */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Navigation size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-fg">
                  {t('missionDetail.localities')}
                  <span className="ml-2 text-xs font-normal text-fg-subtle">({mission.localites?.length ?? 0})</span>
                </h2>
              </div>
              {canEdit && (
                <button
                  onClick={() => setModal({ type: 'create' })}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus size={13} /> {t('missionDetail.add')}
                </button>
              )}
            </div>

            {mission.localites?.length === 0 ? (
              <div className="py-10 text-center">
                <Navigation size={28} className="text-fg-subtle mx-auto mb-2" />
                <p className="text-sm text-fg-subtle">{t('missionDetail.noLocalityYet')}</p>
                {canEdit && (
                  <button onClick={() => setModal({ type: 'create' })} className="btn-primary mt-3 mx-auto">
                    <Plus size={13} /> {t('missionDetail.createFirstLocality')}
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {mission.localites?.map((l) => (
                  <div key={l.id} className="px-5 py-4 group hover:bg-surface-2/40 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {l.code ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono font-bold bg-primary/10 text-primary-700 border border-primary-200 px-2 py-1 rounded-lg flex-shrink-0">
                            <Tag size={10} /> {l.code}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-warning/10 text-warning border border-amber-200 px-2 py-1 rounded-lg flex-shrink-0">
                            {t('missionDetail.missingCode')}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-fg">{l.nom}</p>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-info/10 text-info border border-info/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              <Beaker size={9} /> {l.methodes?.length ?? 0} {t('missionDetail.methodCount')}
                            </span>
                          </div>
                          <p className="text-xs text-fg-subtle mt-0.5">
                            {[l.fokontany, l.commune, l.district, l.region].filter(Boolean).join(', ') || '—'}
                          </p>
                          {(l.latitude && l.longitude) && (
                            <p className="text-xs font-mono text-fg-subtle mt-1">
                              {parseFloat(l.latitude).toFixed(4)}, {parseFloat(l.longitude).toFixed(4)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {canEdit && (
                          <button
                            onClick={() => setModal({ type: 'edit', localite: l })}
                            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Méthodes de collecte — encadré pour bien montrer qu'elles sont
                        groupées sous cette localité, pas juste listées en dessous */}
                    <div className="mt-3 pl-2.5 pr-2 py-2.5 rounded-xl border border-border bg-surface-2/30">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider flex items-center gap-1">
                          <Beaker size={10} /> {t('missionDetail.methods')} ({l.methodes?.length ?? 0})
                        </p>
                        {canEdit && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setBulkModal({ localite: l })}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-fg-subtle hover:text-primary-600 transition-colors"
                            >
                              <Layers size={11} /> {t('missionDetail.series')}
                            </button>
                            <button
                              onClick={() => setMethodeModal({ localite: l })}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-600 transition-colors"
                            >
                              <Plus size={11} /> {t('missionDetail.add')}
                            </button>
                          </div>
                        )}
                      </div>

                      {l.methodes?.length > 0 ? (
                        <div className="space-y-1">
                          {l.methodes.map((m) => {
                            const identifiant = m.typeMethode ? `${m.typeMethode.code}_${m.numero}` : `#${m.id}`;
                            const specimensTotal = (m._count?.moustiques ?? 0) + (m._count?.tiques ?? 0) + (m._count?.puces ?? 0);
                            // Position propre au piège si précisée, sinon héritée de la localité.
                            const lat = m.latitude  ?? l.latitude;
                            const lng = m.longitude ?? l.longitude;
                            const alt = m.altitudeM ?? l.altitudeM;
                            return (
                              <div key={m.id} className="flex items-center justify-between gap-2 text-xs bg-surface-2/60 rounded-lg px-2.5 py-1.5 group/m">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono font-semibold text-fg flex-shrink-0">{identifiant}</span>
                                  <span className="text-fg-subtle truncate">
                                    {[
                                      m.typeHabitat?.nom,
                                      m.typeEnvironnement?.nom,
                                      m.interieurExterieur === 'interieur' ? t('methodeForm.interieur') : m.interieurExterieur === 'exterieur' ? t('methodeForm.exterieur') : null,
                                    ].filter(Boolean).join(' · ')}
                                  </span>
                                  {m.datePose && (
                                    <span className="text-fg-subtle whitespace-nowrap">
                                      {new Date(m.datePose).toLocaleDateString(t('common.locale'))}
                                    </span>
                                  )}
                                  {lat != null && lng != null && (
                                    <span
                                      className={`inline-flex items-center gap-1 font-mono whitespace-nowrap ${m.latitude != null ? 'text-fg-subtle' : 'text-fg-subtle/60'}`}
                                      title={m.latitude != null ? t('missionDetail.ownPosition') : t('missionDetail.inheritedPosition')}
                                    >
                                      <MapPin size={9} />
                                      {lat.toFixed(4)}, {lng.toFixed(4)}
                                      {alt != null && ` · ${Math.round(alt)} m`}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {specimensTotal > 0 && (
                                    <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                                      {specimensTotal}
                                    </span>
                                  )}
                                  {canEdit && (
                                    <button
                                      onClick={() => setMethodeModal({ localite: l, methode: m })}
                                      className="p-1 text-fg-subtle hover:text-primary hover:bg-primary/10 rounded opacity-0 group-hover/m:opacity-100 transition-opacity"
                                    >
                                      <Edit2 size={11} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-fg-subtle italic">{t('missionDetail.noMethodYet')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Colonne droite — Tableau de bord de la mission ── */}
        <div className="space-y-4">

          {/* Avancement temporel */}
          {progress !== null && (
            <Card padding="md">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-fg-subtle" />
                <span className="text-xs font-semibold text-fg uppercase tracking-wider">{t('missionDetail.progress')}</span>
              </div>
              <div className="flex items-end justify-between mb-2">
                <span className="text-2xl font-bold text-fg">
                  {Math.round(progress.pct)}<span className="text-sm font-normal text-fg-subtle ml-0.5">%</span>
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${
                  progress.daysLeft < 0
                    ? 'bg-surface-3 text-fg-muted'
                    : progress.daysLeft < 30
                      ? 'bg-warning/10 text-warning'
                      : 'bg-info/10 text-info'
                }`}>
                  {progress.daysLeft < 0
                    ? interpolate(t('missionDetail.finishedAgo'), { n: Math.abs(progress.daysLeft) })
                    : interpolate(t('missionDetail.daysLeft'), { n: progress.daysLeft })}
                </span>
              </div>
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className={`h-full ${progressColor} rounded-full transition-all duration-700`}
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-fg-subtle mt-1.5">
                <span>{new Date(mission.dateDebut).toLocaleDateString(t('common.locale'), { month: 'short', year: 'numeric' })}</span>
                {mission.dateFin && (
                  <span>{new Date(mission.dateFin).toLocaleDateString(t('common.locale'), { month: 'short', year: 'numeric' })}</span>
                )}
              </div>
            </Card>
          )}

          {/* Bilan terrain */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={14} className="text-fg-subtle" />
              <span className="text-xs font-semibold text-fg uppercase tracking-wider">{t('missionDetail.fieldSummary')}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-fg">{mission.localites?.length ?? 0}</p>
                <p className="text-[10px] text-fg-subtle mt-0.5">{t('missionDetail.localitiesShort')}</p>
              </div>
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-fg">{totalMethodes}</p>
                <p className="text-[10px] text-fg-subtle mt-0.5">{t('missionDetail.methodsShort')}</p>
              </div>
            </div>
          </Card>

          {/* Spécimens collectés */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-3">
              <Bug size={14} className="text-fg-subtle" />
              <span className="text-xs font-semibold text-fg uppercase tracking-wider">{t('missionDetail.collectedSpecimens')}</span>
              {specimenStats.total > 0 && (
                <span className="ml-auto text-xs font-bold text-primary">{specimenStats.total}</span>
              )}
            </div>

            {specimenStats.total === 0 ? (
              <p className="text-xs text-fg-subtle text-center py-3">
                {t('missionDetail.noSpecimenCollected')}
              </p>
            ) : (
              <div className="space-y-2.5">
                {(['moustique', 'tique', 'puce']).filter(st => specimenStats[st] > 0).map(type => (
                  <div key={type}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-fg-muted">{t(TYPE_PLURAL[type])}</span>
                    </div>
                    <MiniBar value={specimenStats[type]} max={specimenStats.total} colorClass={TYPE_COLOR[type]} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Équipe */}
          {(mission.chefMission || mission.chefMissionNom || agents.length > 0) && (
            <Card padding="md">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-fg-subtle" />
                <span className="text-xs font-semibold text-fg uppercase tracking-wider">{t('missionDetail.team')}</span>
              </div>
              <div className="space-y-2">
                {(mission.chefMission || mission.chefMissionNom) && (
                  <div className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      {mission.chefMission ? (
                        <span className="text-[10px] font-bold text-primary">
                          {mission.chefMission.prenom?.[0]}{mission.chefMission.nom?.[0]}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-primary">
                          {mission.chefMissionNom?.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-fg truncate">
                        {mission.chefMission
                          ? `${mission.chefMission.prenom} ${mission.chefMission.nom}`
                          : mission.chefMissionNom}
                      </p>
                      <p className="text-[10px] text-primary">
                        {t('missionDetail.missionLead')}{mission.chefMissionNom && !mission.chefMission ? t('missionDetail.externalSuffix') : ''}
                      </p>
                    </div>
                  </div>
                )}
                {agents.map(a => (
                  <div key={a.id} className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg hover:bg-surface-2 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-fg-muted">
                        {a.prenom?.[0]}{a.nom?.[0]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-fg truncate">{a.prenom} {a.nom}</p>
                      <p className="text-[10px] text-fg-subtle">{a.role ? roleLabel(a.role) : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>
      </div>

      {missionModal && (
        <MissionModal
          mission={mission}
          onClose={() => setMissionModal(false)}
          onSaved={() => { setMissionModal(false); refresh(); }}
        />
      )}

      {modal && (
        <LocaliteModal
          missionId={mission.id}
          localite={modal.localite}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refresh(); }}
        />
      )}

      {methodeModal && (
        <MethodeModal
          localite={methodeModal.localite}
          methode={methodeModal.methode}
          onClose={() => setMethodeModal(null)}
          onSaved={() => { setMethodeModal(null); refresh(); }}
        />
      )}

      {bulkModal && (
        <MethodeBulkModal
          localite={bulkModal.localite}
          onClose={() => setBulkModal(null)}
          onGenerated={() => { setBulkModal(null); refresh(); }}
        />
      )}
    </div>
  );
}

