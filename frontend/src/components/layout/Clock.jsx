import { useState, useEffect, memo } from 'react';

const Clock = memo(function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <span className="hidden sm:block text-xs text-fg-subtle capitalize">
        {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
      <span className="hidden md:block text-xs font-mono text-fg-muted tabular-nums">
        {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </>
  );
});

export default Clock;
