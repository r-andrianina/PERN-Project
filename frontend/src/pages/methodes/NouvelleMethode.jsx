import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Beaker, Trees, Map as MapIcon,
  Calendar, Hash, Info, Clock, Timer, MapPin, X,
} from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import MapPicker from '../../components/MapPicker';
import { Card } from '../../components/ui';
import { useFormSubmit, useApiQueries } from '../../hooks';

const TIME_CLS =
  'w-full px-3 py-2.5 text-sm rounded-xl border border-border-strong bg-surface text-fg ' +
  'hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

export default function NouvelleMethode() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const [gpsFlash, setGpsFlash] = useState(false);

  const { results, loading: loadingRefs } = useApiQueries([
    { url: '/localites',                                                    key: 'localites',    select: (r) => r.localites ?? [] },
    { url: '/dictionnaire/types-methode',       params: { actif: 'true' }, key: 'typesMethode', select: (r) => r.items ?? [] },
    { url: '/dictionnaire/types-habitat',       params: { actif: 'true' }, key: 'typesHabitat', select: (r) => r.items ?? [] },
    { url: '/dictionnaire/types-environnement', params: { actif: 'true' }, key: 'typesEnv',     select: (r) => r.items ?? [] },
  ]);
  const localites    = results.localites    ?? [];
  const typesMethode = results.typesMethode ?? [];
  const typesHabitat = results.typesHabitat ?? [];
  const typesEnv     = results.typesEnv     ?? [];

  const { form, setField, handleChange, errors, isLoading, handleSubmit } = useFormSubmit({
    initial: {
      localiteId:          searchParams.get('localiteId') || '',
      typeMethodeId:       '',
      numero:              '1',
      typeHabitatId:       '',
      typeEnvironnementId: '',
      latitude:            '',
      longitude:           '',
      dateCollecte:        '',
      heureDebut:          '',
      heureFin:            '',
      notes:               '',
    },
    validate: (f) => ({
      localiteId:    !f.localiteId    && 'La localité est obligatoire',
      typeMethodeId: !f.typeMethodeId && 'Le type de méthode est obligatoire',
    }),
    onSubmit: (f) => api.post('/methodes', {
      localiteId:          parseInt(f.localiteId),
      typeMethodeId:       parseInt(f.typeMethodeId),
      numero:              parseInt(f.numero) || 1,
      typeHabitatId:       f.typeHabitatId       ? parseInt(f.typeHabitatId)       : null,
      typeEnvironnementId: f.typeEnvironnementId ? parseInt(f.typeEnvironnementId) : null,
      latitude:            f.latitude   || null,
      longitude:           f.longitude  || null,
      dateCollecte:        f.dateCollecte || null,
      heureDebut:          f.heureDebut   || null,
      heureFin:            f.heureFin     || null,
      notes:               f.notes        || null,
    }),
    onSuccess: () => navigate('/methodes'),
  });

  // Pré-remplir GPS depuis la localité
  useEffect(() => {
    if (!form.localiteId || (form.latitude && form.longitude)) return;
    const loc = localites.find((l) => l.id === parseInt(form.localiteId));
    if (loc?.latitude && loc?.longitude) {
      setField('latitude',  String(loc.latitude));
      setField('longitude', String(loc.longitude));
    }
  }, [form.localiteId, localites]); // eslint-disable-line

  // Clic carte → flash vert sur la barre inférieure
  const handleMapChange = ({ latitude, longitude }) => {
    setField('latitude',  latitude);
    setField('longitude', longitude);
    setGpsFlash(true);
    setTimeout(() => setGpsFlash(false), 900);
  };

  const clearGps = () => { setField('latitude', ''); setField('longitude', ''); };

  const localiteOptions    = localites.map((l) => {
    const geo    = [l.region, l.district, l.commune, l.fokontany].filter(Boolean).join(' / ');
    const suffix = l.mission?.ordreMission ? ` — ${l.mission.ordreMission}` : '';
    return { value: l.id, label: `${geo || l.nom}${suffix}` };
  });
  const typeMethodeOptions = typesMethode.map((t) => ({ value: t.id, label: `${t.code} — ${t.nom}` }));
  const typeHabitatOptions = typesHabitat.map((t) => ({ value: t.id, label: t.nom }));
  const typeEnvOptions     = typesEnv.map((t)     => ({ value: t.id, label: t.nom }));

  const selectedLocalite = localites.find((l)    => l.id === parseInt(form.localiteId));
  const selectedType     = typesMethode.find((t) => t.id === parseInt(form.typeMethodeId));
  const selectedHabitat  = typesHabitat.find((t) => t.id === parseInt(form.typeHabitatId));
  const selectedEnv      = typesEnv.find((t)     => t.id === parseInt(form.typeEnvironnementId));
  const identifiant      = selectedType ? `${selectedType.code}_${form.numero || 1}` : null;
  const hasGps           = !!(form.latitude && form.longitude);

  const duree = useMemo(() => {
    if (!form.heureDebut || !form.heureFin) return null;
    const [h1, m1] = form.heureDebut.split(':').map(Number);
    const [h2, m2] = form.heureFin.split(':').map(Number);
    const total = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (total <= 0) return null;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
  }, [form.heureDebut, form.heureFin]);

  return (
    <div className="space-y-5">
      <Link to="/methodes" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> Méthodes
      </Link>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr,280px] gap-5 items-start">

          {/* ═══ Colonne principale ═══ */}
          <div className="space-y-5">
            {errors.submit && (
              <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-sm text-danger">
                {errors.submit}
              </div>
            )}

            {/* ── 1. Méthode ── */}
            <div className="card p-6">
              <h2 className="section-title"><Beaker size={17} className="text-info" /> Méthode</h2>
              <div className="space-y-4">
                <FormField label="Localité" name="localiteId" type="select"
                  value={form.localiteId} onChange={handleChange}
                  options={localiteOptions} required error={errors.localiteId}
                  disabled={loadingRefs} />
                <FormField label="Type de méthode (référentiel)" name="typeMethodeId" type="select"
                  value={form.typeMethodeId} onChange={handleChange}
                  options={typeMethodeOptions} required error={errors.typeMethodeId}
                  hint="Sélection obligatoire depuis le dictionnaire" disabled={loadingRefs} />
                {form.typeMethodeId && (
                  <FormField label="Numéro" name="numero" type="number"
                    value={form.numero} onChange={handleChange}
                    hint={identifiant ? `Identifiant généré : ${identifiant}` : undefined}
                  />
                )}
              </div>
            </div>

            {/* ── 2. Contexte & Planification ── */}
            <div className="card p-6">
              <h2 className="section-title">
                <Trees size={17} className="text-success" /> Contexte &amp; Planification
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">

                <div className="space-y-4">
                  <FormField label="Type d'habitat" name="typeHabitatId" type="select"
                    value={form.typeHabitatId} onChange={handleChange} options={typeHabitatOptions} />
                  <FormField label="Type d'environnement" name="typeEnvironnementId" type="select"
                    value={form.typeEnvironnementId} onChange={handleChange} options={typeEnvOptions} />
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted tracking-wide">
                      <Calendar size={11} className="text-warning" /> Date de collecte
                    </label>
                    <input type="date" name="dateCollecte" value={form.dateCollecte}
                      onChange={handleChange} className={TIME_CLS} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted tracking-wide">
                        <Clock size={11} className="text-info" /> Début
                      </label>
                      <input type="time" name="heureDebut" value={form.heureDebut}
                        onChange={handleChange} className={TIME_CLS} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted tracking-wide">
                        <Clock size={11} className="text-danger" /> Fin
                      </label>
                      <input type="time" name="heureFin" value={form.heureFin}
                        onChange={handleChange} className={TIME_CLS} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted tracking-wide">
                      <Timer size={11} className="text-success" /> Durée
                    </label>
                    <div className={`w-full px-3 py-2.5 text-sm rounded-xl border transition-all duration-500 ${
                      duree
                        ? 'border-success/40 bg-success/5 text-success font-semibold'
                        : 'border-border bg-surface-2 text-fg-subtle italic'
                    }`}>
                      {duree ?? '— calculée automatiquement —'}
                    </div>
                  </div>
                  {/* Notes déplacées ici depuis le card Localisation */}
                  <FormField
                    label="Notes"
                    name="notes"
                    type="textarea"
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="Conditions de terrain, observations particulières…"
                  />
                </div>

              </div>
            </div>

            {/* ── 3. Localisation ── */}
            <div className="card overflow-hidden p-0">

              {/* En-tête mince */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface">
                <MapIcon size={14} className="text-danger" />
                <span className="text-xs font-semibold text-fg uppercase tracking-wider">
                  Localisation du piège
                </span>
              </div>

              {/* Layout 2 colonnes : panneau gauche + carte droite */}
              <div className="flex flex-col lg:flex-row">

                {/* ── Panneau gauche : champs GPS ── */}
                <div className="w-full lg:w-56 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-surface-2/30 p-4 flex flex-col gap-4">

                  {/* Latitude */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-fg-subtle uppercase tracking-wider">
                      <MapPin size={9} /> Latitude
                    </label>
                    <input
                      type="number" name="latitude" value={form.latitude}
                      onChange={handleChange} placeholder="-18.9137" step="any"
                      className="w-full text-sm font-mono bg-surface border border-border-strong rounded-xl px-3 py-2.5 text-fg outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder-fg-subtle/50"
                    />
                  </div>

                  {/* Longitude */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-fg-subtle uppercase tracking-wider">
                      Longitude
                    </label>
                    <input
                      type="number" name="longitude" value={form.longitude}
                      onChange={handleChange} placeholder="47.5361" step="any"
                      className="w-full text-sm font-mono bg-surface border border-border-strong rounded-xl px-3 py-2.5 text-fg outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder-fg-subtle/50"
                    />
                  </div>

                  {/* Statut GPS */}
                  {hasGps ? (
                    <div className={`rounded-xl p-3 text-xs border transition-all duration-500 ${
                      gpsFlash ? 'bg-success/10 border-success/30' : 'bg-primary/5 border-primary/20'
                    }`}>
                      <div className={`flex items-center gap-1.5 font-semibold mb-1.5 transition-colors duration-500 ${
                        gpsFlash ? 'text-success' : 'text-primary'
                      }`}>
                        <MapPin size={11} /> Position définie
                      </div>
                      <p className="font-mono text-[10px] text-fg-muted leading-relaxed">
                        {parseFloat(form.latitude).toFixed(5)}<br />
                        {parseFloat(form.longitude).toFixed(5)}
                      </p>
                      <button type="button" onClick={clearGps}
                        className="mt-2.5 flex items-center gap-1 text-[10px] text-fg-subtle hover:text-danger transition-colors">
                        <X size={10} /> Effacer
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-3 text-xs text-fg-subtle space-y-1.5">
                      <div className="flex items-center gap-1.5 text-fg-muted font-medium">
                        <MapPin size={11} /> Aucune position
                      </div>
                      <p className="leading-relaxed">
                        Recherchez un lieu ou cliquez sur la carte.
                      </p>
                    </div>
                  )}

                  <div className="flex-1" />
                </div>

                {/* ── Carte ── */}
                <div className="flex-1 min-w-0 [&>div]:!rounded-none [&>div]:!border-0 [&>div]:!shadow-none">
                  <MapPicker
                    latitude={form.latitude   || undefined}
                    longitude={form.longitude || undefined}
                    onChange={handleMapChange}
                    height="560px"
                  />
                </div>

              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <Link to="/methodes" className="btn-secondary">Annuler</Link>
              <button type="submit" disabled={isLoading || loadingRefs} className="btn-primary">
                {isLoading ? 'Création…' : 'Créer la méthode'}
              </button>
            </div>
          </div>

          {/* ═══ Sidebar ═══ */}
          <aside className="space-y-4 xl:sticky xl:top-4 self-start">

            <Card padding="sm" tone="primary">
              <div className="flex items-center gap-2 mb-3">
                <Beaker size={15} className="text-info" />
                <p className="text-xs font-semibold text-fg uppercase tracking-wider">Aperçu</p>
              </div>
              <div className="space-y-2.5">
                {identifiant ? (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <Hash size={9} /> Identifiant
                    </p>
                    <p className="text-sm font-mono font-bold text-primary">{identifiant}</p>
                  </div>
                ) : (
                  <p className="text-xs text-fg-subtle italic">— sélectionnez un type et un numéro —</p>
                )}
                {selectedLocalite && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5">Localité</p>
                    <p className="text-xs font-semibold text-fg">{selectedLocalite.nom}</p>
                  </div>
                )}
                {selectedType && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5">Type de méthode</p>
                    <p className="text-xs text-fg-muted">{selectedType.nom}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {selectedHabitat && (
                    <div>
                      <p className="text-fg-subtle mb-0.5">Habitat</p>
                      <p className="font-semibold text-fg">{selectedHabitat.nom}</p>
                    </div>
                  )}
                  {selectedEnv && (
                    <div>
                      <p className="text-fg-subtle mb-0.5">Environnement</p>
                      <p className="font-semibold text-fg">{selectedEnv.nom}</p>
                    </div>
                  )}
                  {form.dateCollecte && (
                    <div>
                      <p className="text-fg-subtle mb-0.5">Date</p>
                      <p className="font-semibold text-fg">
                        {new Date(form.dateCollecte).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  )}
                  {duree && (
                    <div>
                      <p className="text-fg-subtle mb-0.5">Durée</p>
                      <p className="font-semibold text-success">{duree}</p>
                    </div>
                  )}
                </div>
                {hasGps && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-1 flex items-center gap-1">
                      <MapPin size={9} /> GPS
                    </p>
                    <p className="text-xs font-mono text-fg-muted leading-relaxed">
                      {parseFloat(form.latitude).toFixed(6)}<br />
                      {parseFloat(form.longitude).toFixed(6)}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <Card padding="sm">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Info size={12} className="text-fg-subtle" />
                <p className="text-xs font-semibold text-fg">Consignes de saisie</p>
              </div>
              <div className="text-[11px] text-fg-muted space-y-2.5 leading-relaxed">
                <div>
                  <p className="font-semibold text-fg mb-0.5">Méthode</p>
                  <p>• Le <strong>type</strong> est issu du dictionnaire (CDC, BG-Sentinel, capture humaine…)</p>
                  <p className="mt-1">• Le <strong>numéro</strong> distingue les pièges du même type — ex : <code className="font-mono text-[10px]">CDC_1</code>, <code className="font-mono text-[10px]">CDC_2</code></p>
                </div>
                <div>
                  <p className="font-semibold text-fg mb-0.5">Contexte</p>
                  <p>• Habitat et environnement améliorent l'analyse statistique.</p>
                </div>
                <div>
                  <p className="font-semibold text-fg mb-0.5">Localisation</p>
                  <p>• Utilisez la <strong>barre de recherche</strong> sur la carte ou cliquez directement dessus.</p>
                  <p className="mt-1">• Les coordonnées se pré-remplissent depuis la localité sélectionnée.</p>
                </div>
                <div>
                  <p className="font-semibold text-fg mb-0.5">Horaires</p>
                  <p>• Début/fin → durée calculée automatiquement.</p>
                </div>
              </div>
            </Card>

          </aside>
        </div>
      </form>
    </div>
  );
}
