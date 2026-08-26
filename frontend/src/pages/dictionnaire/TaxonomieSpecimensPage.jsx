// Vue arbre + CRUD pour la taxonomie des spécimens.
// Hiérarchie : ordre → famille → sous_famille → genre → sous_genre → espece → sous_espece

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2, ChevronLeft,
  ChevronRight, ChevronDown, ChevronUp, X, Bug, Info, Search, Table2, ListTree,
} from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';
import { useT, interpolate } from '../../lib/i18n';
import { Badge, Select, DataTable, Pagination } from '../../components/ui';

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

const getNiveauDesc = (t) => ({
  ordre:        t('taxonomieSpecimensPage.niveauDescOrdre'),
  famille:      t('taxonomieSpecimensPage.niveauDescFamille'),
  sous_famille: t('taxonomieSpecimensPage.niveauDescSousFamille'),
  genre:        t('taxonomieSpecimensPage.niveauDescGenre'),
  sous_genre:   t('taxonomieSpecimensPage.niveauDescSousGenre'),
  espece:       t('taxonomieSpecimensPage.niveauDescEspece'),
  sous_espece:  t('taxonomieSpecimensPage.niveauDescSousEspece'),
});

const NIVEAU_ENFANT = {
  ordre:        ['famille'],
  famille:      ['sous_famille', 'genre'],
  sous_famille: ['genre'],
  genre:        ['sous_genre', 'espece'],
  sous_genre:   ['espece'],
  espece:       ['sous_espece'],
  sous_espece:  [],
};

const getTypes = (t) => [
  { value: 'moustique', label: t('specimenTypes.moustique') },
  { value: 'tique',     label: t('specimenTypes.tique') },
  { value: 'puce',      label: t('specimenTypes.puce') },
];

const TYPE_COLOR = {
  moustique: 'bg-specimen-moustique/10 text-specimen-moustique border-emerald-100',
  tique:     'bg-specimen-tique/10 text-specimen-tique border-rose-100',
  puce:      'bg-specimen-puce/10 text-specimen-puce border-amber-100',
};

const ITALIC_LEVELS = ['genre', 'sous_genre', 'espece', 'sous_espece'];
const VIEW_STORAGE_KEY = 'taxonomieSpecimens.view';

// Aplatit l'arbre en lignes pour la vue tableau — chaque ligne garde sa
// lignée (noms des ancêtres) pour ne pas perdre le contexte hiérarchique.
function flattenTree(nodes, ancestors = []) {
  const rows = [];
  nodes.forEach((n) => {
    const { enfants, ...rest } = n;
    rows.push({
      ...rest,
      lignee: ancestors.map((a) => a.nom).join(' › '),
      synonymesNoms: (rest.synonymes || []).map((s) => s.nom.toLowerCase()).join(' '),
    });
    if (enfants?.length) rows.push(...flattenTree(enfants, [...ancestors, n]));
  });
  return rows;
}

// ----- panneau d'explication de la hiérarchie, repliable (état mémorisé par utilisateur)
const INFO_STORAGE_KEY = 'taxonomieSpecimens.infoOpen';

