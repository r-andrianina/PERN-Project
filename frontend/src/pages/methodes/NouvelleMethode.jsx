import { useEffect, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Beaker, Trees, Map as MapIcon, Calendar, Hash, Info, Clock, Timer } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import MapPicker from '../../components/MapPicker';
import { Card } from '../../components/ui';
import { useFormSubmit, useApiQueries } from '../../hooks';

export default function NouvelleMethode() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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

  useEffect(() => {
    if (!form.localiteId || (form.latitude && form.longitude)) return;
    const loc = localites.find((l) => l.id === parseInt(form.localiteId));
    if (loc?.latitude && loc?.longitude) {
      setField('latitude',  String(loc.latitude));
      setField('longitude', String(loc.longitude));
    }
  }, [form.localiteId, localites]); // eslint-disable-line

  const localiteOptions    = localites.map((l) => {
    const geo = [l.region, l.district, l.commune, l.fokontany].filter(Boolean).join(' / ');
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

          {/* ═══ Formulaire ═══ */}
          <div className="space-y-5">
            {errors.submit && (
              <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-sm text-danger">{errors.submit}</div>
            )}

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

            <div className="card p-6">
              <h2 className="section-title"><Trees size={17} className="text-success" /> Contexte</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Type d'habitat" name="typeHabitatId" type="select"
                  value={form.typeHabitatId} onChange={handleChange} options={typeHabitatOptions} />
                <FormField label="Type d'environnement" name="typeEnvironnementId" type="select"
                  value={form.typeEnvironnementId} onChange={handleChange} options={typeEnvOptions} />
              </div>
            </div>

            <div className="card p-6">
              <h2 className="section-title"><MapIcon size={17} className="text-danger" /> Coordonnées GPS</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <FormField label="Latitude"  name="latitude"  type="number" value={form.latitude}  onChange={handleChange} placeholder="ex: -18.9137" />
                <FormField label="Longitude" name="longitude" type="number" value={form.longitude} onChange={handleChange} placeholder="ex: 47.5361" />
              </div>
              <MapPicker
                latitude={form.latitude || undefined}
                longitude={form.longitude || undefined}
                onChange={({ latitude, longitude }) => { setField('latitude', latitude); setField('longitude', longitude); }}
              />
            </div>

            <div className="card p-6">
              <h2 className="section-title"><Calendar size={17} className="text-warning" /> Date et horaires</h2>

              {/* Ligne date + horaires */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* Date */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-fg-muted tracking-wide flex items-center gap-1.5">
                    <Calendar size={11} className="text-warning" /> Date de collecte
                  </label>
                  <input
                    type="date" name="dateCollecte" value={form.dateCollecte}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-strong bg-surface text-fg
                      hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>

                {/* Heure début */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-fg-muted tracking-wide flex items-center gap-1.5">
                    <Clock size={11} className="text-info" /> Heure de début
                  </label>
                  <input
                    type="time" name="heureDebut" value={form.heureDebut}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-strong bg-surface text-fg
                      hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>

                {/* Heure fin */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-fg-muted tracking-wide flex items-center gap-1.5">
                    <Clock size={11} className="text-danger" /> Heure de fin
                  </label>
                  <input
                    type="time" name="heureFin" value={form.heureFin}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-strong bg-surface text-fg
                      hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>

                {/* Durée calculée */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-fg-muted tracking-wide flex items-center gap-1.5">
                    <Timer size={11} className="text-success" /> Durée
                  </label>
                  <div className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors ${
                    duree
                      ? 'border-success/40 bg-success/5 text-success font-semibold'
                      : 'border-border bg-surface-2 text-fg-subtle italic'
                  }`}>
                    {duree ?? '— calculée automatiquement —'}
                  </div>
                </div>
              </div>

              <FormField label="Notes" name="notes" type="textarea" value={form.notes} onChange={handleChange}
                placeholder="Conditions de terrain, observations particulières..." />
            </div>

            <div className="flex items-center justify-end gap-3">
              <Link to="/methodes" className="btn-secondary">Annuler</Link>
              <button type="submit" disabled={isLoading || loadingRefs} className="btn-primary">
                {isLoading ? 'Création…' : 'Créer la méthode'}
              </button>
            </div>
          </div>

          {/* ═══ Sidebar ═══ */}
          <aside className="space-y-4 xl:sticky xl:top-4 self-start">

            {/* Aperçu */}
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
                      <p className="font-semibold text-fg">{new Date(form.dateCollecte).toLocaleDateString('fr-FR')}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Consignes */}
            <Card padding="sm">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Info size={12} className="text-fg-subtle" />
                <p className="text-xs font-semibold text-fg">Consignes de saisie</p>
              </div>
              <div className="text-[11px] text-fg-muted space-y-2.5 leading-relaxed">
                <div>
                  <p className="font-semibold text-fg mb-0.5">Méthode</p>
                  <p>• Le <strong>type</strong> est issu du dictionnaire (CDC, BG-Sentinel, capture humaine…)</p>
                  <p className="mt-1">• Le <strong>numéro</strong> distingue les pièges du même type dans une localité — ex : 3 CDC → <code className="font-mono text-[10px]">CDC_1</code>, <code className="font-mono text-[10px]">CDC_2</code>, <code className="font-mono text-[10px]">CDC_3</code></p>
                </div>
                <div>
                  <p className="font-semibold text-fg mb-0.5">Contexte</p>
                  <p>• Habitat et environnement sont facultatifs mais améliorent l'analyse statistique.</p>
                </div>
                <div>
                  <p className="font-semibold text-fg mb-0.5">Coordonnées GPS</p>
                  <p>• Les coordonnées se pré-remplissent depuis la localité.</p>
                  <p className="mt-1">• Ajustez si le piège n'est pas exactement au point central de la localité.</p>
                </div>
                <div>
                  <p className="font-semibold text-fg mb-0.5">Horaires</p>
                  <p>• Heure de début/fin = durée effective du piégeage, utile pour les analyses de densité.</p>
                </div>
              </div>
            </Card>

          </aside>
        </div>
      </form>
    </div>
  );
}
