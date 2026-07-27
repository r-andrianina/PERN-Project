import { useState } from 'react';
import { MapPin, Unlock } from 'lucide-react';
import FormField from './FormField';
import MapPicker from './MapPicker';
import { useApiQuery, useApiQueries } from '../hooks';

// Palette qualitative fixe — assignation stable par hash du code de type
// (ex: "CDC", "BG", "HLC"...) pour que la couleur d'un type reste la même
// partout, sans dépendre d'un champ "couleur" en base (qui n'existe pas).
const PALETTE = [
  '#ef4444', '#f59e0b', '#84cc16', '#10b981', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
  '#14b8a6', '#6366f1', '#a3a318', '#0ea5e9',
];
const colorForCode = (code) => {
  if (!code) return '#6b7280';
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
};

const INTERIEUR_EXTERIEUR_OPTIONS = [
  { value: 'interieur', label: 'Intérieur' },
  { value: 'exterieur', label: 'Extérieur' },
];

// Champs Méthode de collecte communs à MissionDetail.jsx (méthode déjà
// persistée, rattachée à une localité existante) et à NouvelleMission.jsx
// (méthode brouillon, en mémoire, tant que la mission n'est pas créée).
// Ne gère ni la soumission API ni le chrome de modale — juste les champs.
//
// value attendu : { typeMethodeId, numero, typeHabitatId, typeEnvironnementId,
//                    interieurExterieur, datePose, dateReleve, notes,
//                    latitude, longitude, altitudeM }
// localiteCoords (optionnel) : { latitude, longitude, altitudeM } de la
//   localité parente, utilisées comme position par défaut de la carte et
//   comme fallback (affichage + pièges existants) tant que le piège n'a pas
//   sa propre position.
// excludeMethodeId (optionnel) : id de la méthode en cours d'édition, pour ne
//   pas la superposer sur elle-même dans la carte des pièges existants.
export default function MethodeFieldsForm({ value, onChange, localiteCoords, excludeMethodeId }) {
  const { results, loading: loadingRefs } = useApiQueries([
    { url: '/dictionnaire/types-methode',       params: { actif: 'true' }, key: 'typesMethode', select: (r) => r.items ?? [] },
    { url: '/dictionnaire/types-habitat',       params: { actif: 'true' }, key: 'typesHabitat', select: (r) => r.items ?? [] },
    { url: '/dictionnaire/types-environnement', params: { actif: 'true' }, key: 'typesEnv',     select: (r) => r.items ?? [] },
  ]);
  const typesMethode = results.typesMethode ?? [];
  const typesHabitat = results.typesHabitat ?? [];
  const typesEnv     = results.typesEnv     ?? [];

  const { data: existingMethodes } = useApiQuery('/methodes', { select: (r) => r.methodes ?? [] });

  const [mapOpen, setMapOpen] = useState(!!(value.latitude && value.longitude));
  const [altitudeLoading, setAltitudeLoading] = useState(false);

  const typeMethodeOptions = typesMethode.map((t) => ({ value: t.id, label: t.nom, keywords: t.code }));
  const typeHabitatOptions = typesHabitat.map((t) => ({ value: t.id, label: t.nom }));
  const typeEnvOptions     = typesEnv.map((t)     => ({ value: t.id, label: t.nom }));

  const selectedType = typesMethode.find((t) => t.id === parseInt(value.typeMethodeId));
  const identifiant  = selectedType ? `${selectedType.code}_${value.numero || 1}` : null;

  const set = (patch) => onChange(patch);

  // Même mécanisme que LocaliteFieldsForm : altitude déduite de la position
  // via l'API d'élévation, silencieusement (l'utilisateur peut corriger à la main).
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
    set({ ...coords, altitudeM: '' });
    if (coords.latitude && coords.longitude) lookupAltitude(coords.latitude, coords.longitude);
  };

  // Pièges existants superposés sur la carte, colorés par type — inspiré de
  // la superposition des localités existantes (LocaliteFieldsForm).
  const existingPoints = (existingMethodes || [])
    .filter((m) => m.id !== excludeMethodeId)
    .map((m) => {
      const lat = m.latitude ?? m.localite?.latitude;
      const lng = m.longitude ?? m.localite?.longitude;
      const alt = m.altitudeM ?? m.localite?.altitudeM;
      const code = m.typeMethode?.code;
      const ident = code ? `${code}_${m.numero}` : `#${m.id}`;
      return {
        id: m.id,
        latitude: lat, longitude: lng, altitudeM: alt,
        color: colorForCode(code),
        tooltip: `${ident} — ${m.localite?.nom ?? ''}`.trim(),
        typeMethodeId:       m.typeMethode?.id ?? '',
        typeHabitatId:       m.typeHabitat?.id ?? '',
        typeEnvironnementId: m.typeEnvironnement?.id ?? '',
        interieurExterieur:  m.interieurExterieur ?? '',
        code, nom: ident,
      };
    })
    .filter((p) => p.latitude != null && p.longitude != null);

  const legendTypes = [...new Map(
    existingPoints.filter((p) => p.code).map((p) => [p.code, p.color])
  ).entries()];

  const handleSelectExisting = (point) => {
    set({
      typeMethodeId:       point.typeMethodeId ? String(point.typeMethodeId) : value.typeMethodeId,
      typeHabitatId:       point.typeHabitatId ? String(point.typeHabitatId) : value.typeHabitatId,
      typeEnvironnementId: point.typeEnvironnementId ? String(point.typeEnvironnementId) : value.typeEnvironnementId,
      interieurExterieur:  point.interieurExterieur || value.interieurExterieur,
      latitude:  String(point.latitude),
      longitude: String(point.longitude),
      altitudeM: point.altitudeM != null ? String(point.altitudeM) : value.altitudeM,
    });
    setMapOpen(true);
  };

  const mapLat = value.latitude  || localiteCoords?.latitude  || undefined;
  const mapLng = value.longitude || localiteCoords?.longitude || undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Type de méthode" name="typeMethodeId" type="select"
          value={value.typeMethodeId} onChange={(e) => set({ typeMethodeId: e.target.value })}
          options={typeMethodeOptions} required disabled={loadingRefs}
          hint="Depuis le dictionnaire" />
        <FormField label="Numéro" name="numero" type="number"
          value={value.numero} onChange={(e) => set({ numero: e.target.value })}
          hint={identifiant ? `Identifiant : ${identifiant}` : undefined} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Type d'habitat" name="typeHabitatId" type="select"
          value={value.typeHabitatId} onChange={(e) => set({ typeHabitatId: e.target.value })}
          options={typeHabitatOptions} disabled={loadingRefs} />
        <FormField label="Type d'environnement" name="typeEnvironnementId" type="select"
          value={value.typeEnvironnementId} onChange={(e) => set({ typeEnvironnementId: e.target.value })}
          options={typeEnvOptions} disabled={loadingRefs} />
        <FormField label="Intérieur / Extérieur" name="interieurExterieur" type="select"
          value={value.interieurExterieur} onChange={(e) => set({ interieurExterieur: e.target.value })}
          options={INTERIEUR_EXTERIEUR_OPTIONS} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Date et heure de pose" name="datePose" type="datetime-local"
          value={value.datePose} onChange={(e) => set({ datePose: e.target.value })} />
        <FormField label="Date et heure de relève" name="dateReleve" type="datetime-local"
          value={value.dateReleve} onChange={(e) => set({ dateReleve: e.target.value })} />
      </div>

      <FormField label="Notes" name="notes" type="textarea"
        value={value.notes} onChange={(e) => set({ notes: e.target.value })}
        placeholder="Conditions de terrain, observations particulières…" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-fg-muted tracking-wide">
            Localisation du piège
          </p>
          {!mapOpen ? (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              <Unlock size={11} /> Préciser une position différente de la localité
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setMapOpen(false); set({ latitude: '', longitude: '', altitudeM: '' }); }}
              className="text-xs font-medium text-fg-subtle hover:text-fg"
            >
              Utiliser la position de la localité
            </button>
          )}
        </div>

        {mapOpen ? (
          <>
            {legendTypes.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[10px] text-fg-subtle">
                <span className="flex items-center gap-1 font-medium"><MapPin size={10} /> Pièges existants :</span>
                {legendTypes.map(([code, color]) => (
                  <span key={code} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                    {code}
                  </span>
                ))}
              </div>
            )}
            <div className="h-64 rounded-xl overflow-hidden border border-border">
              <MapPicker
                latitude={mapLat}
                longitude={mapLng}
                onChange={handleMapChange}
                existingPoints={existingPoints}
                onSelectExisting={handleSelectExisting}
                height="100%"
              />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <p className="text-[10px] text-fg-subtle uppercase tracking-wide mb-0.5">Latitude</p>
                <p className="text-sm font-mono text-fg">{value.latitude || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-fg-subtle uppercase tracking-wide mb-0.5">Longitude</p>
                <p className="text-sm font-mono text-fg">{value.longitude || '—'}</p>
              </div>
              <FormField label="Altitude (m)" name="altitudeM" type="number"
                value={value.altitudeM} onChange={(e) => set({ altitudeM: e.target.value })}
                placeholder={altitudeLoading ? 'Calcul…' : '—'} disabled={altitudeLoading} />
            </div>
          </>
        ) : (
          <div className="text-xs text-fg-subtle italic">
            <p>Hérite de la position de la localité.</p>
            {localiteCoords?.latitude != null && localiteCoords?.longitude != null && (
              <p className="font-mono not-italic mt-1">
                {localiteCoords.latitude}, {localiteCoords.longitude}
                {localiteCoords.altitudeM != null && ` · ${Math.round(localiteCoords.altitudeM)} m`}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
