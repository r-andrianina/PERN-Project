import { AlertCircle } from 'lucide-react';

export default function FormField({
  label, name, type = 'text', value, onChange, onBlur,
  placeholder, required, options, error, hint, disabled,
}) {
  const baseClass = `
    w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors
    focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400
    disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
    ${error
      ? 'border-red-300 bg-red-50 focus:ring-red-200 focus:border-red-400'
      : 'border-gray-200 bg-white hover:border-gray-300'
    }
  `;

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-gray-600 tracking-wide">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      {type === 'select' ? (
        <select
          name={name} value={value} onChange={onChange}
          required={required} disabled={disabled}
          className={baseClass}
        >
          <option value="">— Sélectionner —</option>
          {options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

      ) : type === 'textarea' ? (
        <textarea
          name={name} value={value} onChange={onChange}
          placeholder={placeholder} required={required} disabled={disabled}
          rows={3}
          className={`${baseClass} resize-none`}
        />

      ) : (
        <input
          type={type} name={name} value={value} onChange={onChange} onBlur={onBlur}
          placeholder={placeholder} required={required} disabled={disabled}
          className={baseClass}
        />
      )}

      {hint && !error && (
        <p className="text-xs text-gray-400">{hint}</p>
      )}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
}
