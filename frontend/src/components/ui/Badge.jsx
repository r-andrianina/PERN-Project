// Badge — pastille colorée pour statuts, rôles, types.
//
// Usage :
//   <Badge tone="success">Actif</Badge>
//   <Badge tone="specimen-moustique" size="sm">Moustique</Badge>
//   <Badge tone="custom" className="bg-purple-100 text-purple-700">…</Badge>

const TONES = {
  // Sémantiques
  default: 'bg-surface-3 text-fg-muted border-border-strong',
  primary: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger:  'bg-danger/10 text-danger border-danger/20',
  info:    'bg-info/10 text-info border-info/20',

  // Spécimens
  'specimen-moustique': 'bg-specimen-moustique/10 text-specimen-moustique border-specimen-moustique/20',
  'specimen-tique':     'bg-specimen-tique/10 text-specimen-tique border-specimen-tique/20',
  'specimen-puce':      'bg-specimen-puce/10 text-specimen-puce border-specimen-puce/20',

  // Rôles
  'role-admin':     'bg-role-admin/10 text-role-admin border-role-admin/20',
  'role-chercheur': 'bg-role-chercheur/10 text-role-chercheur border-role-chercheur/20',
  'role-terrain':   'bg-role-terrain/10 text-role-terrain border-role-terrain/20',
  'role-lecteur':   'bg-role-lecteur/10 text-role-lecteur border-role-lecteur/20',

  // Pour cas particuliers
  custom: '',
};

const SIZES = {
  xs: 'px-1.5 py-0 text-[10px]',
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
};

export default function Badge({
  children, tone = 'default', size = 'md',
  icon: Icon, dot = false, className = '', ...rest
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${TONES[tone] ?? TONES.default} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}
