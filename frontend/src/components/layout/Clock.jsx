import { useState, useEffect, memo } from 'react';
import { useT } from '../../lib/i18n';

const Clock = memo(function Clock() {
  const t = useT();
  const locale = t('common.locale');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <span className="hidden sm:block text-xs text-fg-subtle capitalize">
        {now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
      <span className="hidden md:block text-xs font-mono text-fg-muted tabular-nums">
        {now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </>
  );
});

export default Clock;
