// Card — surface élevée standard. Compose avec sa Header / Body / Footer optionnels.
//
// Usage :
//   <Card>...</Card>
//   <Card padding="sm" tone="muted">...</Card>
//
// Props :
//   padding : 'none' | 'sm' | 'md' | 'lg'  — par défaut 'md' (p-6)
//   tone    : 'default' | 'muted' | 'primary' — fond légèrement teinté
//   className : extension libre

const PAD = { none: 'p-0', sm: 'p-4', md: 'p-6', lg: 'p-8' };

const TONE = {
  default: '',
  muted:   'bg-surface-2',
  primary: 'bg-primary/5 border-primary/10',
};

export default function Card({ children, padding = 'md', tone = 'default', className = '', ...rest }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface shadow-card transition-colors ${PAD[padding]} ${TONE[tone]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`pb-4 mb-5 border-b border-border ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, icon: Icon, className = '' }) {
  return (
    <h2 className={`flex items-center gap-2.5 text-sm font-semibold text-fg ${className}`}>
      {Icon && <Icon size={17} className="text-primary" />}
      {children}
    </h2>
  );
}
