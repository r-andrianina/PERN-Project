import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { Card, Button, Badge, EmptyState, PageHeader, Spinner, Pagination, DataTable } from '../../components/ui';
import { useApiQuery } from '../../hooks';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { dialog } from '../../lib/dialog';
import { toast } from '../../lib/toast';
import { Bug } from 'lucide-react';

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const SEXE_LABEL = { M: 'Mâle', F: 'Femelle', inconnu: 'Inconnu' };

const COLUMNS = [
  {
    key: 'idTerrain',
    label: 'ID terrain',
    width: '110px',
    render: (s) => s.idTerrain
      ? <Badge tone="primary" size="sm" className="font-mono font-bold">{s.idTerrain}</Badge>
      : <span className="text-fg-subtle text-xs">—</span>,
  },
  {
    key: 'type',
    label: 'Type',
    render: (s) => <span className="font-semibold text-fg">{s.typeSpecimen?.nom ?? '—'}</span>,
  },
  {
    key: 'taxonomie',
    label: 'Taxonomie',
    render: (s) => s.taxonomie
      ? <span className="italic text-sm text-fg">{s.taxonomie.parent ? `${s.taxonomie.parent.nom} ${s.taxonomie.nom}` : s.taxonomie.nom}</span>
      : <span className="text-fg-subtle text-xs">—</span>,
  },
  {
    key: 'nombre',
    label: 'Nb',
    width: '60px',
    render: (s) => <Badge tone="default" size="sm">{s.nombre}</Badge>,
  },
  {
    key: 'sexe',
    label: 'Sexe',
    width: '80px',
    render: (s) => <Badge tone={SEXE_TONE[s.sexe] ?? 'default'} size="sm">{SEXE_LABEL[s.sexe] ?? s.sexe}</Badge>,
  },
  {
    key: 'mission',
    label: 'Mission / Localité',
    render: (s) => (
      <div className="text-xs">
        <p className="font-medium text-fg">{s.methode?.localite?.mission?.ordreMission ?? '—'}</p>
        <p className="text-fg-subtle">{s.methode?.localite?.nom ?? ''}</p>
      </div>
    ),
  },
  {
    key: 'dateCollecte',
    label: 'Date collecte',
    width: '110px',
    render: (s) => s.dateCollecte
      ? <span className="text-xs text-fg-muted">{new Date(s.dateCollecte).toLocaleDateString('fr-FR')}</span>
      : <span className="text-fg-subtle text-xs">—</span>,
  },
];

export default function AutresSpecimensPage() {
  const navigate      = useNavigate();
  const { user }      = useAuthStore();
  const isAdmin       = user?.role === 'admin';

  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState('');
  const [draft,  setDraft]  = useState('');

  const params = { page, limit: 50, ...(search ? { search } : {}) };
  const { data, loading, refetch } = useApiQuery('/autres-specimens', { params });

  const specimens = data?.specimens ?? [];
  const total     = data?.total ?? 0;
  const pages     = data?.pages ?? 1;

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(draft);
    setPage(1);
  };

  const handleDelete = async (s) => {
    const ok = await dialog.confirm({
      title:   'Supprimer ce spécimen ?',
      message: `ID: ${s.idTerrain || s.id} — Cette action est irréversible.`,
      danger:  true,
    });
    if (!ok) return;
    try {
      await api.delete(`/autres-specimens/${s.id}`);
      toast.success('Spécimen supprimé');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const rowActions = isAdmin
    ? [{ label: 'Supprimer', onClick: handleDelete, danger: true }]
    : [];

  return (
    <div className="max-w-screen-2xl space-y-5">
      <PageHeader
        icon={Bug} iconTone="primary"
        title="Autres spécimens"
        subtitle="Phlébotomes, Culicoïdes et autres vecteurs"
        actions={
          <Button icon={Plus} onClick={() => navigate('/specimens/autres/nouveau')}>
            Nouveau spécimen
          </Button>
        }
      />

      {/* Filtres */}
      <Card padding="sm">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Rechercher (type, taxonomie, ID terrain…)"
              className="input-base pl-9 w-full text-sm"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">Chercher</Button>
          {search && (
            <Button type="button" variant="ghost" size="sm" icon={X}
              onClick={() => { setSearch(''); setDraft(''); setPage(1); }}>
              Effacer
            </Button>
          )}
        </form>
      </Card>

      {/* Tableau */}
      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : specimens.length === 0 ? (
          <EmptyState
            icon={Bug}
            title="Aucun spécimen"
            description={search ? 'Aucun résultat pour cette recherche.' : 'Aucun autre spécimen enregistré.'}
            action={{ label: 'Nouveau spécimen', icon: Plus, onClick: () => navigate('/specimens/autres/nouveau') }}
          />
        ) : (
          <>
            <DataTable
              columns={COLUMNS}
              rows={specimens}
              onRowClick={(s) => navigate(`/specimens/autres/${s.id}`)}
              rowActions={rowActions}
            />
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-fg-subtle">{total} spécimen(s)</p>
              <Pagination page={page} pages={pages} onChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
