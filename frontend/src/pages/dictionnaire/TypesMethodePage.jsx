import ReferentielSimplePage from './ReferentielSimplePage';

const config = {
  endpoint:     'types-methode',
  label:        'type de méthode',
  labelPluriel: 'Méthodes de collecte',
  fields: [
    { name: 'code',        label: 'Code',        required: true, hint: 'ex: CDC-LT, BG-SENT' },
    { name: 'nom',         label: 'Nom complet', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],
  listColumns: [
    { key: 'code', header: 'Code',
      render: (i) => <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{i.code}</span> },
    { key: 'nom',         header: 'Nom' },
    { key: 'description', header: 'Description',
      render: (i) => <span className="text-gray-500 text-xs">{i.description || '—'}</span> },
    { key: 'usage',       header: 'Utilisations',
      render: (i) => i._count?.methodes ?? 0 },
  ],
};

export default function TypesMethodePage() {
  return <ReferentielSimplePage config={config} />;
}
