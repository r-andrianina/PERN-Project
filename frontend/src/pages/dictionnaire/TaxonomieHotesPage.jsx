// Vue arbre + CRUD pour la taxonomie des hôtes (sans champ "type").

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2, ChevronLeft,
  ChevronRight, ChevronDown, X, Rabbit,
} from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';
import { useT, interpolate } from '../../lib/i18n';

const ROLES = { admin: 5, superviseur: 4, chercheur: 3, technicien: 2, lecteur: 1 };
const isMin = (r, m) => (ROLES[r] || 0) >= ROLES[m];

const getNiveaux = (t) => [
  { value: 'ordre',        label: t('taxonomieHotesPage.niveauOrdre') },
  { value: 'famille',      label: t('taxonomieHotesPage.niveauFamille') },
  { value: 'sous_famille', label: t('taxonomieHotesPage.niveauSousFamille') },
  { value: 'genre',        label: t('taxonomieHotesPage.niveauGenre') },
  { value: 'sous_genre',   label: t('taxonomieHotesPage.niveauSousGenre') },
  { value: 'espece',       label: t('taxonomieHotesPage.niveauEspece') },
  { value: 'sous_espece',  label: t('taxonomieHotesPage.niveauSousEspece') },
];

const NIVEAU_ENFANT = {
  ordre:        ['famille'], famille: ['sous_famille', 'genre'],
  sous_famille: ['genre'],   genre:   ['sous_genre', 'espece'],
  sous_genre:   ['espece'],  espece:  ['sous_espece'], sous_espece: [],
};

