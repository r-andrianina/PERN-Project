// frontend/src/lib/dialog.js
// Service global de confirmation — usage identique à toast :
//   const ok = await dialog.confirm({ title: '…', message: '…', variant: 'danger' });
//   if (!ok) return;

const subscribers = new Set();

export const dialogEmitter = {
  subscribe: (fn) => {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
  emit: (payload) => subscribers.forEach((fn) => fn(payload)),
};

export const dialog = {
  confirm: ({
    title         = 'Confirmer ?',
    message       = null,
    confirmLabel  = null,
    cancelLabel   = 'Annuler',
    variant       = 'danger',
  } = {}) =>
    new Promise((resolve) => {
      dialogEmitter.emit({ title, message, confirmLabel, cancelLabel, variant, resolve });
    }),
};
