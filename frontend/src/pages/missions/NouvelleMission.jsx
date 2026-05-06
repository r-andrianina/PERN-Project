import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, MapPin, ClipboardList, Plus, Trash2, Check, Loader2 } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import MapPicker from '../../components/MapPicker';

const defaultLocalite = () => ({
  nom: '', toponyme: '', pays: 'Madagascar',
  region: '', district: '', commune: '', fokontany: '',
  latitude: '', longitude: '', altitudeM: '',
});

export default function NouvelleMission() {
  const navigate = useNavigate();

  const [mission, setMission] = useState({
    ordreMission: '', projetId: '', chefMissionId: '',
    dateDebut: '', dateFin: '', statut: 'planifiee', observations: '',
  });
  const [localites, setLocalites]   = useState([defaultLocalite()]);
  const [projets, setProjets]       = useState([]);
  const [users, setUsers]           = useState([]);
  const [isLoading, setIsLoading]   = useState(false);
  const [errors, setErrors]         = useState({});
  const [activeLocalite, setActiveLocalite] = useState(0);

  useEffect(() => {
    Promise.all([api.get('/projets'), api.get('/auth/users')])
      .then(([pRes, uRes]) => {
        setProjets(pRes.data.projets);
        setUsers(uRes.data.actifs);
      }).catch(console.error);
  }, []);

  const handleMissionChange = (e) => {
    setErrors({ ...errors, [e.target.name]: null });
    setMission({ ...mission, [e.target.name]: e.target.value });
  };

  const handleLocaliteChange = (index, e) => {
    const updated = [...localites];
    updated[index] = { ...updated[index], [e.target.name]: e.target.value };
    setLocalites(updated);
  };

  const handleMapChange = (index, coords) => {
    const updated = [...localites];
    updated[index] = { ...updated[index], ...coords };
    setLocalites(updated);
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
      if (!l.nom) errs[`localite_${i}_nom`] = 'Nom de localité obligatoire';
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
        projetId:      parseInt(mission.projetId),
        chefMissionId: mission.chefMissionId ? parseInt(mission.chefMissionId) : null,
      });
      const missionId = missionRes.data.mission.id;
      await Promise.all(
        localites.map(l => api.post('/localites', {
          ...l,
          missionId,
          latitude:  l.latitude  ? parseFloat(l.latitude)  : null,
          longitude: l.longitude ? parseFloat(l.longitude) : null,
          altitudeM: l.altitudeM ? parseFloat(l.altitudeM) : null,
        }))
      );
      navigate(`/missions/${missionId}`);
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Erreur lors de la création' });
    } finally {
      setIsLoading(false);
    }
  };

  const projetOptions = projets.map(p => ({ value: p.id, label: `${p.code} — ${p.nom}` }));
  const userOptions   = users.map(u  => ({ value: u.id, label: `${u.prenom} ${u.nom} (${u.role})` }));
  const statutOptions = [
    { value: 'planifiee', label: 'Planifiée' },
    { value: 'en_cours',  label: 'En cours'  },
    { value: 'terminee',  label: 'Terminée'  },
    { value: 'annulee',   label: 'Annulée'   },
  ];
  const regions = [
    'Analamanga','Vakinankaratra','Itasy','Bongolava','Matsiatra Ambony',
    'Amoron\'i Mania','Vatovavy','Fitovinany','Atsimo-Atsinanana',
    'Atsinanana','Analanjirofo','Alaotra-Mangoro','Boeny','Sofia',
    'Betsiboka','Melaky','Atsimo-Andrefana','Androy','Anosy',
    'Menabe','Diana','Sava',
  ].map(r => ({ value: r, label: r }));

  return (
    <div className="max-w-5xl space-y-5">

      <Link to="/missions" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
        <ChevronLeft size={16} /> Missions
      </Link>

      <form onSubmit={handleSubmit} className="space-y-5">

        {errors.submit && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600">
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
            <FormField
              label="Chef de mission" name="chefMissionId" type="select"
              value={mission.chefMissionId} onChange={handleMissionChange}
              options={userOptions}
            />
            <FormField
              label="Statut" name="statut" type="select"
              value={mission.statut} onChange={handleMissionChange}
              options={statutOptions}
            />
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
                  {i + 1}. {l.nom || 'Sans nom'}
                </button>
              ))}
            </div>
          )}

          {localites.map((loc, index) => (
            <div key={index} className={index === activeLocalite ? 'block' : 'hidden'}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Localité n°{index + 1}
                </p>
                {localites.length > 1 && (
                  <button
                    type="button" onClick={() => removeLocalite(index)}
                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} /> Supprimer
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <FormField
                    label="Nom de la localité" name="nom"
                    value={loc.nom} onChange={(e) => handleLocaliteChange(index, e)}
                    placeholder="ex: Grotte Ambodiriana"
                    required error={errors[`localite_${index}_nom`]}
                  />
                  <FormField
                    label="Toponyme" name="toponyme"
                    value={loc.toponyme} onChange={(e) => handleLocaliteChange(index, e)}
                    placeholder="Nom local / alternatif"
                  />
                  <FormField
                    label="Région" name="region" type="select"
                    value={loc.region} onChange={(e) => handleLocaliteChange(index, e)}
                    options={regions}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="District" name="district"
                      value={loc.district} onChange={(e) => handleLocaliteChange(index, e)}
                      placeholder="District"
                    />
                    <FormField
                      label="Commune" name="commune"
                      value={loc.commune} onChange={(e) => handleLocaliteChange(index, e)}
                      placeholder="Commune"
                    />
                  </div>
                  <FormField
                    label="Fokontany" name="fokontany"
                    value={loc.fokontany} onChange={(e) => handleLocaliteChange(index, e)}
                    placeholder="Fokontany"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      label="Latitude" name="latitude"
                      value={loc.latitude} onChange={(e) => handleLocaliteChange(index, e)}
                      placeholder="-18.9137" hint="Cliquez sur la carte"
                    />
                    <FormField
                      label="Longitude" name="longitude"
                      value={loc.longitude} onChange={(e) => handleLocaliteChange(index, e)}
                      placeholder="47.5361"
                    />
                    <FormField
                      label="Altitude (m)" name="altitudeM"
                      value={loc.altitudeM} onChange={(e) => handleLocaliteChange(index, e)}
                      placeholder="1200"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-600 tracking-wide mb-1.5">
                    Carte — cliquez pour placer le point GPS
                  </p>
                  <MapPicker
                    latitude={loc.latitude}
                    longitude={loc.longitude}
                    onChange={(coords) => handleMapChange(index, coords)}
                    height="350px"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to="/missions" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading
              ? <><Loader2 size={15} className="animate-spin" /> Création...</>
              : <><Check size={15} /> Créer la mission</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
