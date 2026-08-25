export const TRANCHE_HORAIRE_LABELS = {
  h18_19: '18h–19h', h19_20: '19h–20h', h20_21: '20h–21h', h21_22: '21h–22h',
  h22_23: '22h–23h', h23_00: '23h–00h', h00_01: '00h–01h', h01_02: '01h–02h',
  h02_03: '02h–03h', h03_04: '03h–04h', h04_05: '04h–05h', h05_06: '05h–06h',
};

export const TRANCHE_HORAIRE_OPTIONS = Object.entries(TRANCHE_HORAIRE_LABELS)
  .map(([value, label]) => ({ value, label }));

export function formatTrancheHoraire(code) {
  return TRANCHE_HORAIRE_LABELS[code] ?? code ?? '—';
}
