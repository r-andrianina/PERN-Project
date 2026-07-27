import ReferentielSimplePage from './ReferentielSimplePage';

const config = {
  endpoint:     'types-autre-specimen',
  label:        'type de spécimen',
  labelPluriel: 'Types d\'autres spécimens',
  fields: [
    { name: 'code',        label: 'Code',        required: true, hint: 'ex: PHLEBOTOME, CULICOIDES' },
    { name: 'nom',         label: 'Nom complet', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],
  listColumns: [
    { key: 'code', header: 'Code',
      render: (i) => <span className="font-mono text-xs bg-gray-100 dark:bg-surface-3 px-2 py-0.5 rounded">{i.code}</span> },
    { key: 'nom',         header: 'Nom' },
    { key: 'description', header: 'Description',
      render: (i) => <span className="text-gray-500 text-xs">{i.description || '—'}</span> },
    { key: 'usage', header: 'Spécimens',
      render: (i) => i._count?.specimens ?? 0 },
  ],
};

export default function TypesAutreSpecimenPage() {
  return <ReferentielSimplePage config={config} />;
}
