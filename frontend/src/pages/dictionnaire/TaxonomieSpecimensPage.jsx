// Vue arbre + CRUD pour la taxonomie des spécimens.
// Hiérarchie : ordre → famille → sous_famille → genre → sous_genre → espece → sous_espece

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2, ChevronLeft,
  ChevronRight, ChevronDown, X, Bug,
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
  ordre:        ['famille'],
  famille:      ['sous_famille', 'genre'],
  sous_famille: ['genre'],
  genre:        ['sous_genre', 'espece'],
  sous_genre:   ['espece'],
  espece:       ['sous_espece'],
  sous_espece:  [],
};

const TYPES = [
  { value: 'moustique', label: 'Moustique' },
  { value: 'tique',     label: 'Tique' },
  { value: 'puce',      label: 'Puce' },
];

const TYPE_COLOR = {
  moustique: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  tique:     'bg-rose-50 text-rose-700 border-rose-100',
  puce:      'bg-amber-50 text-amber-700 border-amber-100',
};

// ----- noeud d'arbre récursif
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
      <div
        className={`group flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 ${!node.actif ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        <button onClick={toggle} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700">
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </button>

        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-20 flex-shrink-0">
          {NIVEAU_LABEL[node.niveau]}
        </span>

        <span className={`text-sm text-gray-800 font-medium ${node.niveau === 'genre' || node.niveau === 'espece' ? 'italic' : ''}`}>
          {node.nom}
        </span>

        {node.auteur && (
          <span className="text-xs text-gray-400">{node.auteur}{node.annee ? `, ${node.annee}` : ''}</span>
        )}

        {node.type && depth === 0 && (
          <span className={`badge text-[10px] border ${TYPE_COLOR[node.type] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {node.type}
          </span>
        )}

        {!node.actif && (
          <span className="badge bg-gray-100 text-gray-500 border border-gray-200">Inactif</span>
        )}

        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {canEdit && enfantsAutorises.length > 0 && (
            <button onClick={() => onAddChild(node)} title="Ajouter un enfant"
              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
              <Plus size={13} />
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={() => onToggle(node)} title={node.actif ? 'Désactiver' : 'Activer'}
                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                {node.actif ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              </button>
              <button onClick={() => onEdit(node)} title="Modifier"
                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                <Edit2 size={12} />
              </button>
            </>
          )}
          {canDelete && (
            <button onClick={() => onDelete(node)} title="Supprimer"
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.enfants.map((c) => (
            <TreeNode
              key={c.id} node={c} depth={depth + 1}
              onAddChild={onAddChild} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete}
              canEdit={canEdit} canDelete={canDelete}
              expandedIds={expandedIds} setExpandedIds={setExpandedIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TaxonomieSpecimensPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canEdit   = isMin(user?.role, 'chercheur');
  const canDelete = user?.role === 'admin';

  const [tree, setTree]         = useState([]);
  const [filterType, setFilter] = useState(''); // '' | moustique | tique | puce
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null);
  const [submitErr, setErr]     = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await api.get('/dictionnaire/taxonomie-specimens/tree', { params: filterType ? { type: filterType } : {} });
      setTree(r.data.tree);
      // expand top 2 levels by default
      const ids = new Set();
      const collect = (nodes, level) => {
        nodes.forEach((n) => {
          if (level < 2) ids.add(n.id);
          if (n.enfants?.length) collect(n.enfants, level + 1);
        });
      };
      collect(r.data.tree, 0);
      setExpandedIds(ids);
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [filterType]);

  const openCreateRoot = () => {
    setEditing({ niveau: 'ordre', nom: '', type: filterType || 'moustique', auteur: '', annee: '', nomCommun: '', description: '', parentId: null });
    setErr(null);
  };
  const openCreateChild = (parent) => {
    const niveauEnfant = NIVEAU_ENFANT[parent.niveau][0];
    setEditing({
      niveau: niveauEnfant, nom: '', auteur: '', annee: '', nomCommun: '', description: '',
      parentId: parent.id, parentLabel: `${NIVEAU_LABEL[parent.niveau]} ${parent.nom}`, type: parent.type,
    });
    setErr(null);
  };
  const openEdit = (node) => {
    setEditing({
      id: node.id, niveau: node.niveau, nom: node.nom,
      auteur: node.auteur || '', annee: node.annee || '',
      nomCommun: node.nomCommun || '', description: node.description || '',
      parentId: node.parentId, type: node.type,
    });
    setErr(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      const body = {
        niveau: editing.niveau, nom: editing.nom,
        parentId: editing.parentId, type: editing.type,
        auteur: editing.auteur, annee: editing.annee,
        nomCommun: editing.nomCommun, description: editing.description,
      };
      if (editing.id) await api.put(`/dictionnaire/taxonomie-specimens/${editing.id}`, body);
      else            await api.post(`/dictionnaire/taxonomie-specimens`, body);
      setEditing(null);
      refresh();
    } catch (err) {
      setErr(err.response?.data?.error || 'Erreur');
    }
  };

  const toggleActif = async (node) => {
    const action = node.actif ? 'desactiver' : 'activer';
    try {
      await api.patch(`/dictionnaire/taxonomie-specimens/${node.id}/${action}`);
      refresh();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };
  const remove = async (node) => {
    if (!confirm(`Supprimer "${node.nom}" ?`)) return;
    try {
      await api.delete(`/dictionnaire/taxonomie-specimens/${node.id}`);
      refresh();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const niveauxAutorises = useMemo(() => {
    if (!editing) return NIVEAUX;
    if (editing.id) return NIVEAUX; // niveau non modifiable côté UI
    if (!editing.parentId) return [{ value: 'ordre', label: 'Ordre' }];
    return NIVEAUX.filter((n) => true); // backend valide
  }, [editing]);

  return (
    <div className="max-w-5xl space-y-5">
      <button onClick={() => navigate('/dictionnaire')} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700">
        <ChevronLeft size={16} /> Dictionnaire
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Bug size={20} className="text-emerald-600" /> Taxonomie spécimens
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Hiérarchie scientifique — ordre → … → sous-espèce</p>
        </div>
        {canEdit && (
          <button onClick={openCreateRoot} className="btn-primary">
            <Plus size={16} /> Nouvel ordre
          </button>
        )}
      </div>

      <div className="card p-3 flex items-center gap-2">
        <span className="text-xs text-gray-500">Filtrer par type :</span>
        {[{ value: '', label: 'Tous' }, ...TYPES].map((t) => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filterType === t.value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
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
            <TreeNode
              key={n.id} node={n}
              onAddChild={openCreateChild} onEdit={openEdit}
              onToggle={toggleActif} onDelete={remove}
              canEdit={canEdit} canDelete={canDelete}
              expandedIds={expandedIds} setExpandedIds={setExpandedIds}
            />
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

            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Niveau" name="niveau" type="select"
                value={editing.niveau}
                onChange={(e) => setEditing({ ...editing, niveau: e.target.value })}
                options={niveauxAutorises} required disabled={!!editing.id}
              />
              {editing.niveau === 'ordre' && (
                <FormField
                  label="Type spécimen" name="type" type="select"
                  value={editing.type || ''}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                  options={TYPES} required
                />
              )}
            </div>

            <FormField
              label="Nom" name="nom" required
              value={editing.nom}
              onChange={(e) => setEditing({ ...editing, nom: e.target.value })}
              placeholder="ex: Anopheles, gambiae"
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Auteur" name="auteur"
                value={editing.auteur}
                onChange={(e) => setEditing({ ...editing, auteur: e.target.value })}
                placeholder="ex: Giles"
              />
              <FormField
                label="Année" name="annee" type="number"
                value={editing.annee}
                onChange={(e) => setEditing({ ...editing, annee: e.target.value })}
                placeholder="ex: 1902"
              />
            </div>

            <FormField
              label="Nom commun" name="nomCommun"
              value={editing.nomCommun}
              onChange={(e) => setEditing({ ...editing, nomCommun: e.target.value })}
            />

            <FormField
              label="Description" name="description" type="textarea"
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />

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
