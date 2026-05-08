// StatCard — carte statistique avec icône + libellé + valeur + sous-texte optionnel.
//
// Usage :
//   <StatCard label="Total spécimens" value={42} icon={Bug} />
//   <StatCard label="Actifs" value={stats.actifs} icon={UserCheck} tone="success" trend="+3" />
//
// Tones disponibles : default, primary, success, warning, danger, info

import Card from './Card';

const TONES = {
  default: { bg: 'bg-surface-3',     icon: 'text-fg-muted',    valueColor: 'text-fg' },
  primary: { bg: 'bg-primary/10',    icon: 'text-primary',     valueColor: 'text-primary' },
  success: { bg: 'bg-success/10',    icon: 'text-success',     valueColor: 'text-success' },
  warning: { bg: 'bg-warning/10',    icon: 'text-warning',     valueColor: 'text-warning' },
  danger:  { bg: 'bg-danger/10',     icon: 'text-danger',      valueColor: 'text-danger' },
  info:    { bg: 'bg-info/10',       icon: 'text-info',        valueColor: 'text-info' },
};

export default function StatCard({
  label, value, hint, icon: Icon, tone = 'default', trend, onClick, className = '',
}) {
  const t = TONES[tone] ?? TONES.default;
  const interactive = !!onClick;

  return (
    <Card
      padding="none"
      onClick={onClick}
      className={`p-4 flex items-start gap-3 ${interactive ? 'cursor-pointer hover:shadow-card-md' : ''} ${className}`}
    >
      {Icon && (
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${t.bg}`}>
          <Icon size={18} className={t.icon} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-fg-muted">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${t.valueColor}`}>
          {value}
          {trend && (
            <span className="ml-2 text-xs font-medium text-success">{trend}</span>
          )}
        </p>
        {hint && <p className="text-xs text-fg-subtle mt-0.5">{hint}</p>}
      </div>
    </Card>
  );
}
