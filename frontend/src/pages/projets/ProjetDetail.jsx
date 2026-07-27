import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  FolderOpen, MapPin, ChevronRight, User, Calendar, Landmark,
  Clock, Bug, Activity, Layers, Users, UserPlus, Trash2, X, Loader2, Search,
  Pencil, Save,
} from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, EmptyState, Spinner, Breadcrumb, Button } from '../../components/ui';
import FormField from '../../components/FormField';
import AutocompleteUser from '../../components/AutocompleteUser';
import useAuthStore from '../../store/authStore';
import { hasMinRole, ROLE_LABELS, ROLE_COLORS } from '../../lib/roles';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';

const STATUT_TONE  = { actif: 'success', termine: 'default', suspendu: 'warning' };
const STATUT_LABEL = { actif: 'Actif', termine: 'Terminé', suspendu: 'Suspendu' };

const TYPE_COLOR = {
  moustique: 'bg-specimen-moustique',
  tique:     'bg-specimen-tique',
  puce:      'bg-specimen-puce',
};
const TYPE_LABEL = { moustique: 'Moustiques', tique: 'Tiques', puce: 'Puces' };

function MiniBar({ value, max, colorClass = 'bg-primary' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold text-fg tabular-nums w-8 text-right">{value}</span>
    </div>
  );
}

