export const STADE_LABELS = { E: 'Œuf', L: 'Larve', N: 'Nymphe', A: 'Adulte' };

export const STADE_OPTIONS_MOUSTIQUE = [
  { value: 'A', label: 'Adulte' },
  { value: 'N', label: 'Nymphe' },
  { value: 'L', label: 'Larve' },
  { value: 'E', label: 'Œuf' },
];

export const STADE_OPTIONS_TIQUE = [
  { value: 'A', label: 'Adulte' },
  { value: 'N', label: 'Nymphe' },
  { value: 'L', label: 'Larve' },
];

export const STADE_OPTIONS_PUCE = STADE_OPTIONS_MOUSTIQUE;

export function formatStade(code) {
  return STADE_LABELS[code] ?? code ?? '—';
}
