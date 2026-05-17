// Pagination — navigation entre pages pour les listes paginées.
//
// Usage :
//   <Pagination page={page} pages={pages} total={total} limit={limit} onChange={setPage} />

import { ChevronLeft, ChevronRight } from 'lucide-react';

function pageNumbers(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 4)        return [1, 2, 3, 4, 5, '…', pages];
  if (page >= pages - 3) return [1, '…', pages-4, pages-3, pages-2, pages-1, pages];
  return [1, '…', page - 1, page, page + 1, '…', pages];
}

export default function Pagination({ page, pages, total, limit, onChange }) {
  if (!pages || pages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  const btnBase = 'h-7 min-w-[28px] px-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center';
  const btnActive = 'bg-primary text-fg-on-primary';
  const btnIdle   = 'text-fg-muted hover:bg-surface-2 hover:text-fg';
  const btnDisabled = 'text-fg-subtle cursor-not-allowed';

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-2/40 select-none">
      <span className="text-xs text-fg-subtle">
        {from}–{to} sur <span className="font-medium text-fg">{total}</span>
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
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
          className={`${btnBase} ${page === pages ? btnDisabled : btnIdle}`}
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
