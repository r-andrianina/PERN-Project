import { useEffect, useState } from 'react';
import {
  Users, UserPlus, Search, X, Edit2, Trash2, KeyRound,
  ShieldCheck, ToggleLeft, ToggleRight, Loader2, Check,
  Clock, UserCheck, ChevronDown, Eye, EyeOff,
} from 'lucide-react';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';

// ── Constantes ────────────────────────────────────────────────
const ROLES = [
  { value: 'admin',     label: 'Admin',     color: 'bg-role-admin/10 text-role-admin border-role-admin/20' },
  { value: 'chercheur', label: 'Chercheur', color: 'bg-role-chercheur/10 text-role-chercheur border-role-chercheur/20'       },
  { value: 'terrain',   label: 'Terrain',   color: 'bg-role-terrain/10 text-role-terrain border-role-terrain/20'    },
  { value: 'lecteur',   label: 'Lecteur',   color: 'bg-surface-3 text-fg-muted border-border-strong'       },
];
const roleInfo = Object.fromEntries(ROLES.map((r) => [r.value, r]));

// ── Helpers ───────────────────────────────────────────────────
const initials = (u) => `${u?.prenom?.[0] ?? ''}${u?.nom?.[0] ?? ''}`.toUpperCase();

const AvatarCircle = ({ user, size = 'md' }) => {
  const colors = {
    admin:     'bg-role-admin/10 text-role-admin',
    chercheur: 'bg-role-chercheur/10 text-role-chercheur',
    terrain:   'bg-role-terrain/10 text-role-terrain',
    lecteur:   'bg-surface-3 text-fg-muted',
  };
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sz} rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${colors[user.role] ?? 'bg-surface-3 text-fg-muted'}`}>
      {initials(user)}
    </div>
  );
};

// ── Composant badge rôle ──────────────────────────────────────
const RoleBadge = ({ role }) => {
  const info = roleInfo[role];
  if (!info) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${info.color}`}>
      {info.label}
    </span>
  );
};

