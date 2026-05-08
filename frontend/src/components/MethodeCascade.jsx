// Sélection en cascade : Ordre de mission → Localité → Méthode de collecte.
// Usage :
//   <MethodeCascade methodeId={form.methodeId} onChange={(id) => setForm({...form, methodeId: id})} error={errors.methodeId} />

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import api from '../api/axios';

export default function MethodeCascade({ methodeId, onChange, onMissionChange, error }) {
  const [missions,  setMissions]  = useState([]);
  const [localites, setLocalites] = useState([]);
  const [methodes,  setMethodes]  = useState([]);

  const [missionId,  setMissionId]  = useState('');
  const [localiteId, setLocaliteId] = useState('');

  // Notifier le parent quand la mission change (pour ContainerSelector qui en a besoin)
  useEffect(() => {
    if (onMissionChange) onMissionChange(missionId || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);

  const baseClass = `
    w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors
    focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400
    disabled:bg-surface-2 disabled:text-fg-subtle disabled:cursor-not-allowed
    border-border-strong bg-surface hover:border-gray-300
  `;
  const errClass = `
    w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors
    focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400
    border-red-300 bg-danger/10
  `;

  // Charger toutes les missions au montage
  useEffect(() => {
    api.get('/missions').then((r) => setMissions(r.data.missions || []));
  }, []);

  // Quand la mission change → charger ses localités, réinitialiser la suite
  const handleMissionChange = async (e) => {
    const id = e.target.value;
    setMissionId(id);
    setLocaliteId('');
    setMethodes([]);
    onChange('');

    if (!id) { setLocalites([]); return; }
    const r = await api.get('/localites', { params: { missionId: id } });
    setLocalites(r.data.localites || []);
  };

  // Quand la localité change → charger ses méthodes, réinitialiser la méthode
  const handleLocaliteChange = async (e) => {
    const id = e.target.value;
    setLocaliteId(id);
    onChange('');

    if (!id) { setMethodes([]); return; }
    const r = await api.get('/methodes', { params: { localiteId: id } });
    setMethodes(r.data.methodes || []);
  };

  const handleMethodeChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <div className="space-y-3">
      {/* Ligne de breadcrumb visuel */}
      <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
        <span className={missionId  ? 'text-primary font-medium' : ''}>Mission</span>
        <ChevronRight size={12} />
        <span className={localiteId ? 'text-primary font-medium' : ''}>Localité</span>
        <ChevronRight size={12} />
        <span className={methodeId  ? 'text-primary font-medium' : ''}>Méthode de collecte</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Ordre de mission */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-fg-muted tracking-wide">
            Ordre de mission <span className="text-red-400">*</span>
          </label>
          <select value={missionId} onChange={handleMissionChange} className={baseClass}>
            <option value="">— Sélectionner —</option>
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.ordreMission}
                {m.projet?.code ? ` (${m.projet.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Localité */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-fg-muted tracking-wide">
            Localité <span className="text-red-400">*</span>
          </label>
          <select
            value={localiteId}
            onChange={handleLocaliteChange}
            disabled={!missionId}
            className={baseClass}
          >
            <option value="">— Sélectionner —</option>
            {localites.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}{l.region ? ` — ${l.region}` : ''}
              </option>
            ))}
          </select>
          {missionId && localites.length === 0 && (
            <p className="text-xs text-amber-500">Aucune localité pour cette mission</p>
          )}
        </div>

        {/* 3. Méthode de collecte */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-fg-muted tracking-wide">
            Méthode de collecte <span className="text-red-400">*</span>
          </label>
          <select
            value={methodeId}
            onChange={handleMethodeChange}
            disabled={!localiteId}
            className={error ? errClass : baseClass}
          >
            <option value="">— Sélectionner —</option>
            {methodes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.typeMethode?.code ? `[${m.typeMethode.code}] ` : ''}
                {m.typeMethode?.nom || `Méthode #${m.id}`}
                {m.dateCollecte ? ` — ${new Date(m.dateCollecte).toLocaleDateString('fr-FR')}` : ''}
              </option>
            ))}
          </select>
          {localiteId && methodes.length === 0 && (
            <p className="text-xs text-amber-500">Aucune méthode pour cette localité</p>
          )}
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
