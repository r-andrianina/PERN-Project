import { X } from 'lucide-react';

const ROWS    = ['A','B','C','D','E','F','G','H','I'];
const COLUMNS = [1,2,3,4,5,6,7,8,9];

export default function BoiteTubes({ value, onChange }) {
  const handleSelect = (pos) => onChange(pos === value ? '' : pos);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-600 tracking-wide">
            Boîte 81 tubes (9×9) — position
          </p>
          {value && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg font-mono text-xs font-semibold border border-amber-200">
              {value}
            </span>
          )}
        </div>
        {value && (
          <button
            type="button" onClick={() => onChange('')}
            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
          >
            <X size={11} /> Effacer
          </button>
        )}
      </div>

      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 inline-block">
        {/* En-têtes colonnes */}
        <div className="flex gap-2 mb-2 ml-8">
          {COLUMNS.map(col => (
            <div key={col} className="w-8 h-5 flex items-center justify-center text-xs text-gray-400 font-medium">
              {col}
            </div>
          ))}
        </div>

        {/* Lignes */}
        {ROWS.map(row => (
          <div key={row} className="flex gap-2 mb-2 items-center">
            <div className="w-7 text-xs text-gray-400 font-semibold text-center">{row}</div>
            {COLUMNS.map(col => {
              const pos        = `${row}${col}`;
              const isSelected = pos === value;
              return (
                <button
                  key={pos} type="button"
                  onClick={() => handleSelect(pos)}
                  title={pos}
                  className={`w-8 h-8 rounded-xl border-2 transition-all text-xs font-semibold
                    ${isSelected
                      ? 'bg-amber-500 border-amber-500 text-white scale-110 shadow-md'
                      : 'bg-white border-gray-300 hover:border-amber-400 hover:bg-amber-50'
                    }`}
                >
                  {isSelected ? pos.slice(-1) : ''}
                </button>
              );
            })}
          </div>
        ))}

        {/* Légende */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-lg bg-white border-2 border-gray-300" />
            <span className="text-xs text-gray-400">Vide</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-lg bg-amber-500 border-2 border-amber-500" />
            <span className="text-xs text-gray-400">Sélectionné</span>
          </div>
        </div>
      </div>
    </div>
  );
}