// ── Modal création / édition ──────────────────────────────────
function UserModal({ user, onClose, onSaved, currentUserId }) {
  const isEdit = !!user?.id;
  const [form, setForm] = useState({
    nom:      user?.nom      ?? '',
    prenom:   user?.prenom   ?? '',
    email:    user?.email    ?? '',
    role:     user?.role     ?? 'lecteur',
    actif:    user?.actif    ?? true,
    password: '',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/auth/users/${user.id}`, {
          nom: form.nom, prenom: form.prenom,
          email: form.email, role: form.role,
        });
      } else {
        await api.post('/auth/users', form);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-colors';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface/20 flex items-center justify-center">
              {isEdit ? <Edit2 size={16} className="text-white" /> : <UserPlus size={16} className="text-white" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEdit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </h2>
              {isEdit && (
                <p className="text-xs text-primary-100">{user.prenom} {user.nom}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Prénom <span className="text-red-400">*</span></label>
              <input value={form.prenom} onChange={(e) => set('prenom', e.target.value)} required className={inputCls} placeholder="ex: Henintsoa" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Nom <span className="text-red-400">*</span></label>
              <input value={form.nom} onChange={(e) => set('nom', e.target.value)} required className={inputCls} placeholder="ex: Andrianina" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600">Email <span className="text-red-400">*</span></label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required className={inputCls} placeholder="ex: h.andrianina@pasteur.mg" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600">Rôle <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => set('role', r.value)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left flex items-center gap-2 ${
                    form.role === r.value
                      ? `${r.color} border-2`
                      : 'border-border-strong text-fg-muted hover:bg-surface-2'
                  }`}
                >
                  {form.role === r.value && <Check size={13} />}
                  {r.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-fg-subtle">
              {{
                admin:     'Accès total — gestion des utilisateurs, référentiels, données',
                chercheur: 'Création et modification de toutes les données scientifiques',
                terrain:   'Saisie de spécimens et méthodes de collecte uniquement',
                lecteur:   'Consultation uniquement — aucune modification possible',
              }[form.role]}
            </p>
          </div>

          {!isEdit && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Mot de passe <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.password} onChange={(e) => set('password', e.target.value)}
                    required minLength={8}
                    className={`${inputCls} pr-10`}
                    placeholder="8 caractères minimum"
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-gray-600">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl">
                <button
                  type="button"
                  onClick={() => set('actif', !form.actif)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.actif ? 'bg-primary-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-surface rounded-full shadow transition-transform ${form.actif ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-fg">Compte actif immédiatement</p>
                  <p className="text-xs text-fg-subtle">{form.actif ? 'L\'utilisateur peut se connecter dès maintenant' : 'Le compte nécessitera une activation manuelle'}</p>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {isEdit ? 'Enregistrer' : 'Créer le compte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal réinitialisation mot de passe ───────────────────────
function ResetPasswordModal({ user, onClose }) {
  const [password,  setPassword]  = useState('');
  const [showPwd,   setShowPwd]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.patch(`/auth/users/${user.id}/reset-password`, { password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface/20 flex items-center justify-center">
              <KeyRound size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Nouveau mot de passe</h2>
              <p className="text-xs text-amber-100">{user.prenom} {user.nom}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {done ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                <Check size={20} className="text-success" />
              </div>
              <p className="text-sm font-medium text-fg">Mot de passe réinitialisé</p>
              <p className="text-xs text-fg-muted">Communiquez le nouveau mot de passe à l'utilisateur de manière sécurisée.</p>
              <button onClick={onClose} className="btn-primary mx-auto mt-2">Fermer</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">{error}</div>}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Nouveau mot de passe <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    required minLength={8}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 pr-10"
                    placeholder="8 caractères minimum"
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-gray-600">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-warning/100 hover:bg-amber-600 text-white text-sm font-medium rounded-xl flex items-center gap-2 transition-colors">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  Réinitialiser
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PAGE PRINCIPALE ────────────────────────────────────────────
export default function UtilisateursPage() {
  const { user: me } = useAuthStore();

  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActif, setFilterActif] = useState('');
  const [modal,     setModal]     = useState(null); // { type: 'create'|'edit'|'reset', user? }

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await api.get('/auth/users');
      setUsers([...r.data.actifs, ...r.data.en_attente]);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  // Stats
  const stats = {
    total:      users.length,
    actifs:     users.filter((u) => u.actif).length,
    enAttente:  users.filter((u) => !u.actif).length,
    admins:     users.filter((u) => u.role === 'admin').length,
    chercheurs: users.filter((u) => u.role === 'chercheur').length,
  };
  const pending = users.filter((u) => !u.actif);

  // Filtre
  const filtered = users.filter((u) => {
    if (filterActif === 'actifs'   && !u.actif)  return false;
    if (filterActif === 'attente'  && u.actif)   return false;
    if (filterRole && u.role !== filterRole)      return false;
    if (search) {
      const s = search.toLowerCase();
      return `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(s);
    }
    return true;
  });

  const toggleActif = async (u) => {
    try {
      await api.patch(`/auth/users/${u.id}/activate`, { actif: !u.actif });
      refresh();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const changeRole = async (u, role) => {
    try {
      await api.patch(`/auth/users/${u.id}/activate`, { role });
      refresh();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const remove = async (u) => {
    if (!confirm(`Supprimer le compte de ${u.prenom} ${u.nom} ?`)) return;
    try {
      await api.delete(`/auth/users/${u.id}`);
      refresh();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const closeModal = () => setModal(null);
  const onSaved    = () => { closeModal(); refresh(); };

  return (
    <div className="max-w-6xl space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-fg flex items-center gap-2">
            <Users size={20} className="text-primary-600" /> Gestion des utilisateurs
          </h1>
          <p className="text-xs text-fg-subtle mt-0.5">Administration des accès à SpécimenManager</p>
        </div>
        <button onClick={() => setModal({ type: 'create' })} className="btn-primary">
          <UserPlus size={16} /> Nouvel utilisateur
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total',      value: stats.total,      icon: Users,      bg: 'bg-surface-2',    text: 'text-gray-600'   },
          { label: 'Actifs',     value: stats.actifs,     icon: UserCheck,  bg: 'bg-success/10', text: 'text-success' },
          { label: 'En attente', value: stats.enAttente,  icon: Clock,      bg: 'bg-warning/10',   text: 'text-warning'  },
          { label: 'Admins',     value: stats.admins,     icon: ShieldCheck,bg: 'bg-role-admin/10',  text: 'text-role-admin' },
          { label: 'Chercheurs', value: stats.chercheurs, icon: Users,      bg: 'bg-role-chercheur/10',    text: 'text-role-chercheur'   },
        ].map(({ label, value, icon: Icon, bg, text }) => (
          <div key={label} className={`card p-4 flex items-center gap-3 ${bg}`}>
            <Icon size={20} className={text} />
            <div>
              <p className={`text-xl font-bold ${text}`}>{value}</p>
              <p className="text-xs text-fg-muted">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Section "En attente de validation" */}
      {pending.length > 0 && (
        <div className="card border-l-4 border-amber-400 overflow-hidden">
          <div className="px-5 py-3 bg-warning/10 border-b border-amber-100 flex items-center gap-2">
            <Clock size={15} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">
              {pending.length} compte{pending.length > 1 ? 's' : ''} en attente de validation
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {pending.map((u) => (
              <div key={u.id} className="px-5 py-3.5 flex items-center gap-4">
                <AvatarCircle user={u} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fg">{u.prenom} {u.nom}</p>
                  <p className="text-xs text-fg-subtle truncate">{u.email}</p>
                </div>
                <p className="text-xs text-fg-subtle hidden sm:block">
                  {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                </p>
                <div className="flex items-center gap-2">
                  <select
                    defaultValue={u.role}
                    onChange={(e) => changeRole(u, e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-lg border border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <button
                    onClick={() => toggleActif(u)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-success hover:brightness-110 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Check size={12} /> Activer
                  </button>
                  <button
                    onClick={() => remove(u)}
                    className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barre de filtres */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle"><X size={13} /></button>}
        </div>

        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl border border-border-strong focus:outline-none">
          <option value="">Tous les rôles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        <select value={filterActif} onChange={(e) => setFilterActif(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl border border-border-strong focus:outline-none">
          <option value="">Tous les statuts</option>
          <option value="actifs">Actifs uniquement</option>
          <option value="attente">En attente</option>
        </select>

        <span className="text-xs text-fg-subtle ml-auto">{filtered.length} utilisateur(s)</span>
      </div>

      {/* Table principale */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-fg-subtle text-sm">
          <Loader2 size={18} className="animate-spin mr-2" /> Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center text-fg-subtle text-sm">Aucun utilisateur trouvé</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 border-b border-border">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted tracking-wide">Utilisateur</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted tracking-wide">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted tracking-wide">Rôle</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted tracking-wide">Statut</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted tracking-wide">Inscrit le</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-fg-muted tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u) => {
                const isMe = u.id === me?.id;
                return (
                  <tr key={u.id} className={`hover:bg-surface-2/60 transition-colors ${!u.actif ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <AvatarCircle user={u} />
                        <div>
                          <p className="font-semibold text-fg text-sm">
                            {u.prenom} {u.nom}
                            {isMe && <span className="ml-2 text-[10px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full font-medium">Vous</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-fg-muted text-xs">{u.email}</td>
                    <td className="px-5 py-3.5">
                      {/* Dropdown rôle inline */}
                      <div className="relative inline-block">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u, e.target.value)}
                          disabled={isMe}
                          className={`text-xs font-semibold pl-2.5 pr-6 py-1.5 rounded-full border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-300 ${roleInfo[u.role]?.color || 'bg-surface-3 text-fg-muted border-border-strong'} disabled:cursor-not-allowed`}
                        >
                          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        {!isMe && <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-70" />}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.actif ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 border border-success/20 px-2.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-success/100" /> Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/10 border border-role-terrain/20 px-2.5 py-0.5 rounded-full">
                          <Clock size={10} /> En attente
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-fg-subtle text-xs">
                      {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {/* Toggle actif */}
                        {!isMe && (
                          <button
                            onClick={() => toggleActif(u)}
                            title={u.actif ? 'Désactiver' : 'Activer'}
                            className="p-1.5 text-fg-subtle hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            {u.actif ? <ToggleRight size={16} className="text-success" /> : <ToggleLeft size={16} />}
                          </button>
                        )}
                        {/* Modifier */}
                        <button
                          onClick={() => setModal({ type: 'edit', user: u })}
                          title="Modifier"
                          className="p-1.5 text-fg-subtle hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        {/* Reset mdp */}
                        <button
                          onClick={() => setModal({ type: 'reset', user: u })}
                          title="Réinitialiser le mot de passe"
                          className="p-1.5 text-fg-subtle hover:text-amber-600 hover:bg-warning/10 rounded-lg transition-colors"
                        >
                          <KeyRound size={14} />
                        </button>
                        {/* Supprimer */}
                        {!isMe && (
                          <button
                            onClick={() => remove(u)}
                            title="Supprimer"
                            className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'create' && (
        <UserModal onClose={closeModal} onSaved={onSaved} currentUserId={me?.id} />
      )}
      {modal?.type === 'edit' && (
        <UserModal user={modal.user} onClose={closeModal} onSaved={onSaved} currentUserId={me?.id} />
      )}
      {modal?.type === 'reset' && (
        <ResetPasswordModal user={modal.user} onClose={closeModal} />
      )}
    </div>
  );
}
