import ReferentielSimplePage from './ReferentielSimplePage';

const config = {
  endpoint:     'solutions-conservation',
  label:        'solution',
  labelPluriel: 'Solutions de conservation',
  fields: [
    { name: 'nom',         label: 'Nom',         required: true },
    { name: 'temperature', label: 'Température', placeholder: 'ex: -20°C, Ambiante' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],
  listColumns: [
    { key: 'nom',         header: 'Nom' },
    { key: 'temperature', header: 'Température',
      render: (i) => i.temperature ? <span className="badge bg-blue-50 text-blue-700 border border-blue-100">{i.temperature}</span> : '—' },
    { key: 'description', header: 'Description',
      render: (i) => <span className="text-gray-500 text-xs">{i.description || '—'}</span> },
    { key: 'usage', header: 'Utilisations',
      render: (i) => (i._count?.moustiques ?? 0) + (i._count?.tiques ?? 0) + (i._count?.puces ?? 0) },
  ],
};

export default function SolutionsConservationPage() {
  return <ReferentielSimplePage config={config} />;
}
