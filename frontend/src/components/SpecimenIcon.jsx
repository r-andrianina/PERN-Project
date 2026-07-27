// Icône personnalisée pour les types de spécimens.
// Utilise les PNGs dans /public/icons/ (512×512 RGBA).
//
// Usage :
//   <SpecimenIcon type="moustique" size={24} />
//   <SpecimenIcon type="tique"     size={20} className="opacity-90" />

const ICONS = {
  moustique: '/icons/mosquito.png',
  tique:     '/icons/tick.png',
  puce:      '/icons/flea.png',
};

const LABELS = {
  moustique: 'Moustique',
  tique:     'Tique',
  puce:      'Puce',
  autre:     'Autre spécimen',
};

// Icône SVG générique pour les types sans image PNG
function BugIcon({ size, className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`flex-shrink-0 text-fg-muted ${className}`}>
      <path d="M8 2l1.5 1.5"/><path d="M14.5 3.5 16 2"/><path d="M9 9h6"/><path d="M9 15h6"/>
      <path d="M5 8l2 2"/><path d="M17 8l-2 2"/><path d="M5 16l2-2"/><path d="M17 16l-2-2"/>
      <rect x="8" y="6" width="8" height="14" rx="4"/>
    </svg>
  );
}

export default function SpecimenIcon({ type, size = 20, className = '' }) {
  const src = ICONS[type];
  if (src) {
    return (
      <img
        src={src}
        alt={LABELS[type] ?? type}
        width={size}
        height={size}
        className={`object-contain flex-shrink-0 ${className}`}
        draggable={false}
      />
    );
  }
  if (type === 'autre') return <BugIcon size={size} className={className} />;
  return null;
}
