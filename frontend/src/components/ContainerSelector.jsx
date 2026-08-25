// Composant unifié de sélection / création de container avec grille interactive.
//
// Props :
//   missionId        : id mission (requis pour créer un container)
//   value            : { containerId, position, insertMode } courant
//   onChange         : ({ containerId, position, insertMode }) => void
//   nombre           : nombre d'individus (pour mode split sur boîte)
//   error            : message d'erreur éventuel
//
// Comportement :
//  - Toggle entre PLAQUE (96 puits) et BOITE (81 tubes)
//  - Liste les containers existants de la mission + bouton "+" création
//  - Au choix d'un container, affiche la grille avec positions occupées en gris
//  - Pour BOITE + nombre>1 : choix mode "single" (1 enreg. N indiv.) / "split" (N enreg. 1/tube)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Layers, Box, X, AlertTriangle, Check } from 'lucide-react';
import api from '../api/axios';
import { toast } from '../lib/toast';
import { Select } from './ui';
import { useT, interpolate } from '../lib/i18n';

// Génère toutes les positions d'un container
const buildPositions = (type) => {
  if (type === 'PLAQUE') {
    const out = [];
    for (const r of 'ABCDEFGH') for (let c = 1; c <= 12; c++) out.push(`${r}${c}`);
    return out;
  }
  if (type === 'BOITE') {
    const out = [];
    for (let r = 1; r <= 9; r++) for (let c = 1; c <= 9; c++) out.push(`${r}-${c}`);
    return out;
  }
  return [];
};

