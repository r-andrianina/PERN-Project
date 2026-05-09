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
};

export default function SpecimenIcon({ type, size = 20, className = '' }) {
  const src = ICONS[type];
  if (!src) return null;
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
