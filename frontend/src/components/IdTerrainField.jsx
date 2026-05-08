// Champ "ID terrain" qui interroge le backend pour générer le prochain ID
// dès qu'une méthode est sélectionnée. Éditable manuellement si besoin.

import { useEffect, useState } from 'react';
import { Tag, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../api/axios';

export default function IdTerrainField({ methodeId, value, onChange, error }) {
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState(null);
  const [auto, setAuto] = useState(true); // l'utilisateur n'a pas encore édité

  // Récupère le prochain ID dès qu'une méthode est choisie
  const fetchPreview = async () => {
    if (!methodeId) { onChange(''); setWarning(null); return; }
    setLoading(true);
    try {
      const r = await api.get(`/methodes/${methodeId}/preview-id-terrain`);
      setWarning(r.data.warning || null);
      if (auto) onChange(r.data.idTerrain || '');
    } catch {
      setWarning('Impossible de générer l\'ID');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (auto) fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodeId]);

  const handleManualChange = (e) => {
    setAuto(false);
    onChange(e.target.value.toUpperCase());
  };

  const resetToAuto = () => {
    setAuto(true);
    fetchPreview();
  };

  const inputCls = `
    w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors
    focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400
    font-mono
    ${error ? 'border-red-300 bg-danger/10' : 'border-border-strong bg-surface'}
    ${auto ? 'text-primary-700' : 'text-fg'}
  `;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-fg-muted tracking-wide flex items-center gap-1.5">
          <Tag size={12} className="text-primary" />
          ID terrain
          {auto && <span className="text-[10px] text-primary normal-case font-normal">(auto)</span>}
        </label>
        {!auto && (
          <button
            type="button"
            onClick={resetToAuto}
            className="text-[10px] text-fg-subtle hover:text-primary inline-flex items-center gap-1"
          >
            <RefreshCw size={10} /> Régénérer
          </button>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          value={value || ''}
          onChange={handleManualChange}
          placeholder={methodeId ? '...' : 'Sélectionnez d\'abord une méthode'}
          disabled={!methodeId}
          className={inputCls}
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle animate-spin" />
        )}
      </div>

      {warning && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{warning}</span>
        </p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      {!error && !warning && methodeId && (
        <p className="text-xs text-fg-subtle">
          Format : <span className="font-mono">{'<CODE>'}_{'<n>'}</span> — modifiable si besoin
        </p>
      )}
    </div>
  );
}
