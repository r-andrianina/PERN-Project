import ReferentielSimplePage from './ReferentielSimplePage';

const config = {
  endpoint:     'types-habitat',
  label:        'type d\'habitat',
  labelPluriel: 'Types d\'habitat',
  fields: [
    { name: 'nom',         label: 'Nom',         required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],
  listColumns: [
    { key: 'nom',         header: 'Nom' },
    { key: 'description', header: 'Description',
      render: (i) => <span className="text-gray-500 text-xs">{i.description || '—'}</span> },
    { key: 'usage', header: 'Utilisations',
      render: (i) => i._count?.methodes ?? 0 },
  ],
};

export default function TypesHabitatPage() {
  return <ReferentielSimplePage config={config} />;
}
