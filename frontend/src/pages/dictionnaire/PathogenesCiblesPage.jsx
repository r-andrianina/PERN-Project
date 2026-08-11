import { Badge } from '../../components/ui';
import ReferentielSimplePage from './ReferentielSimplePage';
import { useT } from '../../lib/i18n';

const TYPE_ORG_TONE = { parasite: 'danger', virus: 'warning', bacterie: 'info', champignon: 'default', marqueur: 'default' };

const getConfig = (t) => {
  const typeAnLabel = { adn: t('referentielConfig.typeAnAdn'), arn: t('referentielConfig.typeAnArn'), adn_arn: t('referentielConfig.typeAnAdnArn') };
  return {
    endpoint:     'pathogenes-cibles',
    label:        t('referentielConfig.pathogeneLabel'),
    labelPluriel: t('referentielConfig.pathogeneLabelPluriel'),
    fields: [
      { name: 'code',        label: t('referentielConfig.codeUnique'),      required: true },
      { name: 'nom',         label: t('referentielConfig.nomScientifique'), required: true },
      { name: 'famille',     label: t('referentielConfig.famille'),         required: false },
      { name: 'typeOrg',     label: t('referentielConfig.typeOrganisme'),   required: false },
      { name: 'typeAN',      label: t('referentielConfig.typeAcideNucleique'), required: false },
      { name: 'description', label: t('common.description'),               type: 'textarea' },
    ],
    listColumns: [
      { key: 'code', header: t('referentielConfig.code'),
        render: (i) => <span className="font-mono text-xs text-fg-muted">{i.code}</span> },
      { key: 'nom', header: t('referentielConfig.nomScientifique'),
        render: (i) => <em className="text-sm text-fg">{i.nom}</em> },
      { key: 'famille', header: t('referentielConfig.famille'),
        render: (i) => <span className="text-xs text-fg-subtle">{i.famille || '—'}</span> },
      { key: 'typeOrg', header: t('referentielConfig.typeCol'),
        render: (i) => i.typeOrg
          ? <Badge tone={TYPE_ORG_TONE[i.typeOrg] || 'default'} size="sm">{i.typeOrg}</Badge>
          : '—' },
      { key: 'typeAN', header: t('referentielConfig.acNucleiqueCol'),
        render: (i) => <span className="text-xs">{typeAnLabel[i.typeAN] || '—'}</span> },
    ],
  };
};

export default function PathogenesCiblesPage() {
  const t = useT();
  return <ReferentielSimplePage config={getConfig(t)} />;
}
