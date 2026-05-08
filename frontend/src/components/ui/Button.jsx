// Button — variants harmonisés. Compose icônes + label + état loading.
//
// Variants : 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
// Sizes    : 'sm' | 'md' | 'lg'
//
// Usage :
//   <Button onClick={...}>Enregistrer</Button>
//   <Button variant="secondary" icon={Download}>Export</Button>
//   <Button loading>Enregistrement...</Button>

import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:   'bg-primary text-fg-on-primary hover:brightness-110',
  secondary: 'bg-surface text-fg-muted border border-border-strong hover:bg-surface-2 hover:text-fg',
  ghost:    'text-fg-muted hover:bg-surface-2 hover:text-fg',
  danger:   'bg-danger text-fg-on-primary hover:brightness-110',
  outline:  'border border-primary text-primary hover:bg-primary/5',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'px-5 py-3 text-base gap-2 rounded-xl',
};

const ICON_SIZES = { sm: 13, md: 15, lg: 17 };

export default function Button({
  children, variant = 'primary', size = 'md',
  icon: Icon, iconRight: IconRight, loading = false, disabled,
  type = 'button', className = '', ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading
        ? <Loader2 size={ICON_SIZES[size]} className="animate-spin" />
        : Icon && <Icon size={ICON_SIZES[size]} />
      }
      {children}
      {IconRight && !loading && <IconRight size={ICON_SIZES[size]} />}
    </button>
  );
}
