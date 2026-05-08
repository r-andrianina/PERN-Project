import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PawPrint, Plus, Search, X, MapPin, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { Card, Badge, Button, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { useApiQuery } from '../../hooks';

const ROLES = { admin: 4, chercheur: 3, terrain: 2, lecteur: 1 };
const isMin = (r, m) => (ROLES[r] || 0) >= ROLES[m];
const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const SEXE_LABEL = { M: 'Mâle', F: 'Femelle', inconnu: 'Inconnu' };

export default function HotesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canDelete = isMin(user?.role, 'chercheur');

  const [search, setSearch] = useState('');
  const { data, loading: isLoading, refetch: refresh } = useApiQuery('/hotes', { select: (r) => r.hotes ?? [] });
  const hotes = data ?? [];

  const taxoLabel = (t) => t ? `${t.parent?.nom ? t.parent.nom + ' ' : ''}${t.nom}` : '';
  const filtered = hotes.filter((h) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return taxoLabel(h.taxonomieHote).toLowerCase().includes(s) ||
      h.especeLocale?.toLowerCase().includes(s) ||
      h.methode?.localite?.nom?.toLowerCase().includes(s);
  });

  const remove = async (h) => {
    if (!confirm(`Supprimer l'hôte #${h.id} ?`)) return;
    try { await api.delete(`/hotes/${h.id}`); refresh(); }
    catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={PawPrint} iconTone="warning"
        title="Hôtes" subtitle={`${hotes.length} hôte(s) enregistré(s)`}
        actions={<Button icon={Plus} onClick={() => navigate('/hotes/nouveau')}>Nouvel hôte</Button>}
      />

      {isLoading ? <Spinner.Block /> : hotes.length === 0 ? (
        <EmptyState icon={PawPrint} title="Aucun hôte enregistré"
          action={{ label: 'Enregistrer le premier hôte', icon: Plus, onClick: () => navigate('/hotes/nouveau') }} />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 border border-border-strong rounded-xl px-3.5 py-2 bg-surface-2 focus-within:bg-surface focus-within:border-primary transition-all">
              <Search size={14} className="text-fg-subtle flex-shrink-0" />
              <input type="text" placeholder="Rechercher par espèce ou localité…"
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent border-none outline-none text-fg placeholder-fg-subtle" />
              {search && <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg-muted"><X size={14} /></button>}
            </div>
            <span className="text-xs text-fg-subtle whitespace-nowrap font-medium">{filtered.length} résultat(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  {['#ID', 'Espèce (référentiel)', 'Espèce locale', 'Sexe', 'Âge', 'État', 'Localité', 'Spécimens', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-fg-muted tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((h) => {
                  const total = (h._count?.tiques || 0) + (h._count?.puces || 0);
                  return (
                    <tr key={h.id} className="hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-fg-subtle">#{h.id}</td>
                      <td className="px-4 py-3 italic text-fg">
                        {taxoLabel(h.taxonomieHote) || '—'}
                        {h.taxonomieHote?.nomCommun && (
                          <span className="not-italic text-fg-subtle text-xs ml-1">({h.taxonomieHote.nomCommun})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-fg-muted text-xs">{h.especeLocale || <span className="text-fg-subtle">—</span>}</td>
                      <td className="px-4 py-3"><Badge tone={SEXE_TONE[h.sexe] ?? 'default'}>{SEXE_LABEL[h.sexe] ?? 'Inconnu'}</Badge></td>
                      <td className="px-4 py-3 text-fg-muted text-xs">{h.age || <span className="text-fg-subtle">—</span>}</td>
                      <td className="px-4 py-3 text-fg-muted text-xs">{h.etatSante || <span className="text-fg-subtle">—</span>}</td>
                      <td className="px-4 py-3 text-fg-muted text-xs flex items-center gap-1">
                        <MapPin size={11} className="text-fg-subtle" />{h.methode?.localite?.nom || '—'}
                      </td>
                      <td className="px-4 py-3"><Badge tone="success">{total}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        {canDelete && (
                          <button onClick={() => remove(h)} title="Supprimer"
                            className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
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