// ── Modal de création ────────────────────────────────────────
function CreateContainerModal({ missionId, type, onCreated, onClose }) {
  const t = useT();
  const [notes,   setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const submit = async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.post('/containers', { type, missionId, notes });
      onCreated(r.data.container);
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden my-4 sm:mt-16">
        <div className={`px-6 py-5 flex items-center justify-between bg-gradient-to-r ${type === 'PLAQUE' ? 'from-emerald-600 to-emerald-500' : 'from-amber-600 to-amber-500'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface/20 flex items-center justify-center">
              {type === 'PLAQUE' ? <Layers size={16} className="text-white" /> : <Box size={16} className="text-white" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {type === 'PLAQUE' ? t('containerSelector.newPlate') : t('containerSelector.newBox')}
              </h2>
              <p className="text-xs text-white/80">{t('containerSelector.autoCode')}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">{error}</div>}

          <div className="bg-surface-2 rounded-xl p-3 text-xs text-fg-muted">
            {t('containerSelector.codeFormatPrefix')} <code className="font-mono font-semibold text-fg">{type === 'PLAQUE' ? 'P' : 'B'}_&lt;n° mission&gt;_AAAAMM_n</code>
            {' '}{t('containerSelector.codeFormatSuffix')}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-muted">{t('containerSelector.notesOptional')}</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder={t('containerSelector.notesPlaceholder')}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
            <button type="button" disabled={loading} onClick={submit} className="btn-primary">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {t('common.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Grille de visualisation ──────────────────────────────────
function ContainerGrid({ type, occupied, selectedPosition, onSelect, autoPositions = [] }) {
  const t = useT();
  if (!type) return null;

  const isPlaque = type === 'PLAQUE';
  const cols     = isPlaque ? 12 : 9;
  const rows     = isPlaque ? 'ABCDEFGH'.split('') : ['1','2','3','4','5','6','7','8','9'];
  const cellSize = isPlaque ? 'w-7 h-7' : 'w-9 h-9';

  const isOccupied = (pos) => occupied.has(pos);
  const isAuto     = (pos) => autoPositions.includes(pos);
  // H12 = puits témoin (SOP) : jamais utilisable pour un spécimen
  const isTemoin   = (pos) => isPlaque && pos === 'H12';

  const allPositions  = buildPositions(type);
  const totalCount    = allPositions.length;
  const temoinCount   = isPlaque ? 1 : 0;
  const occupiedCount = occupied.size;
  const freeCount     = totalCount - occupiedCount - temoinCount;
  const pct           = totalCount > 0 ? Math.round((occupiedCount / totalCount) * 100) : 0;

  return (
    <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-border-strong p-4 flex gap-5 overflow-x-auto">

      {/* ── Grille ── */}
      <div className="flex-shrink-0">
        {/* En-tête colonnes */}
        <div className="flex items-center gap-1 ml-7 mb-1">
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} className={`${cellSize} flex items-center justify-center text-[10px] font-semibold text-fg-subtle`}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Lignes */}
        {rows.map((r) => (
          <div key={r} className="flex items-center gap-1 mb-1">
            <div className="w-6 text-[10px] font-semibold text-fg-subtle text-right pr-1">{r}</div>
            {Array.from({ length: cols }, (_, i) => {
              const pos = isPlaque ? `${r}${i + 1}` : `${r}-${i + 1}`;
              const occ = isOccupied(pos);
              const sel = pos === selectedPosition;
              const auto= isAuto(pos);
              const tem = isTemoin(pos);
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => !occ && !tem && onSelect(pos)}
                  disabled={occ || tem}
                  title={tem ? t('containerSelector.controlWell') : occ ? `${pos} : ${occupied.get(pos).map((s) => s.idTerrain || `#${s.id}`).join(', ')}` : pos}
                  className={`${cellSize} rounded-md text-[9px] font-mono transition-all border
                    ${tem
                      ? 'bg-amber-100 text-amber-700 border-amber-300 cursor-not-allowed'
                      : occ
                      ? 'bg-gray-300 text-fg-muted border-gray-400 cursor-not-allowed'
                      : sel
                      ? 'bg-primary-600 text-white border-primary-700 ring-2 ring-primary-300 scale-110 z-10'
                      : auto
                      ? 'bg-emerald-200 text-emerald-800 border-emerald-400 ring-1 ring-emerald-300'
                      : 'bg-surface text-fg-subtle border-border-strong hover:bg-primary/10 hover:border-primary-300 hover:text-primary'}
                  `}
                >
                  {tem ? 'T' : sel ? '●' : occ ? '×' : auto ? '+' : ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Panneau latéral ── */}
      <div className="flex-1 min-w-[160px] flex flex-col gap-4 border-l border-border-strong/40 pl-5">

        {/* Position sélectionnée */}
        {selectedPosition && (
          <div>
            <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider mb-1">{t('containerSelector.chosenPosition')}</p>
            <p className="text-3xl font-bold font-mono" style={{ color: 'rgb(var(--primary))' }}>{selectedPosition}</p>
          </div>
        )}

        {/* Auto-positions (mode split) */}
        {autoPositions.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider mb-2">
              {t('containerSelector.autoAssigned')} ({autoPositions.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {autoPositions.map(p => (
                <span key={p} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono rounded border border-emerald-300">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Occupation */}
        <div>
          <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider mb-2">{t('containerSelector.occupation')}</p>
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-fg-muted">{t('containerSelector.free')}</span>
              <span className="font-bold text-fg tabular-nums">{freeCount}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-fg-muted">{t('containerSelector.occupied')}</span>
              <span className="font-bold text-fg tabular-nums">{occupiedCount}</span>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-border pt-1.5">
              <span className="text-fg-muted">{t('containerSelector.totalUseful')}</span>
              <span className="font-bold text-fg tabular-nums">{totalCount - temoinCount}</span>
            </div>
          </div>
          <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%`, backgroundColor: 'rgb(var(--primary))' }}
            />
          </div>
          <p className="text-[10px] text-fg-subtle mt-1.5">{interpolate(t('containerSelector.usedPct'), { pct })}</p>
        </div>

        {/* Légende */}
        <div className="mt-auto border-t border-border-strong/40 pt-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider mb-2">{t('containerSelector.legend')}</p>
          <span className="flex items-center gap-1.5 text-[10px] text-fg-subtle">
            <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-surface border border-border-strong inline-block" /> {t('containerSelector.legendFree')}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-fg-subtle">
            <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-primary-600 border border-primary-700 inline-block" /> {t('containerSelector.legendSelected')}
          </span>
          {autoPositions.length > 0 && (
            <span className="flex items-center gap-1.5 text-[10px] text-fg-subtle">
              <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-emerald-200 border border-emerald-400 inline-block" /> {t('containerSelector.legendAuto')} ({autoPositions.length})
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[10px] text-fg-subtle">
            <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-gray-300 border border-gray-400 inline-block" /> {t('containerSelector.legendOccupied')}
          </span>
          {isPlaque && (
            <span className="flex items-center gap-1.5 text-[10px] text-fg-subtle">
              <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-amber-100 border border-amber-300 inline-block" /> {t('containerSelector.legendControlWell')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────
export default function ContainerSelector({ missionId, value, onChange, nombre = 1, error }) {
  const t = useT();
  const { containerId, position, insertMode = 'single' } = value || {};

  const [type, setType] = useState('PLAQUE');
  const [containers, setContainers] = useState([]);
  const [containerData, setContainerData] = useState(null); // detail courant
  const [loading,   setLoading]   = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Charge les containers de la mission filtrés par type
  const refreshList = useCallback(async () => {
    if (!missionId) { setContainers([]); return; }
    setLoading(true);
    try {
      const r = await api.get('/containers', { params: { missionId, type } });
      setContainers(r.data.containers || []);
    } catch {
      setContainers([]);
      toast.error(t('containerSelector.loadListError'));
    } finally { setLoading(false); }
  }, [missionId, type, t]);

  // Charge le détail (positions occupées) quand un container est choisi
  const refreshDetail = useCallback(async (cId) => {
    if (!cId) { setContainerData(null); return; }
    try {
      const r = await api.get(`/containers/${cId}`);
      setContainerData(r.data);
    } catch {
      setContainerData(null);
      toast.error(t('containerSelector.loadDetailError'));
    }
  }, [t]);

  useEffect(() => { refreshList(); }, [refreshList]);
  useEffect(() => { refreshDetail(containerId); }, [containerId, refreshDetail]);

  const occupiedMap = useMemo(() => {
    const m = new Map();
    if (containerData?.occupied) {
      containerData.occupied.forEach(({ position: p, items }) => m.set(p, items));
    }
    return m;
  }, [containerData]);

  // Pour une PLAQUE avec nombre>1, forcer automatiquement le mode split
  useEffect(() => {
    if (containerData?.container?.type === 'PLAQUE' && nombre > 1 && insertMode !== 'split') {
      onChange({ containerId, position: '', insertMode: 'split' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerData, nombre]);

  // Calcul des positions auto pour le mode split (boîte ou plaque + nombre>1)
  const isSplitMode = containerId && insertMode === 'split' && nombre > 1;
  const autoPositions = useMemo(() => {
    if (!isSplitMode || !containerData) return [];
    const all = buildPositions(containerData.container.type);
    // Exclure H12 (témoin SOP) pour les plaques
    const free = all.filter((p) => !occupiedMap.has(p) && p !== 'H12');
    return free.slice(0, nombre);
  }, [isSplitMode, containerData, occupiedMap, nombre]);

  const handleSwitchType = (newType) => {
    if (newType === type) return;
    setType(newType);
    onChange({ containerId: '', position: '', insertMode: 'single' });
    setContainerData(null);
  };

  const handleSelectContainer = (id) => {
    onChange({ containerId: id, position: '', insertMode });
  };

  const handleSelectPosition = (pos) => {
    onChange({ containerId, position: pos, insertMode });
  };

  const handleContainerCreated = async (newContainer) => {
    setShowModal(false);
    await refreshList();
    onChange({ containerId: String(newContainer.id), position: '', insertMode });
  };

  const containerType = containerData?.container?.type || type;
  const isPlaque = containerType === 'PLAQUE';

  return (
    <div className="space-y-4">

      {/* Switch type */}
      <div className="flex items-center gap-2 p-1 bg-surface-3 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => handleSwitchType('PLAQUE')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            type === 'PLAQUE'
              ? 'bg-surface text-emerald-700 shadow-sm'
              : 'text-fg-muted hover:text-fg'
          }`}
        >
          <Layers size={14} /> {t('containerSelector.plateLabel')}
        </button>
        <button
          type="button"
          onClick={() => handleSwitchType('BOITE')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            type === 'BOITE'
              ? 'bg-surface text-amber-700 shadow-sm'
              : 'text-fg-muted hover:text-fg'
          }`}
        >
          <Box size={14} /> {t('containerSelector.boxLabel')}
        </button>
      </div>

      {/* Sélecteur container + bouton créer */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-semibold text-fg-muted tracking-wide">
            {isPlaque ? t('containerSelector.plate') : t('containerSelector.box')} {t('containerSelector.conservationLabel')}
          </label>
          <Select
            value={containerId || ''}
            onChange={handleSelectContainer}
            disabled={!missionId || loading}
            options={[
              { value: '', label: `— ${t('common.select')} —` },
              ...containers.map((c) => ({
                value: c.id,
                label: `${c.code}${c.notes ? ` — ${c.notes.slice(0, 30)}` : ''}`,
              })),
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={!missionId}
          title={isPlaque ? t('containerSelector.newPlateShort') : t('containerSelector.newBoxShort')}
          className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
            isPlaque
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100'
              : 'bg-warning/10 border border-warning/20 text-warning hover:bg-amber-100'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Plus size={18} />
        </button>
      </div>

      {!missionId && (
        <p className="text-xs text-warning flex items-center gap-1.5">
          <AlertTriangle size={12} /> {t('containerSelector.selectMissionFirst')}
        </p>
      )}

      {/* Mode d'insertion — BOITE + nombre>1 */}
      {containerData?.container?.type === 'BOITE' && nombre > 1 && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-800 mb-2">{t('containerSelector.insertMode')}</p>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="radio" name="insertMode" value="single"
              checked={insertMode === 'single'}
              onChange={() => onChange({ containerId, position, insertMode: 'single' })}
              className="mt-0.5"
            />
            <div className="text-xs">
              <p className="font-semibold text-fg">{interpolate(t('containerSelector.singleModeTitle'), { n: nombre })}</p>
              <p className="text-fg-muted">{interpolate(t('containerSelector.singleModeHint'), { n: nombre })}</p>
            </div>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="radio" name="insertMode" value="split"
              checked={insertMode === 'split'}
              onChange={() => onChange({ containerId, position: '', insertMode: 'split' })}
              className="mt-0.5"
            />
            <div className="text-xs">
              <p className="font-semibold text-fg">{interpolate(t('containerSelector.splitModeTitle'), { n: nombre })}</p>
              <p className="text-fg-muted">{interpolate(t('containerSelector.splitModeHint'), { n: nombre })}</p>
            </div>
          </label>
        </div>
      )}

      {/* Mode d'insertion — PLAQUE + nombre>1 → split automatique */}
      {containerData?.container?.type === 'PLAQUE' && nombre > 1 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-800">
          <Check size={14} className="flex-shrink-0 mt-0.5 text-emerald-600" />
          <span>
            <strong>{t('containerSelector.autoSplitLabel')}</strong> {interpolate(t('containerSelector.autoSplitHint'), { n: nombre })}
          </span>
        </div>
      )}

      {/* Grille */}
      {containerData && (
        <ContainerGrid
          type={containerData.container.type}
          occupied={occupiedMap}
          selectedPosition={isSplitMode ? null : position}
          autoPositions={isSplitMode ? autoPositions : []}
          onSelect={handleSelectPosition}
        />
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {showModal && (
        <CreateContainerModal
          missionId={missionId} type={type}
          onCreated={handleContainerCreated}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
