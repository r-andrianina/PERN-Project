import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Search, X } from 'lucide-react';
import { Card, Button, Badge, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { useApiQuery } from '../../hooks';
import SpecimenIcon from '../../components/SpecimenIcon';

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const SEXE_LABEL = { M: 'Mâle', F: 'Femelle', inconnu: 'Inconnu' };

export default function TiquesPage() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { data, loading: isLoading } = useApiQuery('/tiques', { select: (r) => r.tiques ?? [] });
  const tiques = data ?? [];

  const taxoLabel = (t) => t ? `${t.parent?.nom ? t.parent.nom + ' ' : ''}${t.nom}` : '';
  const filtered = tiques.filter(t =>
    !search ||
    taxoLabel(t.taxonomie).toLowerCase().includes(search.toLowerCase()) ||
    t.methode?.localite?.nom?.toLowerCase().includes(search.toLowerCase()) ||
    t.idTerrain?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <PageHeader
        icon={() => <SpecimenIcon type="tique" size={18} />} iconTone="specimen-tique"
        title="Tiques" subtitle={`${tiques.length} spécimen(s) au total`}
        actions={
          <>
            <Button variant="secondary" icon={Download}
              onClick={() => window.open('http://localhost:3000/api/v1/tiques/export', '_blank')}>Export</Button>
            <Button icon={Plus} onClick={() => navigate('/specimens/tiques/nouveau')}>Ajouter</Button>
          </>
        }
      />

      {isLoading ? <Spinner.Block /> : tiques.length === 0 ? (
        <EmptyState icon={() => <SpecimenIcon type="tique" size={40} />} title="Aucune tique enregistrée"
          action={{ label: 'Ajouter le premier spécimen', icon: Plus, onClick: () => navigate('/specimens/tiques/nouveau') }} />
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
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  {['ID terrain', '#ID', 'Espèce', 'Nb', 'Sexe', 'Stade', 'Gorgée', 'Hôte', 'Position', 'Localité', 'Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-fg-muted tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-specimen-tique/5 transition-colors cursor-pointer"
                    onClick={() => navigate(`/specimens/tiques/${t.id}`)}>
                    <td className="px-4 py-3">
                      {t.idTerrain
                        ? <Badge tone="primary" size="sm" className="font-mono font-bold">{t.idTerrain}</Badge>
                        : <span className="text-fg-subtle text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-fg-subtle">#{t.id}</td>
                    <td className="px-4 py-3 font-semibold text-fg italic">{taxoLabel(t.taxonomie) || <span className="text-fg-subtle">—</span>}</td>
                    <td className="px-4 py-3 text-fg-muted font-medium">{t.nombre}</td>
                    <td className="px-4 py-3"><Badge tone={SEXE_TONE[t.sexe] ?? 'default'}>{SEXE_LABEL[t.sexe] ?? 'Inconnu'}</Badge></td>
                    <td className="px-4 py-3 text-fg-muted text-xs">{t.stade || <span className="text-fg-subtle">—</span>}</td>
                    <td className="px-4 py-3"><Badge tone={t.gorge ? 'danger' : 'default'}>{t.gorge ? 'Oui' : 'Non'}</Badge></td>
                    <td className="px-4 py-3 text-fg-muted text-xs">{t.hote?.taxonomieHote?.nom || <span className="text-fg-subtle">—</span>}</td>
                    <td className="px-4 py-3">
                      {t.position
                        ? <Badge tone="warning" size="xs" className="font-mono">{t.container?.code ? `${t.container.code} ${t.position}` : t.position}</Badge>
                        : <span className="text-fg-subtle text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-fg-muted text-xs max-w-28 truncate">{t.methode?.localite?.nom || <span className="text-fg-subtle">—</span>}</td>
                    <td className="px-4 py-3 text-fg-subtle text-xs whitespace-nowrap">
                      {t.dateCollecte ? new Date(t.dateCollecte).toLocaleDateString('fr-FR') : '—'}
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
