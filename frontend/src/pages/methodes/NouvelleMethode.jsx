import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Beaker, MapPin, Trees, Map as MapIcon, Calendar, Check, Loader2 } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import MapPicker from '../../components/MapPicker';

export default function NouvelleMethode() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
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
  });

  const [localites,        setLocalites]        = useState([]);
  const [typesMethode,     setTypesMethode]     = useState([]);
  const [typesHabitat,     setTypesHabitat]     = useState([]);
  const [typesEnvironnement, setTypesEnvironnement] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors]       = useState({});

  useEffect(() => {
    Promise.all([
      api.get('/localites'),
      api.get('/dictionnaire/types-methode',       { params: { actif: 'true' } }),
      api.get('/dictionnaire/types-habitat',       { params: { actif: 'true' } }),
      api.get('/dictionnaire/types-environnement', { params: { actif: 'true' } }),
    ]).then(([lRes, tmRes, thRes, teRes]) => {
      setLocalites(lRes.data.localites || []);
      setTypesMethode(tmRes.data.items || []);
      setTypesHabitat(thRes.data.items || []);
      setTypesEnvironnement(teRes.data.items || []);
    }).catch(console.error);
  }, []);

  // Préremplir les coordonnées GPS depuis la localité sélectionnée
  useEffect(() => {
    if (!form.localiteId) return;
    if (form.latitude && form.longitude) return;
    const loc = localites.find((l) => l.id === parseInt(form.localiteId));
    if (loc?.latitude && loc?.longitude) {
      setForm((f) => ({ ...f, latitude: String(loc.latitude), longitude: String(loc.longitude) }));
    }
  }, [form.localiteId, localites]);

  const handleChange = (e) => {
    setErrors({ ...errors, [e.target.name]: null });
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const errs = {};
    if (!form.localiteId)    errs.localiteId    = 'La localité est obligatoire';
    if (!form.typeMethodeId) errs.typeMethodeId = 'Le type de méthode est obligatoire';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await api.post('/methodes', {
        localiteId:          parseInt(form.localiteId),
        typeMethodeId:       parseInt(form.typeMethodeId),
        typeHabitatId:       form.typeHabitatId       ? parseInt(form.typeHabitatId)       : null,
        typeEnvironnementId: form.typeEnvironnementId ? parseInt(form.typeEnvironnementId) : null,
        latitude:            form.latitude  || null,
        longitude:           form.longitude || null,
        dateCollecte:        form.dateCollecte || null,
        heureDebut:          form.heureDebut   || null,
        heureFin:            form.heureFin     || null,
        notes:               form.notes        || null,
      });
      navigate('/methodes');
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Erreur lors de la création' });
    } finally {
      setIsLoading(false);
    }
  };

  const localiteOptions    = localites.map((l) => ({
    value: l.id,
    label: `${l.nom}${l.mission?.ordreMission ? ' — ' + l.mission.ordreMission : ''}`,
  }));
  const typeMethodeOptions = typesMethode.map((t) => ({ value: t.id, label: `${t.code} — ${t.nom}` }));
  const typeHabitatOptions = typesHabitat.map((t) => ({ value: t.id, label: t.nom }));
  const typeEnvOptions     = typesEnvironnement.map((t) => ({ value: t.id, label: t.nom }));

  return (
    <div className="max-w-4xl space-y-5">
      <Link to="/methodes" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
        <ChevronLeft size={16} /> Méthodes
      </Link>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errors.submit && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600">{errors.submit}</div>
        )}

        <div className="card p-6">
          <h2 className="section-title">
            <Beaker size={17} className="text-blue-500" /> Méthode
          </h2>
          <div className="space-y-4">
            <FormField
              label="Localité" name="localiteId" type="select"
              value={form.localiteId} onChange={handleChange}
              options={localiteOptions} required error={errors.localiteId}
            />
            <FormField
              label="Type de méthode (référentiel)" name="typeMethodeId" type="select"
              value={form.typeMethodeId} onChange={handleChange}
              options={typeMethodeOptions} required error={errors.typeMethodeId}
              hint="Sélection obligatoire depuis le dictionnaire"
            />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="section-title">
            <Trees size={17} className="text-emerald-500" /> Contexte
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Type d'habitat" name="typeHabitatId" type="select"
              value={form.typeHabitatId} onChange={handleChange}
              options={typeHabitatOptions}
            />
            <FormField
              label="Type d'environnement" name="typeEnvironnementId" type="select"
              value={form.typeEnvironnementId} onChange={handleChange}
              options={typeEnvOptions}
            />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="section-title">
            <MapIcon size={17} className="text-rose-500" /> Coordonnées GPS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FormField label="Latitude"  name="latitude"  type="number" value={form.latitude}  onChange={handleChange} placeholder="ex: -18.9137" />
            <FormField label="Longitude" name="longitude" type="number" value={form.longitude} onChange={handleChange} placeholder="ex: 47.5361" />
          </div>
          <MapPicker
            latitude={form.latitude || undefined}
            longitude={form.longitude || undefined}
            onChange={({ latitude, longitude }) => setForm((f) => ({ ...f, latitude, longitude }))}
          />
        </div>

        <div className="card p-6">
          <h2 className="section-title">
            <Calendar size={17} className="text-amber-500" /> Date et horaires
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Date de collecte" name="dateCollecte" type="date" value={form.dateCollecte} onChange={handleChange} />
            <FormField label="Heure de début" name="heureDebut" type="time" value={form.heureDebut} onChange={handleChange} />
            <FormField label="Heure de fin"   name="heureFin"   type="time" value={form.heureFin}   onChange={handleChange} />
          </div>
          <div className="mt-4">
            <FormField
              label="Notes" name="notes" type="textarea"
              value={form.notes} onChange={handleChange}
              placeholder="Conditions de terrain, observations particulières..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to="/methodes" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading
              ? <><Loader2 size={15} className="animate-spin" /> Création...</>
              : <><Check size={15} /> Créer la méthode</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
