import { Link } from 'react-router-dom';
import { BookOpen, Bug, Rabbit, FlaskConical, Map, Trees, Beaker, History, ChevronRight, Layers, Biohazard } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { Card, PageHeader } from '../../components/ui';
import { useT } from '../../lib/i18n';

const getCards = (t) => [
  { path: '/dictionnaire/taxonomie-specimens',    label: t('dictionnairePage.cardTaxoSpecimensLabel'), desc: t('dictionnairePage.cardTaxoSpecimensDesc'), Icon: Bug,          iconCls: 'text-specimen-moustique bg-specimen-moustique/10' },
  { path: '/dictionnaire/taxonomie-hotes',        label: t('dictionnairePage.cardTaxoHotesLabel'),     desc: t('dictionnairePage.cardTaxoHotesDesc'),     Icon: Rabbit,       iconCls: 'text-specimen-tique bg-specimen-tique/10' },
  { path: '/dictionnaire/types-methode',          label: t('dictionnairePage.cardMethodesLabel'),      desc: t('dictionnairePage.cardMethodesDesc'),      Icon: Beaker,       iconCls: 'text-info bg-info/10' },
  { path: '/dictionnaire/solutions-conservation', label: t('dictionnairePage.cardSolutionsLabel'),     desc: t('dictionnairePage.cardSolutionsDesc'),     Icon: FlaskConical, iconCls: 'text-warning bg-warning/10' },
  { path: '/dictionnaire/types-environnement',    label: t('dictionnairePage.cardEnvironnementLabel'), desc: t('dictionnairePage.cardEnvironnementDesc'), Icon: Map,          iconCls: 'text-primary bg-primary/10' },
  { path: '/dictionnaire/types-habitat',           label: t('dictionnairePage.cardHabitatLabel'),      desc: t('dictionnairePage.cardHabitatDesc'),       Icon: Trees,   iconCls: 'text-success bg-success/10'  },
  { path: '/dictionnaire/types-autre-specimen',   label: t('dictionnairePage.cardAutreSpecimenLabel'), desc: t('dictionnairePage.cardAutreSpecimenDesc'), Icon: Layers,    iconCls: 'text-specimen-puce bg-specimen-puce/10' },
  { path: '/dictionnaire/pathogenes-cibles',       label: t('dictionnairePage.cardPathogenesLabel'),   desc: t('dictionnairePage.cardPathogenesDesc'),    Icon: Biohazard, iconCls: 'text-danger bg-danger/10'             },
];

export default function DictionnairePage() {
  const t = useT();
  const { user } = useAuthStore();
  const cards = getCards(t);

  return (
    <div className="max-w-screen-2xl space-y-6">
      <PageHeader
        icon={BookOpen} iconTone="primary"
        title={t('dictionnairePage.title')}
        subtitle={t('dictionnairePage.subtitle')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(({ path, label, desc, Icon, iconCls }) => (
          <Link key={path} to={path} className="block group">
            <Card padding="sm" className="hover:shadow-card-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconCls}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fg group-hover:text-primary">{label}</p>
                  <p className="text-xs text-fg-subtle mt-1">{desc}</p>
                </div>
                <ChevronRight size={16} className="text-fg-subtle group-hover:text-primary transition-colors" />
              </div>
            </Card>
          </Link>
        ))}

        {user?.role === 'admin' && (
          <Link to="/dictionnaire/audit-logs" className="block group">
            <Card padding="sm" className="hover:shadow-card-md transition-shadow border-dashed">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-surface-3 text-fg-muted">
                  <History size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fg group-hover:text-primary">{t('dictionnairePage.auditLogTitle')}</p>
                  <p className="text-xs text-fg-subtle mt-1">{t('dictionnairePage.auditLogDesc')}</p>
                </div>
                <ChevronRight size={16} className="text-fg-subtle group-hover:text-primary transition-colors" />
              </div>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
