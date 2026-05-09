import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, MapPin, ClipboardList, Plus, Trash2, Check, Loader2, Tag, Calendar, User, Navigation } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import MapPicker from '../../components/MapPicker';
import AgentMultiSelect from '../../components/AgentMultiSelect';

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
    agentIds: [],
  });
  const [localites, setLocalites]   = useState([defaultLocalite()]);
  const [projets, setProjets]       = useState([]);
  const [users, setUsers]           = useState([]);
  const [isLoading, setIsLoading]   = useState(false);
  const [errors, setErrors]         = useState({});
  const [activeLocalite, setActiveLocalite] = useState(0);
  // état auto-fill par localité : { 0: 'loading'|'match'|'nearest'|null }
  const [autoFill,  setAutoFill]    = useState({});

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

  // Lookup PostGIS fokontany à partir des coordonnées
  const lookupFokontany = async (index, lat, lng) => {
    if (!lat || !lng) return;
    setAutoFill((s) => ({ ...s, [index]: 'loading' }));
    try {
      const r = await api.get('/localites/lookup-fokontany', { params: { lat, lng } });
      const d = r.data;
      const filled = d.match ? d : d.nearest;
      if (filled) {
        const updated = [...localites];
        updated[index] = {
          ...updated[index],
          region:    filled.region    || updated[index].region,
          district:  filled.district  || updated[index].district,
          commune:   filled.commune   || updated[index].commune,
          fokontany: filled.fokontany || updated[index].fokontany,
        };
        setLocalites(updated);
        setAutoFill((s) => ({ ...s, [index]: d.match ? 'match' : 'nearest' }));
      } else {
        setAutoFill((s) => ({ ...s, [index]: 'none' }));
      }
    } catch {
      setAutoFill((s) => ({ ...s, [index]: 'none' }));
    }
  };

  const handleMapChange = (index, coords) => {
    const updated = [...localites];
    updated[index] = { ...updated[index], ...coords };
    setLocalites(updated);
    if (coords.latitude && coords.longitude) {
      lookupFokontany(index, coords.latitude, coords.longitude);
    } else {
      setAutoFill((s) => ({ ...s, [index]: null }));
    }
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
        projetId:      parseInt(mission.projetId),
        chefMissionId: mission.chefMissionId ? parseInt(mission.chefMissionId) : null,
        agentIds:      mission.agentIds.map((id) => parseInt(id)),
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

  const selectedProjet = projets.find((p) => p.id === parseInt(mission.projetId));
  const selectedChef   = users.find((u) => u.id === parseInt(mission.chefMissionId));
  const selectedAgents = users.filter((u) => mission.agentIds.includes(u.id));

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
              <AgentMultiSelect
                label="Agents de terrain"
                value={mission.agentIds}
                onChange={(ids) => setMission((m) => ({ ...m, agentIds: ids }))}
                users={users}
                max={5}
                hint="Maximum 5 agents — sélection parmi les utilisateurs actifs"
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                <div className="space-y-4 flex flex-col">
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

                  {/* Bandeau auto-fill */}
                  {autoFill[index] === 'loading' && (
                    <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2 text-xs text-blue-700">
                      <Loader2 size={12} className="animate-spin" /> Recherche du fokontany à ces coordonnées…
                    </div>
                  )}
                  {autoFill[index] === 'match' && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-xs text-emerald-700">
                      <Check size={12} /> Région / district / commune / fokontany pré-remplis depuis la base PostGIS — modifiables si besoin
                    </div>
                  )}
                  {autoFill[index] === 'nearest' && (
                    <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2 text-xs text-amber-700">
                      <Tag size={12} /> Point hors polygones — fokontany le plus proche utilisé
                    </div>
                  )}

                  <FormField
                    label="Région" name="region"
                    value={loc.region} onChange={(e) => handleLocaliteChange(index, e)}
                    placeholder="ex: Analamanga" required
                    error={errors[`localite_${index}_region`]}
                    hint="Pré-rempli au clic sur la carte"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="District" name="district"
                      value={loc.district} onChange={(e) => handleLocaliteChange(index, e)}
                      placeholder="ex: Ankazobe" required
                      error={errors[`localite_${index}_district`]}
                    />
                    <FormField
                      label="Commune" name="commune"
                      value={loc.commune} onChange={(e) => handleLocaliteChange(index, e)}
                      placeholder="Commune" required
                      error={errors[`localite_${index}_commune`]}
                    />
                  </div>
                  <FormField
                    label="Fokontany" name="fokontany"
                    value={loc.fokontany} onChange={(e) => handleLocaliteChange(index, e)}
                    placeholder="Fokontany" required
                    error={errors[`localite_${index}_fokontany`]}
                  />
                  <div className="grid grid-cols-3 gap-3 mt-auto">
                    <FormField
                      label="Latitude" name="latitude"
                      value={loc.latitude} onChange={(e) => handleLocaliteChange(index, e)}
                      onBlur={() => lookupFokontany(index, loc.latitude, loc.longitude)}
                      placeholder="-18.9137" hint="Cliquez sur la carte"
                    />
                    <FormField
                      label="Longitude" name="longitude"
                      value={loc.longitude} onChange={(e) => handleLocaliteChange(index, e)}
                      onBlur={() => lookupFokontany(index, loc.latitude, loc.longitude)}
                      placeholder="47.5361"
                    />
                    <FormField
                      label="Altitude (m)" name="altitudeM"
                      value={loc.altitudeM} onChange={(e) => handleLocaliteChange(index, e)}
                      placeholder="1200"
                    />
                  </div>
                </div>

                {/* Colonne carte — alignée verticalement avec la colonne gauche */}
                <div className="flex flex-col">
                  <p className="text-xs font-semibold text-gray-600 tracking-wide mb-1.5">
                    Carte — cliquez pour placer le point GPS et auto-remplir
                  </p>
                  <div className="flex-1 min-h-[480px]">
                    <MapPicker
                      latitude={loc.latitude}
                      longitude={loc.longitude}
                      onChange={(coords) => handleMapChange(index, coords)}
                      height="100%"
                    />
                  </div>
                </div>
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
                    <p className="text-xs font-medium text-fg">{selectedProjet.code} — {selectedProjet.nom}</p>
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
                {selectedChef && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-0.5 flex items-center gap-1"><User size={9} /> Chef</p>
                    <p className="text-xs text-fg">{selectedChef.prenom} {selectedChef.nom}</p>
                  </div>
                )}
                {selectedAgents.length > 0 && (
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider mb-1.5">Agents ({selectedAgents.length}/5)</p>
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
    </div>
  );
}
