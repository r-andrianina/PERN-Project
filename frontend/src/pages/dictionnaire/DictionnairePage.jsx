import { Link } from 'react-router-dom';
import { BookOpen, Bug, Rabbit, FlaskConical, Map, Trees, Beaker, History, ChevronRight } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { Card, PageHeader } from '../../components/ui';

const CARDS = [
  { path: '/dictionnaire/taxonomie-specimens',    label: 'Taxonomie spécimens',       desc: 'Hiérarchie ordre → … → sous-espèce',  Icon: Bug,          iconCls: 'text-specimen-moustique bg-specimen-moustique/10' },
  { path: '/dictionnaire/taxonomie-hotes',        label: 'Taxonomie hôtes',           desc: 'Animaux hôtes (rongeurs, bovidés…)',   Icon: Rabbit,       iconCls: 'text-specimen-tique bg-specimen-tique/10' },
  { path: '/dictionnaire/types-methode',          label: 'Méthodes de collecte',      desc: 'CDC-LT, BG-Sentinel, HLC, etc.',       Icon: Beaker,       iconCls: 'text-info bg-info/10' },
  { path: '/dictionnaire/solutions-conservation', label: 'Solutions de conservation', desc: 'Ethanol, RNAlater, azote liquide…',    Icon: FlaskConical, iconCls: 'text-warning bg-warning/10' },
  { path: '/dictionnaire/types-environnement',    label: 'Types d\'environnement',    desc: 'Urbain, rural, forêt, mangrove…',      Icon: Map,          iconCls: 'text-primary bg-primary/10' },
  { path: '/dictionnaire/types-habitat',          label: 'Types d\'habitat',          desc: 'Intra/péri/extra-domiciliaire…',        Icon: Trees,        iconCls: 'text-success bg-success/10' },
];

export default function DictionnairePage() {
  const { user } = useAuthStore();

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        icon={BookOpen} iconTone="primary"
        title="Dictionnaire de données"
        subtitle="Référentiels normalisés — toute valeur scientifique passe ici."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {CARDS.map(({ path, label, desc, Icon, iconCls }) => (
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
                  <p className="text-sm font-semibold text-fg group-hover:text-primary">Journal d'audit</p>
                  <p className="text-xs text-fg-subtle mt-1">Historisation des modifications (admin)</p>
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
