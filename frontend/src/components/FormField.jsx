import { AlertCircle } from 'lucide-react';
import { Select, DatePicker } from './ui';
import { useT } from '../lib/i18n';

const pad2 = (n) => String(n).padStart(2, '0');
const HOURS   = Array.from({ length: 24 }, (_, i) => ({ value: pad2(i), label: pad2(i) }));
const MINUTES = Array.from({ length: 12 }, (_, i) => ({ value: pad2(i * 5), label: pad2(i * 5) }));

// Champ composite date + heure pour type="datetime-local" — calendrier
// personnalisé (DatePicker) pour la date, deux <Select> bornés 00-23 /
// 00-55 (pas de 5 min) pour l'heure. Value/onChange gardent le même format
// que l'input natif : "YYYY-MM-DDTHH:mm".
function DateTimeField({ value, onChange, name, disabled, error }) {
  const t = useT();
  const [datePart = '', timePart = ''] = (value || '').split('T');
  const [hh = '', mm = ''] = timePart.split(':');
  const todayStr = new Date().toISOString().slice(0, 10);

  const emit = (nextDate, nextHh, nextMm) => {
    const d = nextDate !== undefined ? nextDate : datePart;
    const h = nextHh   !== undefined ? nextHh   : (hh || '00');
    const m = nextMm   !== undefined ? nextMm   : (mm || '00');
    onChange({ target: { name, value: `${d || todayStr}T${h}:${m}` } });
  };

  return (
    <div className="flex gap-2">
      <DatePicker
        value={datePart}
        onChange={(d) => emit(d, undefined, undefined)}
        disabled={disabled}
        error={error}
        wrapperClassName="flex-1"
      />
      <Select
        value={hh} onChange={(h) => emit(undefined, h, undefined)}
        options={HOURS} placeholder={t('formField.hourPlaceholder')} disabled={disabled} searchable={false}
        wrapperClassName="w-[4.5rem]"
      />
      <Select
        value={mm} onChange={(m) => emit(undefined, undefined, m)}
        options={MINUTES} placeholder={t('formField.minutePlaceholder')} disabled={disabled} searchable={false}
        wrapperClassName="w-[4.5rem]"
      />
    </div>
  );
}

export default function FormField({
  label, name, type = 'text', value, onChange, onBlur,
  placeholder, required, options, error, hint, disabled,
}) {
  const t = useT();
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
          options={[{ value: '', label: `— ${t('common.select')} —` }, ...(options ?? [])]}
        />

      ) : type === 'date' ? (
        <DatePicker
          name={name}
          value={value}
          onChange={(val) => onChange({ target: { name, value: val } })}
          placeholder={placeholder}
          disabled={disabled}
          error={error}
        />

      ) : type === 'datetime-local' ? (
        <DateTimeField
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          error={error}
        />

      ) : type === 'checkbox' ? (
        <input
          type="checkbox"
          name={name}
          checked={!!value}
          onChange={(e) => onChange({ target: { name, value: e.target.checked } })}
          disabled={disabled}
          className="h-4 w-4 rounded border-border-strong text-primary-600 focus:ring-2 focus:ring-primary/30"
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
