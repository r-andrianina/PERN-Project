import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beaker, Plus, Search, X, MapPin } from 'lucide-react';
import { Card, Badge, Button, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { useApiQuery } from '../../hooks';

export default function MethodesPage() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { data, loading: isLoading } = useApiQuery('/methodes', { select: (r) => r.methodes ?? [] });
  const methodes = data ?? [];

  const filtered = methodes.filter((m) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return m.typeMethode?.nom?.toLowerCase().includes(s) ||
      m.typeMethode?.code?.toLowerCase().includes(s) ||
      m.localite?.nom?.toLowerCase().includes(s) ||
      m.notes?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Beaker} iconTone="info"
        title="Méthodes de collecte" subtitle={`${methodes.length} méthode(s) enregistrée(s)`}
        actions={<Button icon={Plus} onClick={() => navigate('/methodes/nouvelle')}>Nouvelle méthode</Button>}
      />

      {isLoading ? <Spinner.Block /> : methodes.length === 0 ? (
        <EmptyState icon={Beaker} title="Aucune méthode enregistrée"
          action={{ label: 'Créer la première méthode', icon: Plus, onClick: () => navigate('/methodes/nouvelle') }} />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 border border-border-strong rounded-xl px-3.5 py-2 bg-surface-2 focus-within:bg-surface focus-within:border-primary transition-all">
              <Search size={14} className="text-fg-subtle flex-shrink-0" />
              <input type="text" placeholder="Rechercher par méthode, localité ou note…"
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent border-none outline-none text-fg placeholder-fg-subtle" />
              {search && <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg-muted"><X size={14} /></button>}
            </div>
            <span className="text-xs text-fg-subtle whitespace-nowrap font-medium">{filtered.length} résultat(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[850px]">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  {['#ID', 'Méthode', 'Localité', 'Mission', 'Habitat', 'Environnement', 'Date', 'Spécimens'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-fg-muted tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((m) => {
                  const total = (m._count?.moustiques || 0) + (m._count?.tiques || 0) + (m._count?.puces || 0);
                  return (
                    <tr key={m.id} className="hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-fg-subtle">#{m.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {m.typeMethode?.code && (
                            <span className="font-mono text-xs bg-surface-3 text-fg-muted px-2 py-0.5 rounded border border-border">{m.typeMethode.code}</span>
                          )}
                          <span className="text-fg font-medium">{m.typeMethode?.nom || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-fg-muted text-xs flex items-center gap-1">
                        <MapPin size={11} className="text-fg-subtle" />{m.localite?.nom || '—'}
                      </td>
                      <td className="px-4 py-3 text-fg-subtle text-xs font-mono">{m.localite?.mission?.ordreMission || '—'}</td>
                      <td className="px-4 py-3 text-fg-muted text-xs">{m.typeHabitat?.nom || <span className="text-fg-subtle">—</span>}</td>
                      <td className="px-4 py-3 text-fg-muted text-xs">{m.typeEnvironnement?.nom || <span className="text-fg-subtle">—</span>}</td>
                      <td className="px-4 py-3 text-fg-subtle text-xs whitespace-nowrap">
                        {m.dateCollecte ? new Date(m.dateCollecte).toLocaleDateString('fr-FR') : <span className="text-fg-subtle">—</span>}
                      </td>
                      <td className="px-4 py-3"><Badge tone="success">{total}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
