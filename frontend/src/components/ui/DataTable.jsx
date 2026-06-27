import { useRef, useState, useEffect, useCallback, Fragment } from 'react';
import { ChevronUp, ChevronsUpDown } from 'lucide-react';

const DENSITY = {
  compact: { td: 'px-3 py-2',   th: 'px-3 py-2.5' },
  normal:  { td: 'px-4 py-3',   th: 'px-4 py-3'   },
};

function SortIcon({ active, dir }) {
  if (!active) {
    return (
      <ChevronsUpDown
        size={11}
        className="opacity-20 group-hover/th:opacity-60 transition-opacity duration-150"
      />
    );
  }
  return (
    <span
      className={`inline-flex text-primary transition-transform duration-200 ease-in-out ${
        dir === 'desc' ? 'rotate-180' : 'rotate-0'
      }`}
    >
      <ChevronUp size={11} />
    </span>
  );
}

function SkeletonRow({ columns, tdPad }) {
  return (
    <tr className="animate-pulse">
      {columns.map((col, i) => (
        <td
          key={col.key ?? i}
          className={[tdPad, col.hidden ?? '', col.className ?? ''].filter(Boolean).join(' ')}
        >
          <div className="h-3.5 rounded-md bg-surface-3" style={{ width: col.skeletonWidth ?? '72%' }} />
        </td>
      ))}
    </tr>
  );
}

/**
 * DataTable — table data générique.
 *
 * Props colonnes :
 *   key             — clé d'accès / identifiant
 *   label           — texte ou ReactNode dans le th
 *   sortable        — active le tri
 *   render          — (row) => ReactNode
 *   className       — classes sur le td
 *   headerClassName — classes sur le th
 *   hidden          — ex. 'hidden lg:table-cell'
 *   skeletonWidth   — ex. '60%'
 *   width           — ex. '120px'
 *
 * Props :
 *   columns, rows, keyField, loading, skeletonRows,
 *   onRowClick, rowClassName, sort, onSort,
 *   renderExpanded,   ← (row) => ReactNode | null  — ligne dépliable sous chaque row
 *   empty, density, minWidth, maxHeight, className
 */
export default function DataTable({
  columns        = [],
  rows           = [],
  keyField       = 'id',
  loading        = false,
  skeletonRows   = 7,
  onRowClick,
  rowClassName,
  sort,
  onSort,
  renderExpanded,
  empty,
  density   = 'normal',
  minWidth  = '600px',
  maxHeight = 'calc(100vh - 300px)',
  className = '',
}) {
  const scrollRef = useRef(null);
  const [shadows, setShadows] = useState({ left: false, right: false });

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShadows({
      left:  el.scrollLeft > 2,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 2,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(checkScroll);
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, rows, loading]);

  const handleSort = (col) => {
    if (!col.sortable || !onSort) return;
    const nextDir = sort?.key === col.key && sort.dir === 'asc' ? 'desc' : 'asc';
    onSort(col.key, nextDir);
  };

  const { td: tdPad, th: thPad } = DENSITY[density] ?? DENSITY.normal;

  return (
    <div className={`relative ${className}`}>

      {/* Fade bord gauche */}
      <div aria-hidden="true"
        className={`pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-20 rounded-l-2xl
          bg-gradient-to-r from-surface to-transparent transition-opacity duration-200
          ${shadows.left ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Fade bord droit */}
      <div aria-hidden="true"
        className={`pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-20 rounded-r-2xl
          bg-gradient-to-l from-surface to-transparent transition-opacity duration-200
          ${shadows.right ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Conteneur de scroll X + Y */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-auto datatable-scroll"
        style={{ maxHeight, minHeight: '180px' }}
      >
        <table className="w-full text-sm" style={{ minWidth }}>

          {/* En-tête sticky */}
          <thead className="datatable-thead sticky top-0 z-10 bg-surface-2">
            <tr>
              {columns.map((col, i) => {
                const isActive = sort?.key === col.key;
                return (
                  <th
                    key={col.key ?? i}
                    onClick={() => handleSort(col)}
                    style={col.width ? { width: col.width } : undefined}
                    className={[
                      'group/th text-left whitespace-nowrap select-none',
                      thPad,
                      'text-xs font-semibold tracking-wide transition-colors duration-150',
                      isActive ? 'text-primary bg-primary/5' : 'text-fg-muted',
                      col.hidden ?? '',
                      col.headerClassName ?? '',
                      col.sortable && onSort
                        ? 'cursor-pointer hover:bg-surface-3 hover:text-fg'
                        : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable && onSort && (
                        <SortIcon active={isActive} dir={sort?.dir} />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Corps */}
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <SkeletonRow key={i} columns={columns} tdPad={tdPad} />
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  {empty ?? <span className="text-fg-subtle text-sm">Aucun résultat</span>}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const expanded = renderExpanded?.(row) ?? null;
                return (
                  <Fragment key={row[keyField] ?? i}>
                    <tr
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={[
                        'transition-colors duration-100',
                        onRowClick ? 'cursor-pointer hover:bg-primary/5' : 'hover:bg-surface-2/60',
                        rowClassName?.(row) ?? '',
                      ].filter(Boolean).join(' ')}
                    >
                      {columns.map((col, j) => (
                        <td
                          key={col.key ?? j}
                          className={[tdPad, col.hidden ?? '', col.className ?? ''].filter(Boolean).join(' ')}
                        >
                          {col.render
                            ? col.render(row)
                            : (row[col.key] ?? <span className="text-fg-subtle">—</span>)
                          }
                        </td>
                      ))}
                    </tr>

                    {/* Ligne dépliée (ex. JSON diff, détails) */}
                    {expanded != null && (
                      <tr className="bg-surface-2/40">
                        <td colSpan={columns.length} className="px-4 py-3">
                          {expanded}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>

        </table>
      </div>
    </div>
  );
}
