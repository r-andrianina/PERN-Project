export const GORGEMENT_LABELS = {
  N: 'Non gorgé', G: 'Gorgé', Gr: 'Gravide', SGr: 'Semi-gravide', NC: 'Non collecté',
};

export const GORGEMENT_OPTIONS = Object.entries(GORGEMENT_LABELS)
  .map(([value, label]) => ({ value, label }));

export function formatGorgement(code) {
  return GORGEMENT_LABELS[code] ?? code ?? '—';
}
