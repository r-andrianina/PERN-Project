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

const ROLES = { admin: 4, chercheur: 3, terrain: 2, lecteur: 1 };
const isMin = (r, m) => (ROLES[r] || 0) >= ROLES[m];

const NIVEAUX = [
  { value: 'ordre',        label: 'Ordre' },
  { value: 'famille',      label: 'Famille' },
  { value: 'sous_famille', label: 'Sous-famille' },
  { value: 'genre',        label: 'Genre' },
  { value: 'sous_genre',   label: 'Sous-genre' },
  { value: 'espece',       label: 'Espèce' },
  { value: 'sous_espece',  label: 'Sous-espèce' },
];
const NIVEAU_LABEL = Object.fromEntries(NIVEAUX.map((n) => [n.value, n.label]));

const NIVEAU_ENFANT = {
  ordre:        ['famille'], famille: ['sous_famille', 'genre'],
  sous_famille: ['genre'],   genre:   ['sous_genre', 'espece'],
  sous_genre:   ['espece'],  espece:  ['sous_espece'], sous_espece: [],
};

function TreeNode({ node, depth = 0, onAddChild, onEdit, onToggle, onDelete, canEdit, canDelete, expandedIds, setExpandedIds }) {
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
      <div className={`group flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 ${!node.actif ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${8 + depth * 20}px` }}>
        <button onClick={toggle} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700">
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-20 flex-shrink-0">
          {NIVEAU_LABEL[node.niveau]}
        </span>
        <span className={`text-sm text-gray-800 font-medium ${node.niveau === 'genre' || node.niveau === 'espece' ? 'italic' : ''}`}>
          {node.nom}
        </span>
        {node.nomCommun && <span className="text-xs text-gray-400">({node.nomCommun})</span>}
        {!node.actif && <span className="badge bg-gray-100 text-gray-500 border border-gray-200">Inactif</span>}

        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {canEdit && enfantsAutorises.length > 0 && (
            <button onClick={() => onAddChild(node)} title="Ajouter un enfant" className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
              <Plus size={13} />
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={() => onToggle(node)} title={node.actif ? 'Désactiver' : 'Activer'} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                {node.actif ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              </button>
              <button onClick={() => onEdit(node)} title="Modifier" className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                <Edit2 size={12} />
              </button>
            </>
          )}
          {canDelete && (
            <button onClick={() => onDelete(node)} title="Supprimer" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
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
              expandedIds={expandedIds} setExpandedIds={setExpandedIds} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TaxonomieHotesPage() {
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
      parentId: parent.id, parentLabel: `${NIVEAU_LABEL[parent.niveau]} ${parent.nom}` });
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
    } catch (err) { setErr(err.response?.data?.error || 'Erreur'); }
  };

  const toggleActif = async (n) => {
    try {
      await api.patch(`/dictionnaire/taxonomie-hotes/${n.id}/${n.actif ? 'desactiver' : 'activer'}`);
      refresh();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };
  const remove = async (n) => {
    if (!confirm(`Supprimer "${n.nom}" ?`)) return;
    try { await api.delete(`/dictionnaire/taxonomie-hotes/${n.id}`); refresh(); }
    catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  return (
    <div className="max-w-5xl space-y-5">
      <button onClick={() => navigate('/dictionnaire')} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700">
        <ChevronLeft size={16} /> Dictionnaire
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Rabbit size={20} className="text-rose-600" /> Taxonomie hôtes
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Animaux hôtes (mammifères, oiseaux…)</p>
        </div>
        {canEdit && (
          <button onClick={openCreateRoot} className="btn-primary">
            <Plus size={16} /> Nouvel ordre
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          <Loader2 size={18} className="animate-spin mr-2" /> Chargement…
        </div>
      ) : tree.length === 0 ? (
        <div className="card p-12 text-center text-gray-400 text-sm">Aucune taxonomie</div>
      ) : (
        <div className="card p-2">
          {tree.map((n) => (
            <TreeNode key={n.id} node={n}
              onAddChild={openCreateChild} onEdit={openEdit}
              onToggle={toggleActif} onDelete={remove}
              canEdit={canEdit} canDelete={canDelete}
              expandedIds={expandedIds} setExpandedIds={setExpandedIds} />
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800">
                {editing.id ? 'Modifier la taxonomie' : 'Nouvelle taxonomie'}
              </h2>
              <button type="button" onClick={() => setEditing(null)} className="p-1 text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            {submitErr && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{submitErr}</div>
            )}

            {editing.parentLabel && (
              <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                Parent : <span className="font-medium text-gray-700">{editing.parentLabel}</span>
              </div>
            )}

            <FormField label="Niveau" name="niveau" type="select"
              value={editing.niveau}
              onChange={(e) => setEditing({ ...editing, niveau: e.target.value })}
              options={NIVEAUX} required disabled={!!editing.id} />

            <FormField label="Nom" name="nom" required
              value={editing.nom}
              onChange={(e) => setEditing({ ...editing, nom: e.target.value })}
              placeholder="ex: Rattus, rattus" />

            <FormField label="Nom commun" name="nomCommun"
              value={editing.nomCommun}
              onChange={(e) => setEditing({ ...editing, nomCommun: e.target.value })}
              placeholder="ex: Rat noir" />

            <FormField label="Description" name="description" type="textarea"
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })} />

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Annuler</button>
              <button type="submit" className="btn-primary">{editing.id ? 'Enregistrer' : 'Créer'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
