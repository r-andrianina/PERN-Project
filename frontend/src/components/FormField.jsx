import { AlertCircle } from 'lucide-react';
import { Select } from './ui';

export default function FormField({
  label, name, type = 'text', value, onChange, onBlur,
  placeholder, required, options, error, hint, disabled,
}) {
  const baseClass = `
    w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors
    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
    disabled:bg-surface-2 disabled:text-fg-subtle disabled:cursor-not-allowed
    bg-surface text-fg
    ${error
      ? 'border-danger/50 bg-danger/5 focus:ring-danger/20 focus:border-danger'
      : 'border-border-strong hover:border-border-strong'
    }
  `;

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-fg-muted tracking-wide">
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}

      {type === 'select' ? (
        <Select
          name={name}
          value={value}
          onChange={(val) => onChange({ target: { name, value: val } })}
          disabled={disabled}
          error={error}
          options={[{ value: '', label: '— Sélectionner —' }, ...(options ?? [])]}
        />

      ) : type === 'textarea' ? (
        <textarea name={name} value={value} onChange={onChange}
          placeholder={placeholder} required={required} disabled={disabled} rows={3}
          className={`${baseClass} resize-none`} />

      ) : (
        <input
          type={type} name={name} value={value} onChange={onChange} onBlur={onBlur}
          placeholder={placeholder} required={required} disabled={disabled}
          className={baseClass}
        />
      )}

      {hint && !error && <p className="text-xs text-fg-subtle">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-danger">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
}
