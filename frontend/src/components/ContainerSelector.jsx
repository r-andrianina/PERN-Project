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

import { useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Layers, Box, X, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import api from '../api/axios';

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
  const [notes,   setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const r = await api.post('/containers', { type, missionId, notes });
      onCreated(r.data.container);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className={`px-6 py-5 flex items-center justify-between bg-gradient-to-r ${type === 'PLAQUE' ? 'from-emerald-600 to-emerald-500' : 'from-amber-600 to-amber-500'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              {type === 'PLAQUE' ? <Layers size={16} className="text-white" /> : <Box size={16} className="text-white" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Nouvelle {type === 'PLAQUE' ? 'plaque (96 puits)' : 'boîte (81 tubes)'}
              </h2>
              <p className="text-xs text-white/80">Code généré automatiquement</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
            Le code sera de la forme <code className="font-mono font-semibold text-gray-700">{type === 'PLAQUE' ? 'P' : 'B'}_AAAAMM_n</code>
            {' '}où AAAAMM correspond au mois de début de la mission, et n est un compteur propre à cette mission.
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600">Notes (optionnel)</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="ex: Plaque dédiée aux Anopheles femelles…"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Créer
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Grille de visualisation ──────────────────────────────────
function ContainerGrid({ type, occupied, selectedPosition, onSelect, autoPositions = [] }) {
  if (!type) return null;

  const isPlaque = type === 'PLAQUE';
  const cols     = isPlaque ? 12 : 9;
  const rows     = isPlaque ? 'ABCDEFGH'.split('') : ['1','2','3','4','5','6','7','8','9'];
  const cellSize = isPlaque ? 'w-7 h-7' : 'w-9 h-9';

  const isOccupied = (pos) => occupied.has(pos);
  const isAuto     = (pos) => autoPositions.includes(pos);

  return (
    <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-4 overflow-x-auto">
      <div className="inline-block">
        {/* En-tête colonnes */}
        <div className="flex items-center gap-1 ml-7 mb-1">
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} className={`${cellSize} flex items-center justify-center text-[10px] font-semibold text-gray-400`}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Lignes */}
        {rows.map((r) => (
          <div key={r} className="flex items-center gap-1 mb-1">
            <div className="w-6 text-[10px] font-semibold text-gray-400 text-right pr-1">{r}</div>
            {Array.from({ length: cols }, (_, i) => {
              const pos = isPlaque ? `${r}${i + 1}` : `${r}-${i + 1}`;
              const occ = isOccupied(pos);
              const sel = pos === selectedPosition;
              const auto= isAuto(pos);
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => !occ && onSelect(pos)}
                  disabled={occ}
                  title={occ ? `${pos} : ${occupied.get(pos).map((s) => s.idTerrain || `#${s.id}`).join(', ')}` : pos}
                  className={`${cellSize} rounded-md text-[9px] font-mono transition-all border
                    ${occ
                      ? 'bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed'
                      : sel
                      ? 'bg-primary-600 text-white border-primary-700 ring-2 ring-primary-300 scale-110 z-10'
                      : auto
                      ? 'bg-emerald-200 text-emerald-800 border-emerald-400 ring-1 ring-emerald-300'
                      : 'bg-white text-gray-400 border-gray-200 hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700'}
                  `}
                >
                  {sel ? '●' : occ ? '×' : auto ? '+' : ''}
                </button>
              );
            })}
          </div>
        ))}

        {/* Légende */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-white border border-gray-200" /> Libre
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-primary-600 border border-primary-700" /> Sélectionné
          </span>
          {autoPositions.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-200 border border-emerald-400" /> Auto-affecté ({autoPositions.length})
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-gray-300 border border-gray-400" /> Occupé
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────
export default function ContainerSelector({ missionId, value, onChange, nombre = 1, error }) {
  const { containerId, position, insertMode = 'single' } = value || {};

  const [type, setType] = useState('PLAQUE');
  const [containers, setContainers] = useState([]);
  const [containerData, setContainerData] = useState(null); // detail courant
  const [loading,   setLoading]   = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Charge les containers de la mission filtrés par type
  const refreshList = async () => {
    if (!missionId) { setContainers([]); return; }
    setLoading(true);
    try {
      const r = await api.get('/containers', { params: { missionId, type } });
      setContainers(r.data.containers || []);
    } finally { setLoading(false); }
  };

  // Charge le détail (positions occupées) quand un container est choisi
  const refreshDetail = async (cId) => {
    if (!cId) { setContainerData(null); return; }
    try {
      const r = await api.get(`/containers/${cId}`);
      setContainerData(r.data);
    } catch { setContainerData(null); }
  };

  useEffect(() => { refreshList(); /* eslint-disable-next-line */ }, [missionId, type]);
  useEffect(() => { refreshDetail(containerId); /* eslint-disable-next-line */ }, [containerId]);

  const occupiedMap = useMemo(() => {
    const m = new Map();
    if (containerData?.occupied) {
      containerData.occupied.forEach(({ position: p, items }) => m.set(p, items));
    }
    return m;
  }, [containerData]);

  // Calcul des positions auto pour le mode split (boîte + nombre>1)
  const isSplitMode = containerData?.container?.type === 'BOITE' && insertMode === 'split' && nombre > 1;
  const autoPositions = useMemo(() => {
    if (!isSplitMode || !containerData) return [];
    const all = buildPositions(containerData.container.type);
    const free = all.filter((p) => !occupiedMap.has(p));
    return free.slice(0, nombre);
  }, [isSplitMode, containerData, occupiedMap, nombre]);

  const handleSwitchType = (newType) => {
    if (newType === type) return;
    setType(newType);
    onChange({ containerId: '', position: '', insertMode: 'single' });
    setContainerData(null);
  };

  const handleSelectContainer = (e) => {
    const id = e.target.value;
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
      <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => handleSwitchType('PLAQUE')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            type === 'PLAQUE'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers size={14} /> Plaque (96 puits)
        </button>
        <button
          type="button"
          onClick={() => handleSwitchType('BOITE')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            type === 'BOITE'
              ? 'bg-white text-amber-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Box size={14} /> Boîte (81 tubes)
        </button>
      </div>

      {/* Sélecteur container + bouton créer */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-semibold text-gray-600 tracking-wide">
            {isPlaque ? 'Plaque' : 'Boîte'} de conservation
          </label>
          <select
            value={containerId || ''}
            onChange={handleSelectContainer}
            disabled={!missionId || loading}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
          >
            <option value="">— Sélectionner —</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
                {c.notes ? ` — ${c.notes.slice(0, 30)}` : ''}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={!missionId}
          title={`Nouvelle ${isPlaque ? 'plaque' : 'boîte'}`}
          className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
            isPlaque
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100'
              : 'bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Plus size={18} />
        </button>
      </div>

      {!missionId && (
        <p className="text-xs text-amber-600 flex items-center gap-1.5">
          <AlertTriangle size={12} /> Sélectionnez d'abord une mission via la cascade ci-dessus.
        </p>
      )}

      {/* Mode d'insertion (boîte + nombre>1) */}
      {containerData?.container?.type === 'BOITE' && nombre > 1 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-800 mb-2">Mode d'insertion</p>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="radio" name="insertMode" value="single"
              checked={insertMode === 'single'}
              onChange={() => onChange({ containerId, position, insertMode: 'single' })}
              className="mt-0.5"
            />
            <div className="text-xs">
              <p className="font-semibold text-gray-800">1 enregistrement ({nombre} individus dans le même tube)</p>
              <p className="text-gray-500">Vous choisissez la position du tube, les {nombre} individus partagent ce tube.</p>
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
              <p className="font-semibold text-gray-800">{nombre} enregistrements (1 individu / tube)</p>
              <p className="text-gray-500">Le système assigne automatiquement les {nombre} prochaines positions libres.</p>
            </div>
          </label>
        </div>
      )}

      {/* Plaque + nombre>1 → message */}
      {containerData?.container?.type === 'PLAQUE' && nombre > 1 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <span>Une plaque accepte 1 spécimen par puit. Le nombre sera forcé à 1 — utilisez plusieurs enregistrements pour saisir plusieurs spécimens, ou choisissez une boîte.</span>
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
