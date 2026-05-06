// Journal d'audit (admin) — historisation générique des référentiels.

import { useEffect, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Loader2, ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../api/axios';

const ACTION_COLOR = {
  CREATE:     'bg-emerald-50 text-emerald-700 border-emerald-100',
  UPDATE:     'bg-blue-50 text-blue-700 border-blue-100',
  DELETE:     'bg-red-50 text-red-700 border-red-100',
  ACTIVATE:   'bg-teal-50 text-teal-700 border-teal-100',
  DEACTIVATE: 'bg-gray-100 text-gray-600 border-gray-200',
};

const ENTITIES = [
  '', 'TaxonomieSpecimen', 'TaxonomieHote',
  'TypeMethodeCollecte', 'SolutionConservation',
  'TypeEnvironnement', 'TypeHabitat',
];

export default function AuditLogsPage() {
  const navigate = useNavigate();
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFE] = useState('');
  const [filterAction, setFA] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (filterEntity) params.entity = filterEntity;
      if (filterAction) params.action = filterAction;
      const r = await api.get('/dictionnaire/audit-logs', { params });
      setItems(r.data.items);
      setTotal(r.data.total);
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [filterEntity, filterAction]);

  return (
    <div className="max-w-6xl space-y-5">
      <button onClick={() => navigate('/dictionnaire')} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700">
        <ChevronLeft size={16} /> Dictionnaire
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <History size={20} className="text-gray-600" /> Journal d'audit
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">{total} entrée(s) — historisation des référentiels</p>
      </div>

      <div className="card p-3 flex flex-wrap gap-2">
        <select value={filterEntity} onChange={(e) => setFE(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl border border-gray-200">
          {ENTITIES.map((e) => (
            <option key={e} value={e}>{e || 'Toutes les entités'}</option>
          ))}
        </select>
        <select value={filterAction} onChange={(e) => setFA(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl border border-gray-200">
          <option value="">Toutes les actions</option>
          {Object.keys(ACTION_COLOR).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          <Loader2 size={18} className="animate-spin mr-2" /> Chargement…
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center text-gray-400 text-sm">Aucune entrée</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="w-8"></th>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">Action</th>
                <th className="px-3 py-2 text-left font-semibold">Entité</th>
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Utilisateur</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <Fragment key={it.id}>
                  <tr className="border-t border-gray-100 hover:bg-gray-50/50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === it.id ? null : it.id)}>
                    <td className="pl-3 text-gray-400">
                      {expandedId === it.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                      {new Date(it.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`badge text-[10px] border ${ACTION_COLOR[it.action]}`}>{it.action}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-700 font-medium">{it.entity}</td>
                    <td className="px-3 py-2 text-gray-500 font-mono text-xs">#{it.entityId}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">
                      {it.user ? `${it.user.prenom} ${it.user.nom}` : '—'}
                    </td>
                  </tr>
                  {expandedId === it.id && (
                    <tr className="bg-gray-50/50">
                      <td></td>
                      <td colSpan={5} className="px-3 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="font-semibold text-gray-500 mb-1">Avant</p>
                            <pre className="bg-white p-2 rounded-lg border border-gray-200 overflow-auto text-[11px]">
                              {it.oldValues ? JSON.stringify(it.oldValues, null, 2) : '—'}
                            </pre>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-500 mb-1">Après</p>
                            <pre className="bg-white p-2 rounded-lg border border-gray-200 overflow-auto text-[11px]">
                              {it.newValues ? JSON.stringify(it.newValues, null, 2) : '—'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
