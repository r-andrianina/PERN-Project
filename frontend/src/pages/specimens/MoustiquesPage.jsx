import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Search, X } from 'lucide-react';
import { Card, Button, Badge, EmptyState, PageHeader, Spinner, Pagination } from '../../components/ui';
import { useApiQuery } from '../../hooks';
import SpecimenIcon from '../../components/SpecimenIcon';

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const SEXE_LABEL = { M: 'Mâle', F: 'Femelle', inconnu: 'Inconnu' };
const LIMIT = 50;

export default function MoustiquesPage() {
  const navigate = useNavigate();
  const [search,  setSearch]  = useState('');
  const [debounced, setDebounced] = useState('');
  const [page,    setPage]    = useState(1);

  // Debounce 300 ms
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading } = useApiQuery('/moustiques', {
    params: { page, limit: LIMIT, search: debounced || undefined },
    deps: [page, debounced],
  });

  const moustiques = data?.moustiques ?? [];
  const total      = data?.total  ?? 0;
  const pages      = data?.pages  ?? 1;

  const taxoLabel = (t) => t ? `${t.parent?.nom ? t.parent.nom + ' ' : ''}${t.nom}` : '';

  return (
    <div className="space-y-5">
      <PageHeader
        icon={() => <SpecimenIcon type="moustique" size={18} />} iconTone="specimen-moustique"
        title="Moustiques"
        subtitle={`${total} spécimen(s) au total`}
        actions={
          <>
            <Button variant="secondary" icon={Download}
              onClick={() => window.open('http://localhost:3000/api/v1/moustiques/export', '_blank')}>
              Export
            </Button>
            <Button icon={Plus} onClick={() => navigate('/specimens/moustiques/nouveau')}>
              Ajouter
            </Button>
          </>
        }
      />

      {loading && !data ? (
        <Spinner.Block label="Chargement…" />
      ) : total === 0 && !debounced ? (
        <EmptyState
          icon={() => <SpecimenIcon type="moustique" size={40} />}
          title="Aucun moustique enregistré"
          description="Commencez par enregistrer un premier spécimen."
          action={{ label: 'Ajouter le premier spécimen', icon: Plus, onClick: () => navigate('/specimens/moustiques/nouveau') }}
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          {/* Barre de recherche */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 border border-border-strong rounded-xl px-3.5 py-2 bg-surface-2 focus-within:bg-surface focus-within:border-primary transition-all">
              <Search size={14} className="text-fg-subtle flex-shrink-0" />
              <input
                type="text"
                placeholder="Rechercher par espèce, ID terrain ou notes…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent border-none outline-none text-fg placeholder-fg-subtle"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg-muted">
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="text-xs text-fg-subtle whitespace-nowrap font-medium">
              {total} résultat(s)
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  {['ID terrain', '#ID', 'Espèce', 'Nb', 'Sexe', 'Stade', 'Parité', 'Repas sang', 'Localité', 'Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-fg-muted tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-8 text-fg-subtle text-sm">Chargement…</td></tr>
                ) : moustiques.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-fg-subtle text-sm">Aucun résultat pour « {debounced} »</td></tr>
                ) : moustiques.map(m => (
                  <tr key={m.id} className="hover:bg-primary/5 transition-colors cursor-pointer"
                    onClick={() => navigate(`/specimens/moustiques/${m.id}`)}>
                    <td className="px-4 py-3">
                      {m.idTerrain
                        ? <Badge tone="primary" size="sm" className="font-mono font-bold">{m.idTerrain}</Badge>
                        : <span className="text-fg-subtle text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-fg-subtle">#{m.id}</td>
                    <td className="px-4 py-3 font-semibold text-fg italic">
                      {taxoLabel(m.taxonomie) || <span className="text-fg-subtle">—</span>}
                    </td>
                    <td className="px-4 py-3 text-fg-muted font-medium">{m.nombre}</td>
                    <td className="px-4 py-3">
                      <Badge tone={SEXE_TONE[m.sexe] ?? 'default'}>{SEXE_LABEL[m.sexe] ?? 'Inconnu'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-fg-muted text-xs">{m.stade || <span className="text-fg-subtle">—</span>}</td>
                    <td className="px-4 py-3 text-fg-muted text-xs">{m.parite || <span className="text-fg-subtle">—</span>}</td>
                    <td className="px-4 py-3">
                      <Badge tone={m.repasSang ? 'danger' : 'default'}>{m.repasSang ? 'Oui' : 'Non'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-fg-muted text-xs max-w-32 truncate">
                      {m.methode?.localite?.nom || <span className="text-fg-subtle">—</span>}
                    </td>
                    <td className="px-4 py-3 text-fg-subtle text-xs whitespace-nowrap">
                      {m.dateCollecte ? new Date(m.dateCollecte).toLocaleDateString('fr-FR') : <span className="text-fg-subtle">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pages={pages} total={total} limit={LIMIT} onChange={setPage} />
        </Card>
      )}
    </div>
  );
}
