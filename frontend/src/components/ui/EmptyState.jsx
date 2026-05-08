// EmptyState — bloc centré pour "aucun élément" avec icône, titre, description, action.
//
// Usage :
//   <EmptyState icon={Bug} title="Aucun moustique enregistré"
//               description="Cliquez ci-dessous pour ajouter le premier"
//               action={{ label: 'Ajouter', icon: Plus, onClick: () => ... }} />

import Card from './Card';
import Button from './Button';

export default function EmptyState({
  icon: Icon, title, description, action, className = '',
}) {
  return (
    <Card padding="none" className={`p-12 text-center ${className}`}>
      {Icon && <Icon size={40} className="text-fg-subtle mx-auto mb-3" />}
      {title && <p className="text-fg-muted text-sm font-medium">{title}</p>}
      {description && (
        <p className="text-fg-subtle text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          <Button {...action}>{action.label}</Button>
        </div>
      )}
    </Card>
  );
}
