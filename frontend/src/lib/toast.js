// frontend/src/lib/toast.js
// Émetteur de toasts utilisable n'importe où (composants React, intercepteurs Axios, etc.)
// Pattern publish/subscribe — le ToastProvider est le seul abonné.

const subscribers = new Set();

function emit(payload) {
  subscribers.forEach((fn) => fn(payload));
}

export const toastEmitter = {
  subscribe:   (fn) => { subscribers.add(fn); return () => subscribers.delete(fn); },
};

function createToast(type, message, options = {}) {
  emit({
    id:       `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    message,
    title:    options.title   ?? null,
    duration: options.duration ?? (type === 'error' ? 6000 : 4000),
  });
}

export const toast = {
  success: (message, options) => createToast('success', message, options),
  error:   (message, options) => createToast('error',   message, options),
  warning: (message, options) => createToast('warning', message, options),
  info:    (message, options) => createToast('info',    message, options),
};