function TreeNode({ node, depth = 0, onAddChild, onEdit, onToggle, onDelete, canEdit, canDelete, expandedIds, setExpandedIds, niveauLabel }) {
  const t = useT();
  const hasChildren = node.enfants?.length > 0;
  const expanded    = expandedIds.has(node.id);
  const enfantsAutorises = NIVEAU_ENFANT[node.niveau] || [];

  const toggle = () => {
    const next = new Set(expandedIds);
    expanded ? next.delete(node.id) : next.add(node.id);
    setExpandedIds(next);
  };

  return (
    <div>
      <div className={`group flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-surface-2 transition-colors duration-100 ${!node.actif ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${8 + depth * 20}px` }}>
        <button onClick={toggle} className="w-5 h-5 flex items-center justify-center text-fg-subtle hover:text-fg">
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle w-20 flex-shrink-0">
          {niveauLabel[node.niveau]}
        </span>
        <span className={`text-sm text-fg font-medium ${node.niveau === 'genre' || node.niveau === 'espece' ? 'italic' : ''}`}>
          {node.nom}
        </span>
        {node.nomCommun && <span className="text-xs text-fg-subtle">({node.nomCommun})</span>}
        {!node.actif && <span className="badge bg-surface-3 text-fg-muted border border-border-strong">{t('taxonomieHotesPage.inactif')}</span>}

        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {canEdit && enfantsAutorises.length > 0 && (
            <button onClick={() => onAddChild(node)} title={t('taxonomieHotesPage.addChild')} className="p-1.5 text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg">
              <Plus size={13} />
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={() => onToggle(node)} title={node.actif ? t('taxonomieHotesPage.desactiver') : t('taxonomieHotesPage.activer')} className="p-1.5 text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg">
                {node.actif ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              </button>
              <button onClick={() => onEdit(node)} title={t('taxonomieHotesPage.modifier')} className="p-1.5 text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg">
                <Edit2 size={12} />
              </button>
            </>
          )}
          {canDelete && (
            <button onClick={() => onDelete(node)} title={t('taxonomieHotesPage.supprimer')} className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.enfants.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1}
              onAddChild={onAddChild} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete}
              canEdit={canEdit} canDelete={canDelete}
              expandedIds={expandedIds} setExpandedIds={setExpandedIds} niveauLabel={niveauLabel} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TaxonomieHotesPage() {
  const t = useT();
  const niveaux = getNiveaux(t);
  const niveauLabel = Object.fromEntries(niveaux.map((n) => [n.value, n.label]));
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canEdit   = isMin(user?.role, 'chercheur');
  const canDelete = user?.role === 'admin';

  const [tree, setTree]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [submitErr, setErr]   = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await api.get('/dictionnaire/taxonomie-hotes/tree');
      setTree(r.data.tree);
      const ids = new Set();
      const collect = (nodes, lvl) => nodes.forEach((n) => { if (lvl < 2) ids.add(n.id); n.enfants?.length && collect(n.enfants, lvl + 1); });
      collect(r.data.tree, 0);
      setExpandedIds(ids);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const openCreateRoot = () => {
    setEditing({ niveau: 'ordre', nom: '', nomCommun: '', description: '', parentId: null });
    setErr(null);
  };
  const openCreateChild = (parent) => {
    const niveauEnfant = NIVEAU_ENFANT[parent.niveau][0];
    setEditing({ niveau: niveauEnfant, nom: '', nomCommun: '', description: '',
      parentId: parent.id, parentLabel: `${niveauLabel[parent.niveau]} ${parent.nom}` });
    setErr(null);
  };
  const openEdit = (n) => {
    setEditing({ id: n.id, niveau: n.niveau, nom: n.nom,
      nomCommun: n.nomCommun || '', description: n.description || '', parentId: n.parentId });
    setErr(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      const body = { niveau: editing.niveau, nom: editing.nom, parentId: editing.parentId,
        nomCommun: editing.nomCommun, description: editing.description };
      if (editing.id) await api.put(`/dictionnaire/taxonomie-hotes/${editing.id}`, body);
      else            await api.post(`/dictionnaire/taxonomie-hotes`, body);
      setEditing(null);
      refresh();
    } catch (err) { setErr(err.response?.data?.error || t('taxonomieHotesPage.errorGeneric')); }
  };

  const toggleActif = async (n) => {
    try {
      await api.patch(`/dictionnaire/taxonomie-hotes/${n.id}/${n.actif ? 'desactiver' : 'activer'}`);
      refresh();
    } catch (err) { toast.error(err.response?.data?.error || t('taxonomieHotesPage.errorGeneric')); }
  };
  const remove = async (n) => {
    const ok = await dialog.confirm({
      title: interpolate(t('taxonomieHotesPage.deleteTitle'), { nom: n.nom }),
      message: t('taxonomieHotesPage.deleteMessage'),
    });
    if (!ok) return;
    try { await api.delete(`/dictionnaire/taxonomie-hotes/${n.id}`); refresh(); }
    catch (err) { toast.error(err.response?.data?.error || t('taxonomieHotesPage.errorGeneric')); }
  };

  return (
    <div className="max-w-screen-2xl space-y-5">
      <button onClick={() => navigate('/dictionnaire')} className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <ChevronLeft size={16} /> {t('taxonomieHotesPage.backToDictionnaire')}
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-fg flex items-center gap-2">
            <Rabbit size={20} className="text-specimen-tique" /> {t('taxonomieHotesPage.title')}
          </h1>
          <p className="text-xs text-fg-subtle mt-0.5">{t('taxonomieHotesPage.subtitle')}</p>
        </div>
        {canEdit && (
          <button onClick={openCreateRoot} className="btn-primary">
            <Plus size={16} /> {t('taxonomieHotesPage.newOrdre')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-fg-subtle text-sm">
          <Loader2 size={18} className="animate-spin mr-2" /> {t('taxonomieHotesPage.loading')}
        </div>
      ) : tree.length === 0 ? (
        <div className="card p-12 text-center text-fg-subtle text-sm">{t('taxonomieHotesPage.noTaxonomy')}</div>
      ) : (
        <div className="card overflow-hidden">
          <div
            className="datatable-scroll overflow-y-auto p-2"
            style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '200px' }}
          >
            {tree.map((n) => (
              <TreeNode key={n.id} node={n}
                onAddChild={openCreateChild} onEdit={openEdit}
                onToggle={toggleActif} onDelete={remove}
                canEdit={canEdit} canDelete={canDelete}
                expandedIds={expandedIds} setExpandedIds={setExpandedIds} niveauLabel={niveauLabel} />
            ))}
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <form onSubmit={submit} className="bg-surface rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-4 sm:mt-16">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-fg">
                {editing.id ? t('taxonomieHotesPage.modifierTaxonomie') : t('taxonomieHotesPage.nouvelleTaxonomie')}
              </h2>
              <button type="button" onClick={() => setEditing(null)} className="p-1 text-fg-subtle hover:text-fg">
                <X size={18} />
              </button>
            </div>

            {submitErr && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs text-danger">{submitErr}</div>
            )}

            {editing.parentLabel && (
              <div className="text-xs text-fg-muted bg-surface-2 px-3 py-2 rounded-lg">
                {t('taxonomieHotesPage.parent')} <span className="font-medium text-fg">{editing.parentLabel}</span>
              </div>
            )}

            <FormField label={t('taxonomieHotesPage.niveauLabel')} name="niveau" type="select"
              value={editing.niveau}
              onChange={(e) => setEditing({ ...editing, niveau: e.target.value })}
              options={niveaux} required disabled={!!editing.id} />

            <FormField label={t('taxonomieHotesPage.nomLabel')} name="nom" required
              value={editing.nom}
              onChange={(e) => setEditing({ ...editing, nom: e.target.value })}
              placeholder={t('taxonomieHotesPage.nomPlaceholder')} />

            <FormField label={t('taxonomieHotesPage.nomCommunLabel')} name="nomCommun"
              value={editing.nomCommun}
              onChange={(e) => setEditing({ ...editing, nomCommun: e.target.value })}
              placeholder={t('taxonomieHotesPage.nomCommunPlaceholder')} />

            <FormField label={t('taxonomieHotesPage.descriptionLabel')} name="description" type="textarea"
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })} />

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">{t('taxonomieHotesPage.cancel')}</button>
              <button type="submit" className="btn-primary">{editing.id ? t('taxonomieHotesPage.save') : t('taxonomieHotesPage.create')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