// ── Modal ajout de membre ──────────────────────────────────────
function AddMembreModal({ projetId, currentMembres, onClose, onAdded }) {
  const [query,    setQuery]    = useState('');
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [adding,   setAdding]   = useState(null);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    let cancelled = false;
    const search = async () => {
      if (query.length < 2) { setUsers([]); return; }
      setLoading(true);
      try {
        const r = await api.get('/auth/users');
        const all = [...(r.data.actifs || []), ...(r.data.en_attente || [])];
        const q = query.toLowerCase();
        const currentIds = new Set(currentMembres.map(m => m.userId));
        if (!cancelled) setUsers(
          all.filter(u =>
            !currentIds.has(u.id) &&
            `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(q)
          ).slice(0, 8)
        );
      } catch { if (!cancelled) setError('Impossible de charger les utilisateurs'); }
      finally { if (!cancelled) setLoading(false); }
    };
    const t = setTimeout(search, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, currentMembres]);

  const addMembre = async (userId) => {
    setAdding(userId); setError(null);
    try {
      await api.post(`/projets/${projetId}/membres`, { userId });
      onAdded();
    } catch (err) { setError(err.response?.data?.error || 'Erreur'); }
    finally { setAdding(null); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
            <UserPlus size={15} className="text-primary" /> Ajouter un membre
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 text-fg-subtle hover:text-fg rounded-lg">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {error && <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{error}</p>}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par nom ou email…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              autoFocus
            />
          </div>
          <div className="max-h-52 overflow-y-auto divide-y divide-border rounded-xl border border-border">
            {loading && <p className="text-xs text-fg-subtle text-center py-4"><Loader2 size={14} className="animate-spin inline mr-1" />Chargement…</p>}
            {!loading && query.length >= 2 && users.length === 0 && (
              <p className="text-xs text-fg-subtle text-center py-4">Aucun utilisateur trouvé</p>
            )}
            {!loading && query.length < 2 && (
              <p className="text-xs text-fg-subtle text-center py-4">Tapez au moins 2 caractères</p>
            )}
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-surface-2 transition-colors">
                <div>
                  <p className="text-sm font-medium text-fg">{u.prenom} {u.nom}</p>
                  <p className="text-xs text-fg-subtle">{u.email}</p>
                </div>
                <button
                  type="button"
                  disabled={adding === u.id}
                  onClick={() => addMembre(u.id)}
                  className="px-3 py-1.5 bg-primary text-fg-on-primary text-xs font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {adding === u.id ? <Loader2 size={12} className="animate-spin" /> : 'Ajouter'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjetDetail() {
  const { id }       = useParams();
  const navigate      = useNavigate();
  const { user: me } = useAuthStore();

  const [projet,        setProjet]        = useState(null);
  const [specimenStats, setSpecimenStats] = useState(null);
  const [loadingStats,  setLoadingStats]  = useState(true);
  const [membres,       setMembres]       = useState([]);
  const [showAddMembre, setShowAddMembre] = useState(false);
  const [users,         setUsers]         = useState([]);
  const [editing,       setEditing]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [editForm,      setEditForm]      = useState({});

  const canManageMembres = hasMinRole(me?.role, 'superviseur');
  const canEdit           = hasMinRole(me?.role, 'chercheur'); // aligné sur PUT /projets/:id
  const isAdmin            = me?.role === 'admin';             // aligné sur DELETE /projets/:id

  useEffect(() => {
    api.get(`/projets/${id}`).then(r => setProjet(r.data.projet));
  }, [id]);

  useEffect(() => {
    api.get('/auth/users').then(r => setUsers(r.data.actifs || [])).catch(() => {});
  }, []);

  const startEdit = () => {
    setEditForm({
      nom:             projet.nom,
      porteur:         projet.porteur || '',
      posteAnalytique: projet.posteAnalytique || '',
      responsableId:   projet.responsableId ? String(projet.responsableId) : '',
      statut:          projet.statut,
      dateDebut:       projet.dateDebut ? projet.dateDebut.split('T')[0] : '',
      dateFin:         projet.dateFin   ? projet.dateFin.split('T')[0]   : '',
    });
    setEditing(true);
  };

  const handlePorteurChange = (text, userId) => {
    setEditForm((f) => ({ ...f, porteur: text, responsableId: userId ? String(userId) : '' }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await api.put(`/projets/${id}`, {
        ...editForm,
        responsableId: editForm.responsableId ? parseInt(editForm.responsableId) : null,
      });
      setProjet(r.data.projet);
      setEditing(false);
      toast.success('Projet mis à jour avec succès.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title: 'Supprimer ce projet ?',
      message: `« ${projet.nom} » sera définitivement supprimé. Cette action est irréversible et impossible si le projet contient des missions.`,
      variant: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete(`/projets/${id}`);
      toast.success('Projet supprimé.');
      navigate('/projets');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoadingStats(true);
    api.get(`/projets/${id}/stats`)
      .then(r => setSpecimenStats(r.data))
      .catch(() => setSpecimenStats(null))
      .finally(() => setLoadingStats(false));
  }, [id]);

  const fetchMembres = useCallback(async () => {
    try {
      const r = await api.get(`/projets/${id}/membres`);
      setMembres(r.data.membres ?? []);
    } catch { /* non bloquant */ }
  }, [id]);

  useEffect(() => { fetchMembres(); }, [fetchMembres]);

  const removeMembre = async (userId) => {
    try {
      await api.delete(`/projets/${id}/membres/${userId}`);
      setMembres(prev => prev.filter(m => m.userId !== userId));
    } catch { /* silencieux */ }
  };

  // ── Calculs dérivés ────────────────────────────────────────────
  const progress = useMemo(() => {
    if (!projet?.dateDebut || !projet?.dateFin) return null;
    // eslint-disable-next-line react-hooks/purity
    const now   = Date.now();
    const start = new Date(projet.dateDebut).getTime();
    const end   = new Date(projet.dateFin).getTime();
    return { pct: Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)), daysLeft: Math.ceil((end - now) / 86400000) };
  }, [projet]);

  const totalMissions = projet?.missions?.length ?? 0;

  const totalLocalites = useMemo(
    () => (projet?.missions ?? []).reduce((s, m) => s + (m._count?.localites ?? 0), 0),
    [projet]
  );

  const totalSpecimens = specimenStats
    ? Object.values(specimenStats.parType).reduce((a, b) => a + b, 0)
    : 0;

  if (!projet) return <Spinner.Block label="Chargement…" height="h-40" />;

  // ── Couleur de la progression ────────────────────────────────
  const progressColor = !progress
    ? 'bg-primary'
    : progress.daysLeft < 0
      ? 'bg-danger'
      : progress.daysLeft < 60
        ? 'bg-warning'
        : 'bg-primary';

  return (
    <>
    <div className="max-w-screen-2xl space-y-5">
      <Breadcrumb items={[
        { label: 'Projets', to: '/projets' },
        { label: projet.nom },
      ]} />

      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] 2xl:grid-cols-[1fr,400px] gap-5 2xl:gap-8 items-start">

        {/* ── Colonne gauche ── */}
        <div className="space-y-5">

          {/* Carte principale du projet */}
          <Card padding="md">
            {editing ? (
              <div className="space-y-4">
                <FormField label="Nom du projet" name="nom"
                  value={editForm.nom} onChange={(e) => setEditForm(f => ({ ...f, nom: e.target.value }))}
                  required />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AutocompleteUser
                    label="Porteur du projet"
                    value={editForm.porteur}
                    onChange={handlePorteurChange}
                    users={users}
                    placeholder="Nom ou choisir un utilisateur"
                  />
                  <FormField label="Statut" name="statut" type="select"
                    value={editForm.statut} onChange={(e) => setEditForm(f => ({ ...f, statut: e.target.value }))}
                    options={[
                      { value: 'actif',    label: 'Actif'    },
                      { value: 'termine',  label: 'Terminé'  },
                      { value: 'suspendu', label: 'Suspendu' },
                    ]} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Date de début" name="dateDebut" type="date"
                    value={editForm.dateDebut} onChange={(e) => setEditForm(f => ({ ...f, dateDebut: e.target.value }))} />
                  <FormField label="Date de fin" name="dateFin" type="date"
                    value={editForm.dateFin} onChange={(e) => setEditForm(f => ({ ...f, dateFin: e.target.value }))} />
                </div>
                <FormField label="Poste analytique (PA)" name="posteAnalytique"
                  value={editForm.posteAnalytique} onChange={(e) => setEditForm(f => ({ ...f, posteAnalytique: e.target.value }))}
                  placeholder="ex: PA-2026-014" hint="Référence budgétaire du projet" />
              </div>
            ) : (
              <>
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FolderOpen size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1">
                      <Badge tone={STATUT_TONE[projet.statut] ?? 'default'} dot>
                        {STATUT_LABEL[projet.statut] ?? projet.statut}
                      </Badge>
                    </div>
                    <h1 className="text-xl font-bold text-fg">{projet.nom}</h1>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  {(projet.porteur || projet.responsable) && (
                    <div className="text-xs">
                      <p className="text-fg-subtle font-medium mb-0.5 flex items-center gap-1"><User size={11} /> Porteur</p>
                      <p className="text-fg">
                        {projet.porteur || `${projet.responsable.prenom} ${projet.responsable.nom}`}
                      </p>
                    </div>
                  )}
                  {projet.dateDebut && (
                    <div className="text-xs">
                      <p className="text-fg-subtle font-medium mb-0.5 flex items-center gap-1"><Calendar size={11} /> Période</p>
                      <p className="text-fg">
                        {new Date(projet.dateDebut).toLocaleDateString('fr-FR')}
                        {projet.dateFin && ` → ${new Date(projet.dateFin).toLocaleDateString('fr-FR')}`}
                      </p>
                    </div>
                  )}
                  {projet.posteAnalytique && (
                    <div className="text-xs">
                      <p className="text-fg-subtle font-medium mb-0.5 flex items-center gap-1"><Landmark size={11} /> Poste analytique</p>
                      <p className="text-fg font-mono">{projet.posteAnalytique}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* Missions */}
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <MapPin size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-fg">
                Missions
                <span className="ml-2 text-xs font-normal text-fg-subtle">({projet.missions?.length ?? 0})</span>
              </h2>
            </div>

            {projet.missions?.length === 0 ? (
              <div className="py-10"><EmptyState icon={MapPin} title="Aucune mission associée" /></div>
            ) : (
              <div className="divide-y divide-border">
                {projet.missions?.map(m => (
                  <Link key={m.id} to={`/missions/${m.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-2 transition-colors group">
                    <div>
                      <p className="text-sm font-medium text-fg group-hover:text-primary transition-colors">
                        {m.ordreMission}
                      </p>
                      <p className="text-xs text-fg-subtle mt-0.5">{m._count?.localites ?? 0} localité(s)</p>
                    </div>
                    <ChevronRight size={14} className="text-fg-subtle group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Colonne droite — Tableau de bord du projet ── */}
        <div className="space-y-4">

          {/* Actions */}
          {(canEdit || isAdmin) && (
            <Card padding="sm">
              <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider mb-2.5">Actions</p>
              <div className="space-y-2">
                {editing ? (
                  <>
                    <Button variant="primary" className="w-full justify-center" icon={Save}
                      loading={saving} onClick={handleSave}>Enregistrer</Button>
                    <Button variant="secondary" className="w-full justify-center" icon={X}
                      onClick={() => setEditing(false)} disabled={saving}>Annuler</Button>
                  </>
                ) : (
                  <>
                    {canEdit && (
                      <Button variant="outline" className="w-full justify-center" icon={Pencil}
                        onClick={startEdit}>Modifier</Button>
                    )}
                    {isAdmin && (
                      <Button variant="danger" className="w-full justify-center" icon={Trash2}
                        loading={deleting} onClick={handleDelete}>Supprimer</Button>
                    )}
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Avancement temporel */}
          {progress !== null && (
            <Card padding="md">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-fg-subtle" />
                <span className="text-xs font-semibold text-fg uppercase tracking-wider">Avancement</span>
              </div>
              <div className="flex items-end justify-between mb-2">
                <span className="text-2xl font-bold text-fg">{Math.round(progress.pct)}<span className="text-sm font-normal text-fg-subtle ml-0.5">%</span></span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${
                  progress.daysLeft < 0
                    ? 'bg-danger/10 text-danger'
                    : progress.daysLeft < 60
                      ? 'bg-warning/10 text-warning'
                      : 'bg-success/10 text-success'
                }`}>
                  {progress.daysLeft < 0
                    ? `Terminé il y a ${Math.abs(progress.daysLeft)}j`
                    : `${progress.daysLeft} j restants`}
                </span>
              </div>
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className={`h-full ${progressColor} rounded-full transition-all duration-700`}
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-fg-subtle mt-1.5">
                <span>{new Date(projet.dateDebut).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>
                <span>{new Date(projet.dateFin).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>
              </div>
            </Card>
          )}

          {/* Couverture terrain */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={14} className="text-fg-subtle" />
              <span className="text-xs font-semibold text-fg uppercase tracking-wider">Couverture terrain</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-fg">{totalMissions}</p>
                <p className="text-[10px] text-fg-subtle mt-0.5">Mission(s)</p>
              </div>
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-fg">{totalLocalites}</p>
                <p className="text-[10px] text-fg-subtle mt-0.5">Localité(s)</p>
              </div>
            </div>
          </Card>

          {/* Spécimens collectés */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-3">
              <Bug size={14} className="text-fg-subtle" />
              <span className="text-xs font-semibold text-fg uppercase tracking-wider">Spécimens collectés</span>
              {!loadingStats && specimenStats && (
                <span className="ml-auto text-xs font-bold text-primary">{totalSpecimens}</span>
              )}
            </div>

            {loadingStats ? (
              <div className="space-y-2.5 animate-pulse">
                {[80, 55, 40].map(w => (
                  <div key={w} className="flex items-center gap-2">
                    <div className="h-3 rounded bg-surface-3" style={{ width: '50%' }} />
                    <div className="flex-1 h-1.5 rounded-full bg-surface-3" />
                    <div className="h-3 w-6 rounded bg-surface-3" />
                  </div>
                ))}
              </div>
            ) : !specimenStats || totalSpecimens === 0 ? (
              <p className="text-xs text-fg-subtle text-center py-3">
                Aucun spécimen collecté pour ce projet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(specimenStats.parType)
                  .filter(([, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-fg-muted">{TYPE_LABEL[type] ?? type}</span>
                      </div>
                      <MiniBar value={count} max={totalSpecimens} colorClass={TYPE_COLOR[type] ?? 'bg-primary'} />
                    </div>
                  ))}
                {specimenStats.totalIndividus > totalSpecimens && (
                  <p className="text-[10px] text-fg-subtle border-t border-border pt-2 mt-1">
                    {specimenStats.totalIndividus} individus au total
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Top espèces */}
          {specimenStats?.topEspeces?.length > 0 && (
            <Card padding="md">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={14} className="text-fg-subtle" />
                <span className="text-xs font-semibold text-fg uppercase tracking-wider">Top espèces</span>
              </div>
              <div className="space-y-2">
                {specimenStats.topEspeces.slice(0, 5).map((e, i) => (
                  <div key={e.nom} className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] font-bold text-fg-subtle w-4 text-right flex-shrink-0">{i + 1}.</span>
                    <span className="italic text-fg truncate flex-1">{e.nom}</span>
                    <span className="font-bold text-fg-muted tabular-nums flex-shrink-0">{e.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Membres du projet */}
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-fg-subtle" />
                <span className="text-xs font-semibold text-fg uppercase tracking-wider">
                  Membres <span className="font-normal text-fg-subtle">({membres.length})</span>
                </span>
              </div>
              {canManageMembres && (
                <button
                  type="button"
                  onClick={() => setShowAddMembre(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary-600 font-medium transition-colors"
                >
                  <UserPlus size={13} /> Ajouter
                </button>
              )}
            </div>
            <div className="divide-y divide-border max-h-56 overflow-y-auto">
              {membres.length === 0 ? (
                <p className="text-xs text-fg-subtle text-center py-5">Aucun membre assigné</p>
              ) : membres.map(m => (
                <div key={m.userId} className="flex items-center gap-2.5 px-4 py-2.5 group">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-primary">
                      {`${m.user?.prenom?.[0] ?? ''}${m.user?.nom?.[0] ?? ''}`.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-fg truncate">{m.user?.prenom} {m.user?.nom}</p>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${ROLE_COLORS[m.user?.role] ?? 'bg-surface-3 text-fg-muted border-border'}`}>
                      {ROLE_LABELS[m.user?.role] ?? m.user?.role}
                    </span>
                  </div>
                  {canManageMembres && (
                    <button
                      type="button"
                      onClick={() => removeMembre(m.userId)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                      title="Retirer du projet"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>

    {showAddMembre && (
      <AddMembreModal
        projetId={parseInt(id)}
        currentMembres={membres}
        onClose={() => setShowAddMembre(false)}
        onAdded={() => { setShowAddMembre(false); fetchMembres(); }}
      />
    )}
    </>
  );
}

