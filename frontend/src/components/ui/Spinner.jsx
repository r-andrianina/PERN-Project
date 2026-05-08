// Spinner — indicateur de chargement avec libellé optionnel.
//
// Usage :
//   <Spinner />
//   <Spinner label="Chargement..." size={20} />
//   <Spinner.Block label="Chargement des spécimens..." />  ← bloc centré pleine zone

import { Loader2 } from 'lucide-react';

function Spinner({ size = 16, label, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 text-fg-subtle text-sm ${className}`}>
      <Loader2 size={size} className="animate-spin" />
      {label}
    </span>
  );
}

Spinner.Block = function SpinnerBlock({ label = 'Chargement…', height = 'h-40' }) {
  return (
    <div className={`flex items-center justify-center ${height}`}>
      <Spinner label={label} />
    </div>
  );
};

export default Spinner;
