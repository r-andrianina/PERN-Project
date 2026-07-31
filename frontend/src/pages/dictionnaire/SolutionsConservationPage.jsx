import ReferentielSimplePage from './ReferentielSimplePage';
import { useT } from '../../lib/i18n';

const getConfig = (t) => ({
  endpoint:     'solutions-conservation',
  label:        t('referentielConfig.solutionLabel'),
  labelPluriel: t('referentielConfig.solutionLabelPluriel'),
  fields: [
    { name: 'nom',         label: t('common.name'), required: true },
    { name: 'temperature', label: t('referentielConfig.temperature'), placeholder: t('referentielConfig.temperaturePlaceholder') },
    { name: 'description', label: t('common.description'), type: 'textarea' },
  ],
  listColumns: [
    { key: 'nom',         header: t('common.name') },
    { key: 'temperature', header: t('referentielConfig.temperature'),
      render: (i) => i.temperature ? <span className="badge bg-blue-50 text-blue-700 border border-blue-100">{i.temperature}</span> : '—' },
    { key: 'description', header: t('common.description'),
      render: (i) => <span className="text-gray-500 text-xs">{i.description || '—'}</span> },
    { key: 'usage', header: t('referentielConfig.utilisations'),
      render: (i) => (i._count?.moustiques ?? 0) + (i._count?.tiques ?? 0) + (i._count?.puces ?? 0) },
  ],
});

export default function SolutionsConservationPage() {
  const t = useT();
  return <ReferentielSimplePage config={getConfig(t)} />;
}
