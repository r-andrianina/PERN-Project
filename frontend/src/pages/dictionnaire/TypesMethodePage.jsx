import ReferentielSimplePage from './ReferentielSimplePage';
import { useT } from '../../lib/i18n';

const getConfig = (t) => ({
  endpoint:     'types-methode',
  label:        t('referentielConfig.typeMethodeLabel'),
  labelPluriel: t('referentielConfig.typeMethodeLabelPluriel'),
  fields: [
    { name: 'code',        label: t('referentielConfig.code'),       required: true, hint: t('referentielConfig.codeMethodeHint') },
    { name: 'nom',         label: t('referentielConfig.nomComplet'), required: true },
    { name: 'description', label: t('common.description'), type: 'textarea' },
  ],
  listColumns: [
    { key: 'code', header: t('referentielConfig.code'),
      render: (i) => <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{i.code}</span> },
    { key: 'nom',         header: t('common.name') },
    { key: 'description', header: t('common.description'),
      render: (i) => <span className="text-gray-500 text-xs">{i.description || '—'}</span> },
    { key: 'usage',       header: t('referentielConfig.utilisations'),
      render: (i) => i._count?.methodes ?? 0 },
  ],
});

export default function TypesMethodePage() {
  const t = useT();
  return <ReferentielSimplePage config={getConfig(t)} />;
}
