import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Fil d'Ariane générique.
 *
 * items: Array<{ label: string, to?: string }>
 *   - Si `to` est absent ou si c'est le dernier élément → texte non-cliquable
 *   - Le dernier élément représente la page courante
 */
export default function Breadcrumb({ items = [] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 flex-wrap">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="flex items-center gap-1 min-w-0">
            {idx > 0 && (
              <ChevronRight size={12} className="text-fg-subtle/50 flex-shrink-0" />
            )}
            {isLast || !item.to ? (
              <span
                className={`text-xs truncate max-w-[200px] ${
                  isLast ? 'text-fg font-medium' : 'text-fg-subtle'
                }`}
              >
                {item.label}
              </span>
            ) : (
              <Link
                to={item.to}
                className="text-xs text-fg-subtle hover:text-primary transition-colors truncate max-w-[150px]"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
