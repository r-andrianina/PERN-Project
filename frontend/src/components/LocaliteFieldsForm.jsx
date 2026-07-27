import { useState, useEffect } from 'react';
import { Loader2, Check, Tag, Plus, Trash2, Lock, Unlock, UserRound, MapPinned } from 'lucide-react';
import api from '../api/axios';
import FormField from './FormField';
import MapPicker from './MapPicker';

// Champs Localité communs à la création de mission et à l'édition d'une
// localité existante (NouvelleMission.jsx / MissionDetail.jsx) :
// - "Nom" et "Toponyme" fusionnés en un seul champ visuel (le backend
//   mirroire la valeur vers les 2 colonnes) ;
// - Région / District / Commune / Fokontany / Lat / Long / Alt se
//   verrouillent automatiquement dès qu'ils sont remplis par le lookup
//   PostGIS (clic carte ou saisie de coordonnées) — un bouton permet de
//   repasser en saisie manuelle en cas d'erreur du lookup ;
// - Contacts locaux multiples (ajout / suppression, pas de champ "principal") ;
// - Localités déjà existantes superposées sur la carte : cliquer dessus
//   pré-remplit le brouillon en cours (champs + contacts, copiés sans leur
//   id d'origine — ils deviennent des contacts indépendants du brouillon).
export default function LocaliteFieldsForm({ value, onChange, errors = {}, excludeId }) {
  const [autoFill, setAutoFill] = useState(null); // 'loading' | 'match' | 'nearest' | 'existing' | 'none' | null
  const [altitudeLoading, setAltitudeLoading] = useState(false);
  const [geoLocked, setGeoLocked] = useState(false);
  const [existingPoints, setExistingPoints] = useState([]);

  useEffect(() => {
    api.get('/localites/carte')
      .then((r) => {
        const points = (r.data.features || [])
          .map((f) => f.properties)
          .filter((p) => p.id !== excludeId);
        setExistingPoints(points);
      })
      .catch(() => {}); // superposition optionnelle — un échec ne bloque pas le formulaire
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Patch pur, sans relire `value` (évite les races entre lookups
  // concurrents — cf. lookupFokontany / lookupAltitude qui peuvent
  // résoudre dans un ordre imprévisible après un clic carte).
  const set = (patch) => onChange(patch);

  const lookupFokontany = async (lat, lng) => {
    if (!lat || !lng) return;
    setAutoFill('loading');
    try {
      const r = await api.get('/localites/lookup-fokontany', { params: { lat, lng } });
      const d = r.data;
      const filled = d.match ? d : d.nearest;
      if (filled) {
        const patch = {};
        if (filled.region)    patch.region    = filled.region;
        if (filled.district)  patch.district  = filled.district;
        if (filled.commune)   patch.commune   = filled.commune;
        if (filled.fokontany) patch.fokontany = filled.fokontany;
        set(patch);
        setAutoFill(d.match ? 'match' : 'nearest');
        setGeoLocked(true);
      } else {
        setAutoFill('none');
      }
    } catch {
      setAutoFill('none');
    }
  };

  const lookupAltitude = async (lat, lng) => {
    if (!lat || !lng) return;
    setAltitudeLoading(true);
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
      const data = await r.json();
      const elevation = data?.elevation?.[0];
      if (elevation !== undefined && elevation !== null) {
        set({ altitudeM: String(Math.round(elevation)) });
      }
    } catch {
      // silencieux — l'utilisateur peut saisir l'altitude manuellement
    } finally {
      setAltitudeLoading(false);
    }
  };

  const handleMapChange = (coords) => {
    // Un nouveau point posé sur la carte invalide toujours les champs géo
    // précédents (venant d'un lookup ou d'une localité existante copiée) —
    // on repart à zéro et on déverrouille avant de retenter le lookup,
    // pour ne jamais garder des Région/District/Commune/Fokontany verrouillés
    // qui ne correspondent plus aux nouvelles coordonnées.
    setGeoLocked(false);
    set({ ...coords, altitudeM: '', region: '', district: '', commune: '', fokontany: '' });
    if (coords.latitude && coords.longitude) {
      lookupFokontany(coords.latitude, coords.longitude);
      lookupAltitude(coords.latitude, coords.longitude);
    } else {
      setAutoFill(null);
    }
  };

  const unlockGeo = () => { setGeoLocked(false); setAutoFill(null); };

  // Clic sur une localité existante superposée sur la carte — copie ses
  // champs + contacts dans le brouillon en cours (jamais d'édition en place).
  const handleSelectExisting = (point) => {
    set({
      nom:       point.nom       || value.nom,
      region:    point.region    || '',
      district:  point.district  || '',
      commune:   point.commune   || '',
      fokontany: point.fokontany || '',
      latitude:  point.latitude  != null ? String(point.latitude)  : '',
      longitude: point.longitude != null ? String(point.longitude) : '',
      altitudeM: point.altitudeM != null ? String(point.altitudeM) : '',
      contacts:  (point.contacts || []).map(({ nom, telephone, statut }) => ({ nom, telephone, statut })),
    });
    setAutoFill('existing');
    setGeoLocked(true);
  };

  const contacts = value.contacts || [];
  const addContact = () => set({ contacts: [...contacts, { nom: '', telephone: '', statut: '' }] });
  const removeContact = (i) => set({ contacts: contacts.filter((_, idx) => idx !== i) });
  const updateContact = (i, field, val) => {
    const updated = contacts.map((c, idx) => (idx === i ? { ...c, [field]: val } : c));
    set({ contacts: updated });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
      <div className="space-y-4 flex flex-col">
        <FormField
          label="Nom de la localité" name="nom"
          value={value.nom} onChange={(e) => set({ nom: e.target.value })}
          placeholder="ex: Grotte Ambodiriana / Ankazobe"
          required error={errors.nom}
        />

        {autoFill === 'loading' && (
          <div className="p-2.5 bg-info/10 border border-info/20 rounded-xl flex items-center gap-2 text-xs text-info">
            <Loader2 size={12} className="animate-spin" /> Recherche du fokontany à ces coordonnées…
          </div>
        )}
        {autoFill === 'match' && (
          <div className="p-2.5 bg-success/10 border border-success/20 rounded-xl flex items-center gap-2 text-xs text-success">
            <Check size={12} /> Région / district / commune / fokontany pré-remplis depuis la base PostGIS — champs verrouillés
          </div>
        )}
        {autoFill === 'nearest' && (
          <div className="p-2.5 bg-warning/10 border border-warning/20 rounded-xl flex items-center gap-2 text-xs text-warning">
            <Tag size={12} /> Point hors polygones — fokontany le plus proche utilisé — champs verrouillés
          </div>
        )}
        {autoFill === 'existing' && (
          <div className="p-2.5 bg-info/10 border border-info/20 rounded-xl flex items-center gap-2 text-xs text-info">
            <MapPinned size={12} /> Localité existante sélectionnée — champs et contacts copiés, verrouillés
          </div>
        )}

        {geoLocked && (
          <button
            type="button" onClick={unlockGeo}
            className="self-start inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Unlock size={12} /> Corriger manuellement
          </button>
        )}

        <FormField
          label="Région" name="region"
          value={value.region} onChange={(e) => set({ region: e.target.value })}
          placeholder="ex: Analamanga" required
          error={errors.region} disabled={geoLocked}
          hint={geoLocked ? undefined : 'Pré-rempli au clic sur la carte'}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="District" name="district"
            value={value.district} onChange={(e) => set({ district: e.target.value })}
            placeholder="ex: Ankazobe" required
            error={errors.district} disabled={geoLocked}
          />
          <FormField
            label="Commune" name="commune"
            value={value.commune} onChange={(e) => set({ commune: e.target.value })}
            placeholder="Commune" required
            error={errors.commune} disabled={geoLocked}
          />
        </div>
        <FormField
          label="Fokontany" name="fokontany"
          value={value.fokontany} onChange={(e) => set({ fokontany: e.target.value })}
          placeholder="Fokontany" required
          error={errors.fokontany} disabled={geoLocked}
        />
        <div className="grid grid-cols-3 gap-3 mt-auto">
          <FormField
            label="Latitude" name="latitude"
            value={value.latitude} onChange={(e) => set({ latitude: e.target.value })}
            onBlur={() => lookupFokontany(value.latitude, value.longitude)}
            placeholder="-18.9137" hint={geoLocked ? undefined : 'Cliquez sur la carte'}
            disabled={geoLocked}
          />
          <FormField
            label="Longitude" name="longitude"
            value={value.longitude} onChange={(e) => set({ longitude: e.target.value })}
            onBlur={() => lookupFokontany(value.latitude, value.longitude)}
            placeholder="47.5361" disabled={geoLocked}
          />
          <FormField
            label="Altitude (m)" name="altitudeM"
            value={value.altitudeM} onChange={(e) => set({ altitudeM: e.target.value })}
            placeholder={altitudeLoading ? 'Calcul…' : '1200'}
            disabled={geoLocked || altitudeLoading}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider flex items-center gap-1.5">
              <UserRound size={12} /> Contacts locaux
            </p>
            <button
              type="button" onClick={addContact}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2 py-1 rounded-lg transition-colors"
            >
              <Plus size={12} /> Ajouter
            </button>
          </div>
          {contacts.length === 0 && (
            <p className="text-xs text-fg-subtle italic">Aucun contact local renseigné.</p>
          )}
          <div className="space-y-2">
            {contacts.map((c, i) => (
              <div key={c.id ?? `new-${i}`} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 items-start">
                <FormField
                  name={`contact_${i}_nom`}
                  value={c.nom} onChange={(e) => updateContact(i, 'nom', e.target.value)}
                  placeholder="Nom"
                />
                <FormField
                  name={`contact_${i}_telephone`}
                  value={c.telephone || ''} onChange={(e) => updateContact(i, 'telephone', e.target.value)}
                  placeholder="Téléphone"
                />
                <FormField
                  name={`contact_${i}_statut`}
                  value={c.statut || ''} onChange={(e) => updateContact(i, 'statut', e.target.value)}
                  placeholder="ex: Chef fokontany"
                />
                <button
                  type="button" onClick={() => removeContact(i)}
                  className="mt-1 p-2.5 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                  aria-label="Supprimer ce contact"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <p className="text-xs font-semibold text-fg-muted tracking-wide mb-1.5 flex items-center gap-1.5">
          Carte — cliquez pour placer le point GPS et auto-remplir
          {geoLocked && <Lock size={11} className="text-fg-subtle" />}
        </p>
        {existingPoints.length > 0 && (
          <p className="text-[11px] text-fg-subtle mb-1.5">
            Points gris = localités déjà existantes — cliquez pour réutiliser leurs infos.
          </p>
        )}
        <div className="flex-1 min-h-[480px]">
          <MapPicker
            latitude={value.latitude || undefined}
            longitude={value.longitude || undefined}
            onChange={handleMapChange}
            existingPoints={existingPoints}
            onSelectExisting={handleSelectExisting}
            height="100%"
          />
        </div>
      </div>
    </div>
  );
}
