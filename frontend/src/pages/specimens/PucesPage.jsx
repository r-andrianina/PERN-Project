import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bug, Plus, Download, Search, X } from 'lucide-react';
import api from '../../api/axios';
import { Card, Button, Badge, EmptyState, PageHeader, Spinner } from '../../components/ui';

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const SEXE_LABEL = { M: 'Mâle', F: 'Femelle', inconnu: 'Inconnu' };

export default function PucesPage() {
  const [puces, setPuces]       = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [search, setSearch]     = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/puces').then(r => setPuces(r.data.puces || [])).finally(() => setLoading(false));
  }, []);

  const taxoLabel = (t) => t ? `${t.parent?.nom ? t.parent.nom + ' ' : ''}${t.nom}` : '';
  const filtered = puces.filter(p =>
    !search ||
    taxoLabel(p.taxonomie).toLowerCase().includes(search.toLowerCase()) ||
    p.methode?.localite?.nom?.toLowerCase().includes(search.toLowerCase()) ||
    p.idTerrain?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Bug} iconTone="specimen-puce"
        title="Puces" subtitle={`${puces.length} spécimen(s) au total`}
        actions={
          <>
            <Button variant="secondary" icon={Download}
              onClick={() => window.open('http://localhost:3000/api/v1/puces/export', '_blank')}>Export</Button>
            <Button icon={Plus} onClick={() => navigate('/specimens/puces/nouveau')}>Ajouter</Button>
          </>
        }
      />

      {isLoading ? <Spinner.Block /> : puces.length === 0 ? (
        <EmptyState icon={Bug} title="Aucune puce enregistrée"
          action={{ label: 'Ajouter le premier spécimen', icon: Plus, onClick: () => navigate('/specimens/puces/nouveau') }} />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 border border-border-strong rounded-xl px-3.5 py-2 bg-surface-2 focus-within:bg-surface focus-within:border-primary transition-all">
              <Search size={14} className="text-fg-subtle flex-shrink-0" />
              <input type="text" placeholder="Rechercher par espèce, ID terrain ou localité…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent border-none outline-none text-fg placeholder-fg-subtle" />
              {search && <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg-muted"><X size={14} /></button>}
            </div>
            <span className="text-xs text-fg-subtle whitespace-nowrap font-medium">{filtered.length} résultat(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  {['ID terrain', '#ID', 'Espèce', 'Nb', 'Sexe', 'Stade', 'Hôte', 'Position', 'Localité', 'Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-fg-muted tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-specimen-puce/5 transition-colors cursor-pointer"
                    onClick={() => navigate(`/specimens/puces/${p.id}`)}>
                    <td className="px-4 py-3">
                      {p.idTerrain
                        ? <Badge tone="primary" size="sm" className="font-mono font-bold">{p.idTerrain}</Badge>
                        : <span className="text-fg-subtle text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-fg-subtle">#{p.id}</td>
                    <td className="px-4 py-3 font-semibold text-fg italic">{taxoLabel(p.taxonomie) || <span className="text-fg-subtle">—</span>}</td>
                    <td className="px-4 py-3 text-fg-muted font-medium">{p.nombre}</td>
                    <td className="px-4 py-3"><Badge tone={SEXE_TONE[p.sexe] ?? 'default'}>{SEXE_LABEL[p.sexe] ?? 'Inconnu'}</Badge></td>
                    <td className="px-4 py-3 text-fg-muted text-xs">{p.stade || <span className="text-fg-subtle">—</span>}</td>
                    <td className="px-4 py-3 text-fg-muted text-xs">{p.hote?.taxonomieHote?.nom || <span className="text-fg-subtle">—</span>}</td>
                    <td className="px-4 py-3">
                      {p.position
                        ? <Badge tone="warning" size="xs" className="font-mono">{p.container?.code ? `${p.container.code} ${p.position}` : p.position}</Badge>
                        : <span className="text-fg-subtle text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-fg-muted text-xs max-w-28 truncate">{p.methode?.localite?.nom || <span className="text-fg-subtle">—</span>}</td>
                    <td className="px-4 py-3 text-fg-subtle text-xs whitespace-nowrap">
                      {p.dateCollecte ? new Date(p.dateCollecte).toLocaleDateString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
