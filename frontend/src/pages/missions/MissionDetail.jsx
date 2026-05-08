import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ChevronLeft, MapPin, Loader2, Navigation, Hash, Plus, Edit2, X, Check, Tag,
} from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import MapPicker from '../../components/MapPicker';
import useAuthStore from '../../store/authStore';

const STATUT = {
  planifiee: { label: 'Planifiée', cls: 'bg-info/10 text-info border border-info/20'        },
  en_cours:  { label: 'En cours',  cls: 'bg-success/10 text-success border border-success/20' },
  terminee:  { label: 'Terminée',  cls: 'bg-surface-3 text-fg-muted border border-border-strong'       },
  annulee:   { label: 'Annulée',   cls: 'bg-danger/10 text-danger border border-danger/20'          },
};

const ROLES = { admin: 4, chercheur: 3, terrain: 2, lecteur: 1 };
const isMin = (r, m) => (ROLES[r] || 0) >= ROLES[m];

// ── Modal création / édition de localité (layout 2-col, auto-fill fokontany) ──
function LocaliteModal({ missionId, localite, onClose, onSaved }) {
  const isEdit = !!localite?.id;
  const [form, setForm] = useState({
    code:      localite?.code      || '',
    nom:       localite?.nom       || '',
    toponyme:  localite?.toponyme  || '',
    region:    localite?.region    || '',
    district:  localite?.district  || '',
    commune:   localite?.commune   || '',
    fokontany: localite?.fokontany || '',
    latitude:  localite?.latitude  ? String(localite.latitude)  : '',
    longitude: localite?.longitude ? String(localite.longitude) : '',
    altitudeM: localite?.altitudeM ? String(localite.altitudeM) : '',
  });
  const [loading,    setLoading]    = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoMatch,   setAutoMatch]   = useState(null); // null | 'match' | 'nearest' | 'none'
  const [error,      setError]      = useState(null);

  // Lookup fokontany à chaque changement de coordonnées
  const lookupFokontany = async (lat, lng) => {
    if (!lat || !lng) return;
    setAutoFilling(true);
    try {
      const r = await api.get('/localites/lookup-fokontany', { params: { lat, lng } });
      const data = r.data;
      const filled = data.match ? data : data.nearest;
      if (filled) {
        setForm((f) => ({
          ...f,
          region:    filled.region    || f.region,
          district:  filled.district  || f.district,
          commune:   filled.commune   || f.commune,
          fokontany: filled.fokontany || f.fokontany,
        }));
        setAutoMatch(data.match ? 'match' : 'nearest');
      } else {
        setAutoMatch('none');
      }
    } catch {
      setAutoMatch('none');
    } finally { setAutoFilling(false); }
  };

  const handleMapChange = ({ latitude, longitude }) => {
    setForm((f) => ({ ...f, latitude, longitude }));
    if (latitude && longitude) lookupFokontany(latitude, longitude);
    else setAutoMatch(null);
  };

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
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="bg-surface rounded-2xl shadow-2xl w-full max-w-5xl my-8">
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-5 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface/20 flex items-center justify-center">
              <Navigation size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEdit ? 'Modifier la localité' : 'Nouvelle localité'}
              </h2>
              <p className="text-xs text-primary-200">
                {isEdit ? localite.nom : 'Cliquez sur la carte pour pré-remplir région / district / commune / fokontany'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-danger/10 border border-red-200 rounded-xl text-sm text-danger">{error}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ─── Colonne gauche : champs ─── */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  label="Code (3 lettres)" name="code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="AKZ" required
                  hint="Préfixe ID terrain"
                />
                <div className="col-span-2">
                  <FormField
                    label="Nom de la localité" name="nom"
                    value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    placeholder="ex: Ankazobe" required
                  />
                </div>
              </div>

              <FormField
                label="Toponyme" name="toponyme"
                value={form.toponyme} onChange={(e) => setForm({ ...form, toponyme: e.target.value })}
                placeholder="Nom local / alternatif"
              />

              {/* Auto-fill banner */}
              {autoFilling && (
                <div className="p-2.5 bg-info/10 border border-info/20 rounded-xl flex items-center gap-2 text-xs text-info">
                  <Loader2 size={12} className="animate-spin" />
                  Recherche du fokontany à ces coordonnées…
                </div>
              )}
              {autoMatch === 'match' && !autoFilling && (
                <div className="p-2.5 bg-success/10 border border-success/20 rounded-xl flex items-center gap-2 text-xs text-success">
                  <Check size={12} />
                  Fokontany trouvé — champs pré-remplis (modifiables)
                </div>
              )}
              {autoMatch === 'nearest' && !autoFilling && (
                <div className="p-2.5 bg-warning/10 border border-warning/20 rounded-xl flex items-center gap-2 text-xs text-warning">
                  <Tag size={12} />
                  Point hors polygone — fokontany le plus proche utilisé
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Région" name="region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                <FormField label="District" name="district" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
                <FormField label="Commune" name="commune" value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} />
                <FormField label="Fokontany" name="fokontany" value={form.fokontany} onChange={(e) => setForm({ ...form, fokontany: e.target.value })} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField label="Latitude" name="latitude" type="number"
                  value={form.latitude}
                  onChange={(e) => { setForm({ ...form, latitude: e.target.value }); }}
                  onBlur={() => lookupFokontany(form.latitude, form.longitude)}
                  placeholder="-18.9137" />
                <FormField label="Longitude" name="longitude" type="number"
                  value={form.longitude}
                  onChange={(e) => { setForm({ ...form, longitude: e.target.value }); }}
                  onBlur={() => lookupFokontany(form.latitude, form.longitude)}
                  placeholder="47.5361" />
                <FormField label="Altitude (m)" name="altitudeM" type="number"
                  value={form.altitudeM} onChange={(e) => setForm({ ...form, altitudeM: e.target.value })}
                  placeholder="1200" />
              </div>
            </div>

            {/* ─── Colonne droite : carte alignée verticalement ─── */}
            <div className="flex flex-col">
              <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-2">
                Carte — cliquez pour placer le point GPS
              </label>
              <div className="flex-1 min-h-[480px]">
                <MapPicker
                  latitude={form.latitude || undefined}
                  longitude={form.longitude || undefined}
                  onChange={handleMapChange}
                  height="100%"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-5 mt-5 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {isEdit ? 'Enregistrer' : 'Créer la localité'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────
export default function MissionDetail() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const canEdit = isMin(user?.role, 'chercheur');

  const [mission, setMission] = useState(null);
  const [modal,   setModal]   = useState(null); // { type: 'create'|'edit', localite? }

  const refresh = () => {
    api.get(`/missions/${id}`).then((r) => setMission(r.data.mission));
  };
  useEffect(() => { refresh(); }, [id]);

  if (!mission) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="flex items-center gap-2 text-fg-subtle text-sm">
          <Loader2 size={18} className="animate-spin" /> Chargement...
        </div>
      </div>
    );
  }

  const s = STATUT[mission.statut] ?? {};

  return (
    <div className="max-w-3xl space-y-5">
      <Link to="/missions" className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg transition-colors">
        <ChevronLeft size={16} /> Missions
      </Link>

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
                <span className={`badge ${s.cls}`}>{s.label}</span>
              </div>
              <h1 className="text-xl font-bold text-fg">{mission.ordreMission}</h1>
              <p className="text-sm text-fg-subtle mt-0.5">{mission.projet?.nom}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {mission.chefMission && (
            <div className="text-xs">
              <p className="text-fg-subtle font-medium mb-0.5">Chef de mission</p>
              <p className="text-fg">{mission.chefMission.prenom} {mission.chefMission.nom}</p>
            </div>
          )}
          {mission.dateDebut && (
            <div className="text-xs">
              <p className="text-fg-subtle font-medium mb-0.5">Période</p>
              <p className="text-fg">
                {new Date(mission.dateDebut).toLocaleDateString('fr-FR')}
                {mission.dateFin && ` → ${new Date(mission.dateFin).toLocaleDateString('fr-FR')}`}
              </p>
            </div>
          )}
          {mission.agents?.length > 0 && (
            <div className="text-xs">
              <p className="text-fg-subtle font-medium mb-0.5">Agents terrain</p>
              <p className="text-fg">{mission.agents.length} agent(s)</p>
            </div>
          )}
        </div>

        {mission.observations && (
          <div className="mt-4 p-3.5 bg-warning/10 border border-warning/20 rounded-xl">
            <p className="text-xs font-semibold text-warning mb-1">Observations</p>
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
              Localités
              <span className="ml-2 text-xs font-normal text-fg-subtle">({mission.localites?.length ?? 0})</span>
            </h2>
          </div>
          {canEdit && (
            <button
              onClick={() => setModal({ type: 'create' })}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={13} /> Ajouter
            </button>
          )}
        </div>

        {mission.localites?.length === 0 ? (
          <div className="py-10 text-center">
            <Navigation size={28} className="text-fg-subtle mx-auto mb-2" />
            <p className="text-sm text-fg-subtle">Aucune localité enregistrée</p>
            {canEdit && (
              <button
                onClick={() => setModal({ type: 'create' })}
                className="btn-primary mt-3 mx-auto"
              >
                <Plus size={13} /> Créer la première localité
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
                        Code manquant
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-fg">{l.nom}</p>
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
                    <span className="text-xs text-fg-subtle bg-surface-2 border border-border rounded-lg px-2 py-1">
                      {l.methodes?.length ?? 0} méthode(s)
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => setModal({ type: 'edit', localite: l })}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <LocaliteModal
          missionId={mission.id}
          localite={modal.localite}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refresh(); }}
        />
      )}
    </div>
  );
}
