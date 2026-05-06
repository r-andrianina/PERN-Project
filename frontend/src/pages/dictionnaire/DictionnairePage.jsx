// Hub d'accès aux 5 référentiels du Dictionnaire de données + journal d'audit.
import { Link } from 'react-router-dom';
import {
  BookOpen, Bug, Rabbit, FlaskConical, Map, Trees, Beaker, History, ChevronRight,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

const CARDS = [
  { path: '/dictionnaire/taxonomie-specimens',    label: 'Taxonomie spécimens',    desc: 'Hiérarchie ordre → … → sous-espèce',  Icon: Bug,         color: 'text-emerald-600 bg-emerald-50' },
  { path: '/dictionnaire/taxonomie-hotes',        label: 'Taxonomie hôtes',        desc: 'Animaux hôtes (rongeurs, bovidés…)',  Icon: Rabbit,      color: 'text-rose-600 bg-rose-50' },
  { path: '/dictionnaire/types-methode',          label: 'Méthodes de collecte',   desc: 'CDC-LT, BG-Sentinel, HLC, etc.',      Icon: Beaker,      color: 'text-blue-600 bg-blue-50' },
  { path: '/dictionnaire/solutions-conservation', label: 'Solutions de conservation', desc: 'Ethanol, RNAlater, azote liquide…',Icon: FlaskConical,color: 'text-amber-600 bg-amber-50' },
  { path: '/dictionnaire/types-environnement',    label: 'Types d\'environnement', desc: 'Urbain, rural, forêt, mangrove…',     Icon: Map,         color: 'text-indigo-600 bg-indigo-50' },
  { path: '/dictionnaire/types-habitat',          label: 'Types d\'habitat',       desc: 'Intra/péri/extra-domiciliaire…',      Icon: Trees,       color: 'text-teal-600 bg-teal-50' },
];

export default function DictionnairePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <BookOpen size={20} className="text-primary-600" /> Dictionnaire de données
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Référentiels normalisés — toute valeur scientifique passe ici.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {CARDS.map(({ path, label, desc, Icon, color }) => (
          <Link key={path} to={path} className="card p-5 hover:shadow-card-md transition-shadow group">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 group-hover:text-primary-700">{label}</p>
                <p className="text-xs text-gray-400 mt-1">{desc}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400" />
            </div>
          </Link>
        ))}

        {isAdmin && (
          <Link to="/dictionnaire/audit-logs" className="card p-5 hover:shadow-card-md transition-shadow group border-dashed border-gray-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-600">
                <History size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 group-hover:text-primary-700">Journal d'audit</p>
                <p className="text-xs text-gray-400 mt-1">Historisation des modifications (admin)</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400" />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
