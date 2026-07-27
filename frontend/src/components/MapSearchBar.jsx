import { useState, useRef, useCallback, useEffect } from 'react';
import { MapPin, X, Search, Loader2 } from 'lucide-react';

// Biais Madagascar (bounded=0 : priorise sans exclure) pour que la recherche
// remonte les lieux malgaches avant les homonymes du reste du monde.
const MADAGASCAR_VIEWBOX = '43.0,-11.8,50.6,-25.7';

// Barre de recherche de lieux (Nominatim/OpenStreetMap), partagée entre
// MapPicker (sélection de position) et CartePage (navigation sur la carte).
// onSelect(lat, lng, label) est appelé à la sélection d'un résultat —
// clic souris ou clavier (flèches + Entrée).
export default function MapSearchBar({ onSelect, placeholder = 'Rechercher un lieu, ville, fokontany…' }) {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const debounceRef = useRef(null);
  const mountedRef   = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; clearTimeout(debounceRef.current); };
  }, []);

  const handleSearch = useCallback((value) => {
    setQuery(value);
    setHighlighted(-1);
    clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); setShowResults(false); return; }

    debounceRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      setSearching(true);
      try {
        const params = new URLSearchParams({
          q: value, format: 'json', limit: '6', addressdetails: '1',
          viewbox: MADAGASCAR_VIEWBOX, bounded: '0',
        });
        const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { 'Accept-Language': 'fr' },
        });
        const data = await r.json();
        if (!mountedRef.current) return;
        setResults(data);
        setShowResults(true);
      } catch { /* silently fail */ }
      finally { if (mountedRef.current) setSearching(false); }
    }, 400);
  }, []);

  const selectResult = (item) => {
    onSelect(parseFloat(item.lat), parseFloat(item.lon), item.display_name.split(',')[0]);
    setQuery(item.display_name.split(',')[0]);
    setShowResults(false);
    setResults([]);
    setHighlighted(-1);
  };

  const handleKeyDown = (e) => {
    if (!showResults || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectResult(results[highlighted >= 0 ? highlighted : 0]);
    } else if (e.key === 'Escape') {
      setShowResults(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center bg-white/10 backdrop-blur-lg rounded-xl shadow-lg border border-white/25 px-3 py-2 gap-2">
        {searching
          ? <Loader2 size={14} className="text-primary-500 animate-spin flex-shrink-0" />
          : <Search size={14} className="text-gray-500/80 flex-shrink-0" />
        }
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          // !bg-transparent : un input[type="text"] global (index.css, pour le
          // dark mode des champs hors FormField) force un fond opaque avec une
          // spécificité CSS supérieure à bg-transparent seul — le "!" impose
          // l'important nécessaire pour que ce champ reste bien transparent.
          className="flex-1 text-sm !bg-transparent border-none outline-none text-gray-800 [text-shadow:0_1px_1px_rgba(255,255,255,0.4)] placeholder-gray-500 min-w-0"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setShowResults(false); setHighlighted(-1); }}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
          {results.map((item, i) => {
            const parts = item.display_name.split(',');
            return (
              <button
                key={i}
                type="button"
                onClick={() => selectResult(item)}
                className={`w-full text-left px-3 py-2.5 transition-colors border-b border-gray-50 last:border-0 flex items-start gap-2.5 ${i === highlighted ? 'bg-primary-50' : 'hover:bg-primary-50'}`}
              >
                <MapPin size={13} className="text-primary-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{parts[0]}</p>
                  <p className="text-xs text-gray-400 truncate">{parts.slice(1, 4).join(',')}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {showResults && results.length === 0 && !searching && query.length > 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 px-3 py-3 z-50">
          <p className="text-xs text-gray-400 text-center">Aucun résultat pour « {query} »</p>
        </div>
      )}
    </div>
  );
}
