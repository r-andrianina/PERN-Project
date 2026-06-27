import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const LIMIT_OPTIONS = [25, 50, 100];

function pageNumbers(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 4)         return [1, 2, 3, 4, 5, '…', pages];
  if (page >= pages - 3) return [1, '…', pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, '…', page - 1, page, page + 1, '…', pages];
}

/**
 * Pagination — navigation entre pages.
 *
 * Props existantes (inchangées) :
 *   page, pages, total, limit, onChange
 *
 * Nouvelles props optionnelles :
 *   onLimitChange — (newLimit: number) => void
 *                   active le sélecteur de lignes par page (25/50/100)
 *
 * Raccourcis clavier : ← / → pour changer de page
 * (seulement quand le focus n'est pas dans un <input>)
 */
export default function Pagination({ page, pages, total, limit, onChange, onLimitChange }) {

  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft'  && page > 1)     onChange(page - 1);
      if (e.key === 'ArrowRight' && page < pages)  onChange(page + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [page, pages, onChange]);

  if (!pages || (pages <= 1 && !onLimitChange)) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  const btnBase     = 'h-7 min-w-[28px] px-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center';
  const btnActive   = 'bg-primary text-fg-on-primary';
  const btnIdle     = 'text-fg-muted hover:bg-surface-2 hover:text-fg';
  const btnDisabled = 'text-fg-subtle opacity-40 cursor-not-allowed';

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-2/40 select-none gap-2 flex-wrap">

      {/* Gauche : compteur + sélecteur de limite */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-fg-subtle">
          {from}–{to} sur <span className="font-medium text-fg">{total}</span>
        </span>

        {onLimitChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-fg-subtle hidden sm:inline">par page :</span>
            <select
              value={limit}
              onChange={(e) => {
                onLimitChange(Number(e.target.value));
                onChange(1);
              }}
              className="text-xs border border-border-strong rounded-lg pl-2 pr-6 py-0.5 bg-surface text-fg-muted focus:outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 4px center',
                appearance: 'none',
              }}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Droite : numéros de page */}
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange(page - 1)}
            disabled={page === 1}
            aria-label="Page précédente"
            className={`${btnBase} ${page === 1 ? btnDisabled : btnIdle}`}
          >
            <ChevronLeft size={13} />
          </button>

          {pageNumbers(page, pages).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="text-xs text-fg-subtle px-1">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p)}
                className={`${btnBase} ${p === page ? btnActive : btnIdle}`}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => onChange(page + 1)}
            disabled={page === pages}
            aria-label="Page suivante"
            className={`${btnBase} ${page === pages ? btnDisabled : btnIdle}`}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}

    </div>
  );
}
