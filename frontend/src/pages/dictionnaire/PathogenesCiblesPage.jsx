import { Badge } from '../../components/ui';
import ReferentielSimplePage from './ReferentielSimplePage';

const TYPE_ORG_TONE = { parasite: 'danger', virus: 'warning', bacterie: 'info', champignon: 'default', marqueur: 'default' };
const TYPE_AN_LABEL = { adn: 'ADN', arn: 'ARN', adn_arn: 'ADN+ARN' };

const config = {
  endpoint:     'pathogenes-cibles',
  label:        'pathogène cible',
  labelPluriel: 'Pathogènes cibles',
  fields: [
    { name: 'code',        label: 'Code unique',         required: true },
    { name: 'nom',         label: 'Nom scientifique',    required: true },
    { name: 'famille',     label: 'Famille',             required: false },
    { name: 'typeOrg',     label: 'Type d\'organisme',   required: false },
    { name: 'typeAN',      label: 'Type acide nucléique', required: false },
    { name: 'description', label: 'Description',         type: 'textarea' },
  ],
  listColumns: [
    { key: 'code', header: 'Code',
      render: (i) => <span className="font-mono text-xs text-fg-muted">{i.code}</span> },
    { key: 'nom', header: 'Nom scientifique',
      render: (i) => <em className="text-sm text-fg">{i.nom}</em> },
    { key: 'famille', header: 'Famille',
      render: (i) => <span className="text-xs text-fg-subtle">{i.famille || '—'}</span> },
    { key: 'typeOrg', header: 'Type',
      render: (i) => i.typeOrg
        ? <Badge tone={TYPE_ORG_TONE[i.typeOrg] || 'default'} size="sm">{i.typeOrg}</Badge>
        : '—' },
    { key: 'typeAN', header: 'Ac. nucléique',
      render: (i) => <span className="text-xs">{TYPE_AN_LABEL[i.typeAN] || '—'}</span> },
  ],
};

export default function PathogenesCiblesPage() {
  return <ReferentielSimplePage config={config} />;
}
