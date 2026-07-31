// Sélection en cascade : Ordre de mission → Localité → Méthode de collecte.
// Usage :
//   <MethodeCascade methodeId={form.methodeId} onChange={(id) => setForm({...form, methodeId: id})} error={errors.methodeId} />

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import api from '../api/axios';
import { Select } from './ui';
import { useT } from '../lib/i18n';

export default function MethodeCascade({ methodeId, onChange, onMissionChange, error }) {
  const t = useT();
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

  // Charger toutes les missions au montage
  useEffect(() => {
    api.get('/missions').then((r) => setMissions(r.data.missions || []));
  }, []);

  // Quand la mission change → charger ses localités, réinitialiser la suite
  const handleMissionChange = async (id) => {
    setMissionId(id);
    setLocaliteId('');
    setMethodes([]);
    onChange('');

    if (!id) { setLocalites([]); return; }
    const r = await api.get('/localites', { params: { missionId: id } });
    setLocalites(r.data.localites || []);
  };

  // Quand la localité change → charger ses méthodes, réinitialiser la méthode
  const handleLocaliteChange = async (id) => {
    setLocaliteId(id);
    onChange('');

    if (!id) { setMethodes([]); return; }
    const r = await api.get('/methodes', { params: { localiteId: id } });
    setMethodes(r.data.methodes || []);
  };

  const handleMethodeChange = (id) => {
    onChange(id);
  };

  return (
    <div className="space-y-3">
      {/* Ligne de breadcrumb visuel */}
      <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
        <span className={missionId  ? 'text-primary font-medium' : ''}>{t('methodeCascade.mission')}</span>
        <ChevronRight size={12} />
        <span className={localiteId ? 'text-primary font-medium' : ''}>{t('methodeCascade.locality')}</span>
        <ChevronRight size={12} />
        <span className={methodeId  ? 'text-primary font-medium' : ''}>{t('methodeCascade.method')}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Ordre de mission */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-fg-muted tracking-wide">
            {t('methodeCascade.missionOrder')} <span className="text-red-400">*</span>
          </label>
          <Select
            value={missionId}
            onChange={handleMissionChange}
            options={[
              { value: '', label: `— ${t('common.select')} —` },
              ...missions.map((m) => ({
                value: m.id,
                label: `${m.ordreMission}${m.projet?.code ? ` (${m.projet.code})` : ''}`,
              })),
            ]}
          />
        </div>

        {/* 2. Localité */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-fg-muted tracking-wide">
            {t('methodeCascade.locality')} <span className="text-red-400">*</span>
          </label>
          <Select
            value={localiteId}
            onChange={handleLocaliteChange}
            disabled={!missionId}
            options={[
              { value: '', label: `— ${t('common.select')} —` },
              ...localites.map((l) => ({
                value: l.id,
                label: `${l.nom}${l.region ? ` — ${l.region}` : ''}`,
              })),
            ]}
          />
          {missionId && localites.length === 0 && (
            <p className="text-xs text-amber-500">{t('methodeCascade.noLocality')}</p>
          )}
        </div>

        {/* 3. Méthode de collecte */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-fg-muted tracking-wide">
            {t('methodeCascade.method')} <span className="text-red-400">*</span>
          </label>
          <Select
            value={methodeId}
            onChange={handleMethodeChange}
            disabled={!localiteId}
            error={!!error}
            options={[
              { value: '', label: `— ${t('common.select')} —` },
              ...methodes.map((m) => ({
                value: m.id,
                label: `${m.typeMethode?.code ? `[${m.typeMethode.code}] ` : ''}${m.typeMethode?.nom || `${t('methodeCascade.methodFallback')} #${m.id}`}${m.datePose ? ` — ${new Date(m.datePose).toLocaleDateString(t('common.locale'))}` : ''}`,
              })),
            ]}
          />
          {localiteId && methodes.length === 0 && (
            <p className="text-xs text-amber-500">{t('methodeCascade.noMethod')}</p>
          )}
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
