import ReferentielSimplePage from './ReferentielSimplePage';
import { useT } from '../../lib/i18n';

const getConfig = (t) => ({
  endpoint:     'types-habitat',
  label:        t('referentielConfig.typeHabitatLabel'),
  labelPluriel: t('referentielConfig.typeHabitatLabelPluriel'),
  fields: [
    { name: 'nom',         label: t('common.name'), required: true },
    { name: 'description', label: t('common.description'), type: 'textarea' },
  ],
  listColumns: [
    { key: 'nom',         header: t('common.name') },
    { key: 'description', header: t('common.description'),
      render: (i) => <span className="text-gray-500 text-xs">{i.description || '—'}</span> },
    { key: 'usage', header: t('referentielConfig.utilisations'),
      render: (i) => i._count?.methodes ?? 0 },
  ],
});

export default function TypesHabitatPage() {
  const t = useT();
  return <ReferentielSimplePage config={getConfig(t)} />;
}
