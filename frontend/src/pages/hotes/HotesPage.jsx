import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PawPrint, Plus, Search, X, MapPin, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';
import { Card, Badge, Button, EmptyState, PageHeader, Spinner, Pagination, DataTable } from '../../components/ui';
import { useApiQuery } from '../../hooks';

const ROLES = { admin: 4, chercheur: 3, terrain: 2, lecteur: 1 };
const isMin = (r, m) => (ROLES[r] || 0) >= ROLES[m];

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const SEXE_LABEL = { M: 'Mâle', F: 'Femelle', inconnu: 'Inconnu' };

const taxoLabel = (t) =>
  t ? `${t.parent?.nom ? t.parent.nom + ' ' : ''}${t.nom}` : '';

export default function HotesPage() {
  const navigate   = useNavigate();
  const { user }   = useAuthStore();
  const canDelete  = isMin(user?.role, 'chercheur');

  const [search, setSearch] = useState('');
  const [page,   setPage]   = useState(1);
  const [limit,  setLimit]  = useState(25);
  const [sort,   setSort]   = useState(null);

  const { data, loading: isLoading, refetch: refresh } = useApiQuery('/hotes', {
    select: (r) => r.hotes ?? [],
  });

  // Réinitialiser la page sur changement de recherche
  useEffect(() => { setPage(1); }, [search]);

  const remove = useCallback(async (h) => {
    const ok = await dialog.confirm({
      title: "Supprimer cet hôte ?",
      message: `L'hôte #${h.id} sera définitivement supprimé.`,
    });
    if (!ok) return;
    try { await api.delete(`/hotes/${h.id}`); refresh(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  }, [refresh]);

  // Filtre + tri côté client
  const filtered = useMemo(() => {
    const hotes = data ?? [];
    let list = hotes;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((h) =>
        taxoLabel(h.taxonomieHote).toLowerCase().includes(s) ||
        h.especeLocale?.toLowerCase().includes(s) ||
        h.methode?.localite?.nom?.toLowerCase().includes(s) ||
        h.idTerrain?.toLowerCase().includes(s)
      );
    }
    if (!sort) return list;
    return [...list].sort((a, b) => {
      let av, bv;
      switch (sort.key) {
        case 'id':     av = a.id;     bv = b.id;     break;
        case 'espece': av = taxoLabel(a.taxonomieHote); bv = taxoLabel(b.taxonomieHote); break;
        case 'sexe':   av = a.sexe;   bv = b.sexe;   break;
        case 'total':
          av = (a._count?.tiques || 0) + (a._count?.puces || 0);
          bv = (b._count?.tiques || 0) + (b._count?.puces || 0);
          break;
        default: return 0;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'fr');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [data, search, sort]);

  const hotes     = data ?? [];
  const pageCount = Math.ceil(filtered.length / limit) || 1;
  const paged     = filtered.slice((page - 1) * limit, page * limit);

  // Colonnes — dépendent de canDelete et remove
  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'Identifiant',
      sortable: true,
      skeletonWidth: '40%',
      width: '110px',
      hidden: 'hidden sm:table-cell',
      className: 'font-mono text-xs',
      render: (h) => h.idTerrain
        ? <span className="text-primary font-semibold">{h.idTerrain}</span>
        : <span className="text-fg-subtle">{`#${h.id}`}</span>,
    },
    {
      key: 'espece',
      label: 'Espèce (référentiel)',
      sortable: true,
      skeletonWidth: '80%',
      render: (h) => (
        <span className="italic text-fg">
          {taxoLabel(h.taxonomieHote) || null}
          {h.taxonomieHote?.nomCommun && (
            <span className="not-italic text-fg-subtle text-xs ml-1">
              ({h.taxonomieHote.nomCommun})
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'especeLocale',
      label: 'Espèce locale',
      skeletonWidth: '65%',
      hidden: 'hidden md:table-cell',
      render: (h) => <span className="text-fg-muted text-xs">{h.especeLocale || null}</span>,
    },
    {
      key: 'sexe',
      label: 'Sexe',
      sortable: true,
      skeletonWidth: '50%',
      render: (h) => (
        <Badge tone={SEXE_TONE[h.sexe] ?? 'default'}>
          {SEXE_LABEL[h.sexe] ?? 'Inconnu'}
        </Badge>
      ),
    },
    {
      key: 'age',
      label: 'Âge',
      skeletonWidth: '45%',
      hidden: 'hidden lg:table-cell',
      render: (h) => <span className="text-fg-muted text-xs">{h.age || null}</span>,
    },
    {
      key: 'etatSante',
      label: 'État',
      skeletonWidth: '55%',
      hidden: 'hidden lg:table-cell',
      render: (h) => <span className="text-fg-muted text-xs">{h.etatSante || null}</span>,
    },
    {
      key: 'localite',
      label: 'Localité',
      skeletonWidth: '70%',
      hidden: 'hidden sm:table-cell',
      render: (h) => (
        <span className="flex items-center gap-1 text-fg-muted text-xs">
          <MapPin size={11} className="text-fg-subtle flex-shrink-0" />
          {h.methode?.localite?.nom || null}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Spécimens',
      sortable: true,
      skeletonWidth: '40%',
      width: '88px',
      headerClassName: 'text-center',
      className: 'text-center',
      render: (h) => {
        const n = (h._count?.tiques || 0) + (h._count?.puces || 0);
        return <Badge tone="success">{n}</Badge>;
      },
    },
    {
      key: 'actions',
      label: '',
      width: '48px',
      className: 'text-right',
      render: (h) => canDelete ? (
        <button
          onClick={(e) => { e.stopPropagation(); remove(h); }}
          title="Supprimer"
          className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
        >
          <Trash2 size={13} />
        </button>
      ) : null,
    },
  ], [canDelete, remove]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={PawPrint} iconTone="warning"
        title="Hôtes"
        subtitle={`${hotes.length} hôte(s) enregistré(s)`}
        actions={<Button icon={Plus} onClick={() => navigate('/hotes/nouveau')}>Nouvel hôte</Button>}
      />

      {isLoading ? <Spinner.Block /> : hotes.length === 0 ? (
        <EmptyState
          icon={PawPrint} title="Aucun hôte enregistré"
          action={{ label: 'Enregistrer le premier hôte', icon: Plus, onClick: () => navigate('/hotes/nouveau') }}
        />
      ) : (
        <Card padding="none" className="overflow-hidden">

          {/* Barre de recherche */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 border border-border-strong rounded-xl px-3.5 py-2 bg-surface-2 focus-within:bg-surface focus-within:border-primary transition-all">
              <Search size={14} className="text-fg-subtle flex-shrink-0" />
              <input
                type="text"
                placeholder="Rechercher par identifiant, espèce ou localité…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent border-none outline-none text-fg placeholder-fg-subtle"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg-muted">
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="text-xs text-fg-subtle whitespace-nowrap font-medium">
              {filtered.length} résultat(s)
            </span>
          </div>

          <DataTable
            columns={columns}
            rows={paged}
            loading={false}
            sort={sort}
            onSort={(key, dir) => setSort({ key, dir })}
            onRowClick={(h) => navigate(`/hotes/${h.id}`)}
            minWidth="720px"
            maxHeight="calc(100vh - 310px)"
            empty={
              <span className="text-fg-subtle text-sm">
                Aucun hôte pour «&nbsp;{search}&nbsp;»
              </span>
            }
          />

          <Pagination
            page={page} pages={pageCount} total={filtered.length} limit={limit}
            onChange={setPage}
            onLimitChange={(n) => { setLimit(n); setPage(1); }}
          />
        </Card>
      )}
    </div>
  );
}
