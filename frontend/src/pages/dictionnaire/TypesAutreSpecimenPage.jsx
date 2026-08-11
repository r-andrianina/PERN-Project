import ReferentielSimplePage from './ReferentielSimplePage';
import { useT } from '../../lib/i18n';

const getConfig = (t) => ({
  endpoint:     'types-autre-specimen',
  label:        t('referentielConfig.typeAutreSpecimenLabel'),
  labelPluriel: t('referentielConfig.typeAutreSpecimenLabelPluriel'),
  fields: [
    { name: 'code',        label: t('referentielConfig.code'),       required: true, hint: t('referentielConfig.codeAutreSpecimenHint') },
    { name: 'nom',         label: t('referentielConfig.nomComplet'), required: true },
    { name: 'description', label: t('common.description'), type: 'textarea' },
  ],
  listColumns: [
    { key: 'code', header: t('referentielConfig.code'),
      render: (i) => <span className="font-mono text-xs bg-gray-100 dark:bg-surface-3 px-2 py-0.5 rounded">{i.code}</span> },
    { key: 'nom',         header: t('common.name') },
    { key: 'description', header: t('common.description'),
      render: (i) => <span className="text-gray-500 text-xs">{i.description || '—'}</span> },
    { key: 'usage', header: t('referentielConfig.specimens'),
      render: (i) => i._count?.specimens ?? 0 },
  ],
});

export default function TypesAutreSpecimenPage() {
  const t = useT();
  return <ReferentielSimplePage config={getConfig(t)} />;
}