function HierarchyInfoPanel() {
  const t = useT();
  const niveaux = getNiveaux(t);
  const niveauDesc = getNiveauDesc(t);
  const [open, setOpen] = useState(() => localStorage.getItem(INFO_STORAGE_KEY) === 'true');

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(INFO_STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <div className="card overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-surface-2 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Info size={15} className="text-primary" /> {t('taxonomieSpecimensPage.comprendreHierarchie')}
        </span>
        {open ? <ChevronUp size={15} className="text-fg-subtle" /> : <ChevronDown size={15} className="text-fg-subtle" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
            {niveaux.map((n) => (
              <div key={n.value} className="flex items-start gap-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle w-24 flex-shrink-0 pt-0.5">
                  {n.label}
                </span>
                <span className="text-xs text-fg-muted leading-relaxed">{niveauDesc[n.value]}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="px-3 py-2.5 bg-surface-2 rounded-xl text-xs text-fg-muted leading-relaxed">
              <span className="font-mono font-semibold text-fg">{t('taxonomieSpecimensPage.note1Tag')}</span> {t('taxonomieSpecimensPage.note1TextPrefix')} <span className="italic">Anopheles sp.</span>{t('taxonomieSpecimensPage.note1TextSuffix')}
            </div>
            <div className="px-3 py-2.5 bg-surface-2 rounded-xl text-xs text-fg-muted leading-relaxed">
              {t('taxonomieSpecimensPage.note2Prefix')} <strong>{t('taxonomieSpecimensPage.note2Strong1')}</strong> {t('taxonomieSpecimensPage.note2Mid1')} <span className="italic">Aedes</span> {t('taxonomieSpecimensPage.note2Mid2')} <span className="italic">Aedes</span>{t('taxonomieSpecimensPage.note2Mid3')} <strong>{t('taxonomieSpecimensPage.note2Strong2')}</strong>{t('taxonomieSpecimensPage.note2Suffix')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----- noeud d'arbre récursif
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
      <div
        className={`group flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-surface-2 transition-colors duration-100 ${!node.actif ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        <button onClick={toggle} className="w-5 h-5 flex items-center justify-center text-fg-subtle hover:text-fg">
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </button>

        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle w-20 flex-shrink-0">
          {niveauLabel[node.niveau]}
        </span>

        <span className={`text-sm text-fg font-medium ${node.niveau === 'genre' || node.niveau === 'espece' ? 'italic' : ''}`}>
          {node.nom}
        </span>

        {node.auteur && (
          <span className="text-xs text-fg-subtle">{node.auteur}{node.annee ? `, ${node.annee}` : ''}</span>
        )}

        {node.type && depth === 0 && (
          <span className={`badge text-[10px] border ${TYPE_COLOR[node.type] || 'bg-surface-2 text-fg-muted border-border-strong'}`}>
            {t(`specimenTypes.${node.type}`)}
          </span>
        )}

        {!node.actif && (
          <span className="badge bg-surface-3 text-fg-muted border border-border-strong">{t('taxonomieHotesPage.inactif')}</span>
        )}

        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {canEdit && enfantsAutorises.length > 0 && (
            <button onClick={() => onAddChild(node)} title={t('taxonomieHotesPage.addChild')}
              className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg">
              <Plus size={13} />
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={() => onToggle(node)} title={node.actif ? t('taxonomieHotesPage.desactiver') : t('taxonomieHotesPage.activer')}
                className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg">
                {node.actif ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              </button>
              <button onClick={() => onEdit(node)} title={t('taxonomieHotesPage.modifier')}
                className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg">
                <Edit2 size={12} />
              </button>
            </>
          )}
          {canDelete && (
            <button onClick={() => onDelete(node)} title={t('taxonomieHotesPage.supprimer')}
              className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg">
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
              expandedIds={expandedIds} setExpandedIds={setExpandedIds} niveauLabel={niveauLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TaxonomieSpecimensPage() {
  const t = useT();
  const niveaux = getNiveaux(t);
  const niveauLabel = Object.fromEntries(niveaux.map((n) => [n.value, n.label]));
  const types = getTypes(t);
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

  const [view, setView] = useState(() => (localStorage.getItem(VIEW_STORAGE_KEY) === 'arbre' ? 'arbre' : 'tableau'));
  const changeView = (v) => { setView(v); localStorage.setItem(VIEW_STORAGE_KEY, v); };
  const [search, setSearch]           = useState('');
  const [filterNiveau, setFilterNiveau] = useState('');
  const [filterActif, setFilterActif]   = useState('all');
  const [sort, setSort]   = useState({ key: 'nom', dir: 'asc' });
  const [page, setPage]   = useState(1);
  const [limit, setLimit] = useState(25);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [filterType]);

  const NIVEAU_RANK = useMemo(() => Object.fromEntries(niveaux.map((n, i) => [n.value, i])), [niveaux]);
  const flatRows = useMemo(() => flattenTree(tree), [tree]);

  const filteredRows = useMemo(() => {
    let rows = flatRows;
    if (filterNiveau)              rows = rows.filter((r) => r.niveau === filterNiveau);
    if (filterActif === 'actifs')  rows = rows.filter((r) => r.actif);
    if (filterActif === 'inactifs') rows = rows.filter((r) => !r.actif);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) =>
        r.nom.toLowerCase().includes(q) ||
        r.nomCommun?.toLowerCase().includes(q) ||
        r.lignee.toLowerCase().includes(q) ||
        r.auteur?.toLowerCase().includes(q) ||
        r.synonymesNoms.includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      let av, bv;
      if (sort.key === 'niveau')      { av = NIVEAU_RANK[a.niveau]; bv = NIVEAU_RANK[b.niveau]; }
      else if (sort.key === 'actif')  { av = a.actif ? 1 : 0; bv = b.actif ? 1 : 0; }
      else                            { av = (a[sort.key] || '').toString().toLowerCase(); bv = (b[sort.key] || '').toString().toLowerCase(); }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [flatRows, filterNiveau, filterActif, search, sort, NIVEAU_RANK]);

  useEffect(() => { setPage(1); }, [search, filterNiveau, filterActif, filterType]);

  const pageCount  = Math.ceil(filteredRows.length / limit) || 1;
  const pagedRows  = filteredRows.slice((page - 1) * limit, page * limit);

  const openCreateRoot = () => {
    setEditing({ niveau: 'ordre', nom: '', type: filterType || 'moustique', auteur: '', annee: '', paysType: '', nomCommun: '', description: '', parentId: null });
    setErr(null);
  };
  const openCreateChild = (parent) => {
    const niveauEnfant = NIVEAU_ENFANT[parent.niveau][0];
    setEditing({
      niveau: niveauEnfant, nom: '', auteur: '', annee: '', paysType: '', nomCommun: '', description: '',
      parentId: parent.id, parentLabel: `${niveauLabel[parent.niveau]} ${parent.nom}`, type: parent.type,
    });
    setErr(null);
  };
  const openEdit = (node) => {
    setEditing({
      id: node.id, niveau: node.niveau, nom: node.nom,
      auteur: node.auteur || '', annee: node.annee || '', paysType: node.paysType || '',
      nomCommun: node.nomCommun || '', description: node.description || '',
      parentId: node.parentId, type: node.type, synonymes: node.synonymes || [],
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
        auteur: editing.auteur, annee: editing.annee, paysType: editing.paysType,
        nomCommun: editing.nomCommun, description: editing.description,
      };
      if (editing.id) await api.put(`/dictionnaire/taxonomie-specimens/${editing.id}`, body);
      else            await api.post(`/dictionnaire/taxonomie-specimens`, body);
      setEditing(null);
      refresh();
    } catch (err) {
      setErr(err.response?.data?.error || t('taxonomieHotesPage.errorGeneric'));
    }
  };

  const toggleActif = async (node) => {
    const action = node.actif ? 'desactiver' : 'activer';
    try {
      await api.patch(`/dictionnaire/taxonomie-specimens/${node.id}/${action}`);
      refresh();
    } catch (err) { toast.error(err.response?.data?.error || t('taxonomieHotesPage.errorGeneric')); }
  };
  const remove = async (node) => {
    const ok = await dialog.confirm({
      title: interpolate(t('taxonomieHotesPage.deleteTitle'), { nom: node.nom }),
      message: t('taxonomieHotesPage.deleteMessage'),
    });
    if (!ok) return;
    try {
      await api.delete(`/dictionnaire/taxonomie-specimens/${node.id}`);
      refresh();
    } catch (err) { toast.error(err.response?.data?.error || t('taxonomieHotesPage.errorGeneric')); }
  };

  const niveauxAutorises = useMemo(() => {
    if (!editing) return niveaux;
    if (editing.id) return niveaux; // niveau non modifiable côté UI
    if (!editing.parentId) return [niveaux[0]];
    return [...niveaux]; // backend valide
  }, [editing, niveaux]);

  const tableColumns = [
    {
      key: 'niveau', label: t('taxonomieHotesPage.niveauLabel'), sortable: true, width: '100px',
      render: (row) => <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{niveauLabel[row.niveau]}</span>,
    },
    {
      key: 'nom', label: t('taxonomieHotesPage.nomLabel'), sortable: true,
      render: (row) => (
        <div className={!row.actif ? 'opacity-50' : ''}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-medium text-fg ${ITALIC_LEVELS.includes(row.niveau) ? 'italic' : ''}`}>{row.nom}</span>
            {row.auteur && <span className="text-xs text-fg-subtle">{row.auteur}{row.annee ? `, ${row.annee}` : ''}</span>}
          </div>
          {row.lignee && <div className="text-[11px] text-fg-subtle mt-0.5 truncate max-w-xs">{row.lignee}</div>}
          {row.synonymes?.length > 0 && (
            <div className="text-[11px] text-fg-subtle mt-0.5 italic truncate max-w-xs">
              {t('taxonomieSpecimensPage.synonymesLabel')} {row.synonymes.map((s) => s.nom).join(', ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'nomCommun', label: t('taxonomieHotesPage.nomCommunLabel'), sortable: true,
      render: (row) => row.nomCommun || <span className="text-fg-subtle">—</span>,
    },
    {
      key: 'type', label: t('taxonomieSpecimensPage.typeSpecimenLabel'), width: '110px',
      render: (row) => row.type
        ? <span className={`badge text-[10px] border ${TYPE_COLOR[row.type] || 'bg-surface-2 text-fg-muted border-border-strong'}`}>{t(`specimenTypes.${row.type}`)}</span>
        : <span className="text-fg-subtle">—</span>,
    },
    {
      key: 'actif', label: t('referentielSimple.colStatut'), sortable: true, width: '90px',
      render: (row) => (
        <Badge tone={row.actif ? 'success' : 'default'} dot>
          {row.actif ? t('referentielSimple.actif') : t('referentielSimple.inactif')}
        </Badge>
      ),
    },
    {
      key: '_actions', label: '', width: '120px', headerClassName: 'text-right', className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {canEdit && (NIVEAU_ENFANT[row.niveau] || []).length > 0 && (
            <button onClick={() => openCreateChild(row)} title={t('taxonomieHotesPage.addChild')}
              className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg">
              <Plus size={13} />
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={() => toggleActif(row)} title={row.actif ? t('taxonomieHotesPage.desactiver') : t('taxonomieHotesPage.activer')}
                className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg">
                {row.actif ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              </button>
              <button onClick={() => openEdit(row)} title={t('taxonomieHotesPage.modifier')}
                className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-primary hover:bg-primary/10 rounded-lg">
                <Edit2 size={12} />
              </button>
            </>
          )}
          {canDelete && (
            <button onClick={() => remove(row)} title={t('taxonomieHotesPage.supprimer')}
              className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-screen-2xl space-y-5">
      <button onClick={() => navigate('/dictionnaire')} className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <ChevronLeft size={16} /> {t('taxonomieHotesPage.backToDictionnaire')}
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-fg flex items-center gap-2">
            <Bug size={20} className="text-specimen-moustique" /> {t('taxonomieSpecimensPage.title')}
          </h1>
          <p className="text-xs text-fg-subtle mt-0.5">{t('taxonomieSpecimensPage.subtitle')}</p>
        </div>
        {canEdit && (
          <button onClick={openCreateRoot} className="btn-primary">
            <Plus size={16} /> {t('taxonomieHotesPage.newOrdre')}
          </button>
        )}
      </div>

      <div className="card p-3 flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-fg-muted">{t('taxonomieSpecimensPage.filterByType')}</span>
          {[{ value: '', label: t('common.all') }, ...types].map((tp) => (
            <button
              key={tp.value}
              onClick={() => setFilter(tp.value)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                filterType === tp.value
                  ? 'bg-primary text-white border-primary-600'
                  : 'bg-surface text-fg-muted border-border-strong hover:bg-surface-2'
              }`}
            >
              {tp.label}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-lg border border-border-strong overflow-hidden flex-shrink-0">
          <button
            onClick={() => changeView('tableau')}
            className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${view === 'tableau' ? 'bg-primary text-white' : 'bg-surface text-fg-muted hover:bg-surface-2'}`}
          >
            <Table2 size={13} /> {t('taxonomieHotesPage.vueTableau')}
          </button>
          <button
            onClick={() => changeView('arbre')}
            className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 border-l border-border-strong transition-colors ${view === 'arbre' ? 'bg-primary text-white' : 'bg-surface text-fg-muted hover:bg-surface-2'}`}
          >
            <ListTree size={13} /> {t('taxonomieHotesPage.vueArbre')}
          </button>
        </div>
      </div>

      <HierarchyInfoPanel />

      {loading ? (
        <div className="flex items-center justify-center h-32 text-fg-subtle text-sm">
          <Loader2 size={18} className="animate-spin mr-2" /> {t('taxonomieHotesPage.loading')}
        </div>
      ) : tree.length === 0 ? (
        <div className="card p-12 text-center text-fg-subtle text-sm">{t('taxonomieHotesPage.noTaxonomy')}</div>
      ) : view === 'arbre' ? (
        <div className="card overflow-hidden">
          <div
            className="datatable-scroll overflow-y-auto p-2"
            style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '200px' }}
          >
            {tree.map((n) => (
              <TreeNode
                key={n.id} node={n}
                onAddChild={openCreateChild} onEdit={openEdit}
                onToggle={toggleActif} onDelete={remove}
                canEdit={canEdit} canDelete={canDelete}
                expandedIds={expandedIds} setExpandedIds={setExpandedIds} niveauLabel={niveauLabel}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="p-3 border-b border-border flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('taxonomieHotesPage.searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border-strong bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg">
                  <X size={13} />
                </button>
              )}
            </div>
            <Select
              value={filterNiveau} onChange={setFilterNiveau}
              wrapperClassName="w-44 flex-shrink-0"
              options={[{ value: '', label: t('common.all') }, ...niveaux]}
            />
            <Select
              value={filterActif} onChange={setFilterActif}
              wrapperClassName="w-48 flex-shrink-0"
              options={[
                { value: 'all',      label: t('referentielSimple.filterAll') },
                { value: 'actifs',   label: t('referentielSimple.filterActifsOnly') },
                { value: 'inactifs', label: t('referentielSimple.filterInactifsOnly') },
              ]}
            />
          </div>
          <DataTable
            columns={tableColumns}
            rows={pagedRows}
            sort={sort}
            onSort={(key, dir) => setSort({ key, dir })}
            minWidth="640px"
            maxHeight="calc(100vh - 400px)"
            empty={
              <span className="text-fg-subtle text-sm">
                {search || filterNiveau || filterActif !== 'all'
                  ? t('referentielSimple.noResultsFilter')
                  : t('taxonomieHotesPage.noTaxonomy')}
              </span>
            }
          />
          {filteredRows.length > 0 && (
            <Pagination
              page={page} pages={pageCount} total={filteredRows.length} limit={limit}
              onChange={setPage}
              onLimitChange={(n) => { setLimit(n); setPage(1); }}
            />
          )}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <form onSubmit={submit} className="bg-surface rounded-2xl shadow-xl w-full max-w-lg my-4 sm:mt-16 overflow-hidden">

            {/* En-tête */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-specimen-moustique/10 flex items-center justify-center">
                  <Bug size={15} className="text-specimen-moustique" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-fg">
                    {editing.id ? t('taxonomieHotesPage.modifierTaxonomie') : t('taxonomieSpecimensPage.nouvelleEntreeTaxonomique')}
                  </h2>
                  {editing.parentLabel && (
                    <p className="text-[10px] text-fg-subtle mt-0.5">
                      {t('taxonomieSpecimensPage.childOfPrefix')} <span className="font-semibold text-fg">{editing.parentLabel}</span>
                    </p>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setEditing(null)}
                className="p-1.5 text-fg-subtle hover:text-fg hover:bg-surface-2 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {submitErr && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs text-danger">{submitErr}</div>
              )}

              {/* Section Classification */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest">{t('taxonomieSpecimensPage.classification')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label={t('taxonomieHotesPage.niveauLabel')} name="niveau" type="select"
                    value={editing.niveau}
                    onChange={(e) => setEditing({ ...editing, niveau: e.target.value })}
                    options={niveauxAutorises} required disabled={!!editing.id}
                  />
                  <FormField
                    label={t('taxonomieSpecimensPage.typeSpecimenLabel')} name="type" type="select"
                    value={editing.type || ''}
                    onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                    options={[{ value: '', label: t('common.select') }, ...types]}
                    required={editing.niveau === 'ordre'}
                    disabled={!!editing.id && editing.niveau !== 'ordre'}
                  />
                </div>
              </div>

              {/* Section Nom scientifique */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest">{t('taxonomieSpecimensPage.nomenclature')}</p>
                <FormField
                  label={t('taxonomieSpecimensPage.nomScientifiqueLabel')} name="nom" required
                  value={editing.nom}
                  onChange={(e) => setEditing({ ...editing, nom: e.target.value })}
                  placeholder={editing.niveau === 'genre' ? t('taxonomieSpecimensPage.exGenre') : editing.niveau === 'espece' ? t('taxonomieSpecimensPage.exEspece') : t('taxonomieSpecimensPage.exDefault')}
                  hint={['genre', 'sous_genre', 'espece', 'sous_espece'].includes(editing.niveau) ? t('taxonomieSpecimensPage.hintItalicDisplay') : undefined}
                />

                {/* Preview */}
                {editing.nom && (
                  <div className="px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs text-fg-muted">
                    <span className="text-[10px] uppercase tracking-wide text-fg-subtle mr-2">{niveauLabel[editing.niveau]}</span>
                    <span className={['genre', 'sous_genre', 'espece', 'sous_espece'].includes(editing.niveau) ? 'italic font-semibold text-fg' : 'font-semibold text-fg'}>
                      {editing.nom}
                    </span>
                    {editing.auteur && <span className="text-fg-subtle ml-1.5">{editing.auteur}{editing.annee ? `, ${editing.annee}` : ''}</span>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label={t('taxonomieSpecimensPage.auteurLabel')} name="auteur"
                    value={editing.auteur}
                    onChange={(e) => setEditing({ ...editing, auteur: e.target.value })}
                    placeholder={t('taxonomieSpecimensPage.auteurPlaceholder')}
                  />
                  <FormField
                    label={t('taxonomieSpecimensPage.anneeLabel')} name="annee" type="number"
                    value={editing.annee}
                    onChange={(e) => setEditing({ ...editing, annee: e.target.value })}
                    placeholder={t('taxonomieSpecimensPage.anneePlaceholder')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label={t('taxonomieHotesPage.nomCommunLabel')} name="nomCommun"
                    value={editing.nomCommun}
                    onChange={(e) => setEditing({ ...editing, nomCommun: e.target.value })}
                    placeholder={t('taxonomieSpecimensPage.nomCommunPlaceholder')}
                  />
                  <FormField
                    label={t('taxonomieSpecimensPage.paysTypeLabel')} name="paysType"
                    value={editing.paysType}
                    onChange={(e) => setEditing({ ...editing, paysType: e.target.value })}
                    placeholder={t('taxonomieSpecimensPage.paysTypePlaceholder')}
                    hint={t('taxonomieSpecimensPage.paysTypeHint')}
                  />
                </div>

                {editing.synonymes?.length > 0 && (
                  <div className="px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-xs text-fg-muted">
                    <span className="text-[10px] uppercase tracking-wide text-fg-subtle mr-2">{t('taxonomieSpecimensPage.synonymesLabel')}</span>
                    {editing.synonymes.map((s, i) => (
                      <span key={s.id} className="italic">
                        {i > 0 && ', '}{s.nom}{s.auteur ? ` (${s.auteur}${s.annee ? `, ${s.annee}` : ''})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Description optionnelle */}
              <FormField
                label={t('taxonomieSpecimensPage.descriptionOptional')} name="description" type="textarea"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder={t('taxonomieSpecimensPage.descPlaceholder')}
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-surface-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">{t('taxonomieHotesPage.cancel')}</button>
              <button type="submit" className="btn-primary">
                {editing.id ? t('taxonomieSpecimensPage.saveModifications') : t('taxonomieSpecimensPage.createTaxonomy')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
