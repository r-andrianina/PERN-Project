import { useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Beaker, Trees, Map as MapIcon, Calendar } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import MapPicker from '../../components/MapPicker';
import { useFormSubmit, useApiQueries } from '../../hooks';

export default function NouvelleMethode() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Chargement des référentiels en parallèle
  const { results, loading: loadingRefs } = useApiQueries([
    { url: '/localites',                                          key: 'localites',  select: (r) => r.localites ?? [] },
    { url: '/dictionnaire/types-methode',       params: { actif: 'true' }, key: 'typesMethode', select: (r) => r.items ?? [] },
    { url: '/dictionnaire/types-habitat',       params: { actif: 'true' }, key: 'typesHabitat', select: (r) => r.items ?? [] },
    { url: '/dictionnaire/types-environnement', params: { actif: 'true' }, key: 'typesEnv',     select: (r) => r.items ?? [] },
  ]);
  const localites    = results.localites    ?? [];
  const typesMethode = results.typesMethode ?? [];
  const typesHabitat = results.typesHabitat ?? [];
  const typesEnv     = results.typesEnv     ?? [];

  // Formulaire
  const { form, setForm, setField, handleChange, errors, isLoading, handleSubmit } = useFormSubmit({
    initial: {
      localiteId:          searchParams.get('localiteId') || '',
      typeMethodeId:       '',
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

  // Préremplir les coordonnées depuis la localité sélectionnée
  useEffect(() => {
    if (!form.localiteId || (form.latitude && form.longitude)) return;
    const loc = localites.find((l) => l.id === parseInt(form.localiteId));
    if (loc?.latitude && loc?.longitude) {
      setField('latitude',  String(loc.latitude));
      setField('longitude', String(loc.longitude));
    }
  }, [form.localiteId, localites]); // eslint-disable-line

  const localiteOptions    = localites.map((l) => ({ value: l.id, label: `${l.nom}${l.mission?.ordreMission ? ' — ' + l.mission.ordreMission : ''}` }));
  const typeMethodeOptions = typesMethode.map((t) => ({ value: t.id, label: `${t.code} — ${t.nom}` }));
  const typeHabitatOptions = typesHabitat.map((t) => ({ value: t.id, label: t.nom }));
  const typeEnvOptions     = typesEnv.map((t)     => ({ value: t.id, label: t.nom }));

  return (
    <div className="max-w-4xl space-y-5">
      <Link to="/methodes" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> Méthodes
      </Link>

      <form onSubmit={handleSubmit} className="space-y-5">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Date de collecte" name="dateCollecte" type="date" value={form.dateCollecte} onChange={handleChange} />
            <FormField label="Heure de début"   name="heureDebut"   type="time" value={form.heureDebut}   onChange={handleChange} />
            <FormField label="Heure de fin"     name="heureFin"     type="time" value={form.heureFin}     onChange={handleChange} />
          </div>
          <div className="mt-4">
            <FormField label="Notes" name="notes" type="textarea" value={form.notes} onChange={handleChange}
              placeholder="Conditions de terrain, observations particulières..." />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to="/methodes" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={isLoading || loadingRefs} className="btn-primary">
            {isLoading ? 'Création…' : 'Créer la méthode'}
          </button>
        </div>
      </form>
    </div>
  );
}
