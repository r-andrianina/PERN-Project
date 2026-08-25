import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Users, UserPlus, Search, X, Edit2, Trash2, KeyRound,
  ShieldCheck, ToggleLeft, ToggleRight, Loader2, Check,
  Clock, UserCheck, Eye, EyeOff,
} from 'lucide-react';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';
import { Card, DataTable, Pagination, Select } from '../../components/ui';
import { useT, interpolate } from '../../lib/i18n';
import { roleLabel, roleDescription, ROLE_COLORS } from '../../lib/roles';

// ── Constantes ────────────────────────────────────────────────
const ROLE_VALUES = ['admin', 'superviseur', 'chercheur', 'technicien', 'lecteur'];
const getRoles = () => ROLE_VALUES.map((value) => ({ value, label: roleLabel(value), color: ROLE_COLORS[value] }));
const roleInfo = () => Object.fromEntries(getRoles().map((r) => [r.value, r]));

const getSpecimens = (t) => [
  { value: 'moustique', label: t('specimenTypes.moustique'), color: 'bg-specimen-moustique/10 text-specimen-moustique border-specimen-moustique/20' },
  { value: 'tique',     label: t('specimenTypes.tique'),     color: 'bg-specimen-tique/10 text-specimen-tique border-specimen-tique/20'             },
  { value: 'puce',      label: t('specimenTypes.puce'),      color: 'bg-specimen-puce/10 text-specimen-puce border-specimen-puce/20'                },
  { value: 'autre',     label: t('utilisateursPage.autresLabel'), color: 'bg-fg-subtle/10 text-fg-muted border-border'                              },
];

// ── Helpers ───────────────────────────────────────────────────
const initials = (u) => `${u?.prenom?.[0] ?? ''}${u?.nom?.[0] ?? ''}`.toUpperCase();

const AvatarCircle = ({ user, size = 'md' }) => {
  const colors = {
    admin:       'bg-role-admin/10 text-role-admin',
    superviseur: 'bg-purple-100 text-purple-700',
    chercheur:   'bg-role-chercheur/10 text-role-chercheur',
    technicien:  'bg-role-terrain/10 text-role-terrain',
    lecteur:     'bg-surface-3 text-fg-muted',
  };
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sz} rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${colors[user.role] ?? 'bg-surface-3 text-fg-muted'}`}>
      {initials(user)}
    </div>
  );
};

// ── Modal permissions spécimens ───────────────────────────────
function SpecimenAccessModal({ user, onClose, onSaved }) {
  const t = useT();
  const specimens = getSpecimens(t);
  const [selected, setSelected] = useState(user.specimensAutorises || []);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const toggle = (type) => setSelected(s =>
    s.includes(type) ? s.filter(x => x !== type) : [...s, type]
  );

  const submit = async () => {
    setError(null); setLoading(true);
    try {
      await api.patch(`/auth/users/${user.id}/specimens`, { specimensAutorises: selected });
      onSaved();
    } catch (err) { setError(err.response?.data?.error || t('utilisateursPage.errorGeneric')); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden my-4 sm:my-auto sm:mt-16">
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">{t('utilisateursPage.accessSpecimensTitle')}</h2>
            <p className="text-xs text-primary-100">{user.prenom} {user.nom}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">{error}</div>}
          <p className="text-xs text-fg-muted">{t('utilisateursPage.accessSpecimensHint')}</p>
          <div className="space-y-2">
            {specimens.map(s => (
              <button key={s.value} type="button" onClick={() => toggle(s.value)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  selected.includes(s.value) ? s.color + ' border-current' : 'border-border text-fg-muted hover:bg-surface-2'
                }`}>
                <span>{s.label}</span>
                {selected.includes(s.value) && <Check size={15} />}
              </button>
            ))}
          </div>
          {selected.length === 0 && (
            <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-xl px-3 py-2">
              {t('utilisateursPage.noSpecimenSelected')}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t('utilisateursPage.cancel')}</button>
            <button type="button" disabled={loading} onClick={submit} className="btn-primary">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {t('utilisateursPage.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal création / édition ──────────────────────────────────
function UserModal({ user, onClose, onSaved }) {
  const t = useT();
  const roles = getRoles();
  const isEdit = !!user?.id;
  const [form, setForm] = useState({
    nom: user?.nom ?? '', prenom: user?.prenom ?? '',
    email: user?.email ?? '', role: user?.role ?? 'lecteur',
    actif: user?.actif ?? true, password: '',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      if (isEdit) await api.put(`/auth/users/${user.id}`, { nom: form.nom, prenom: form.prenom, email: form.email, role: form.role });
      else        await api.post('/auth/users', form);
      onSaved();
    } catch (err) { setError(err.response?.data?.error || t('utilisateursPage.errorGeneric')); }
    finally { setLoading(false); }
  };

  const inputCls = 'w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-colors';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden my-4 sm:my-auto sm:mt-16">
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface/20 flex items-center justify-center">
              {isEdit ? <Edit2 size={16} className="text-white" /> : <UserPlus size={16} className="text-white" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEdit ? t('utilisateursPage.modifierUtilisateur') : t('utilisateursPage.nouvelUtilisateur')}
              </h2>
              {isEdit && <p className="text-xs text-primary-100">{user.prenom} {user.nom}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-surface/20 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">{t('utilisateursPage.prenomLabel')} <span className="text-red-400">*</span></label>
              <input value={form.prenom} onChange={(e) => set('prenom', e.target.value)} required className={inputCls} placeholder={t('utilisateursPage.prenomPlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">{t('utilisateursPage.nomLabel')} <span className="text-red-400">*</span></label>
              <input value={form.nom} onChange={(e) => set('nom', e.target.value)} required className={inputCls} placeholder={t('utilisateursPage.nomPlaceholder')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600">{t('utilisateursPage.emailLabel')} <span className="text-red-400">*</span></label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required className={inputCls} placeholder={t('utilisateursPage.emailPlaceholder')} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600">{t('utilisateursPage.roleLabel')} <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map((r) => (
                <button key={r.value} type="button" onClick={() => set('role', r.value)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left flex items-center gap-2 ${
                    form.role === r.value ? `${r.color} border-2` : 'border-border-strong text-fg-muted hover:bg-surface-2'
                  }`}>
                  {form.role === r.value && <Check size={13} />}
                  {r.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-fg-subtle">
              {roleDescription(form.role)}
            </p>
          </div>
          {!isEdit && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">{t('utilisateursPage.passwordLabel')} <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)}
                    required minLength={10} className={`${inputCls} pr-10`} placeholder={t('utilisateursPage.passwordPlaceholder')} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl">
                <button type="button" onClick={() => set('actif', !form.actif)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.actif ? 'bg-primary-500' : 'bg-gray-300'}`}>
                  <span className={`absolute left-0.5 top-0.5 w-4 h-4 bg-surface rounded-full shadow transition-transform ${form.actif ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-fg">{t('utilisateursPage.accountActiveImmediately')}</p>
                  <p className="text-xs text-fg-subtle">{form.actif ? t('utilisateursPage.accountActiveHint') : t('utilisateursPage.accountInactiveHint')}</p>
                </div>
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t('utilisateursPage.cancel')}</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {isEdit ? t('utilisateursPage.save') : t('utilisateursPage.createAccount')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal réinitialisation mot de passe ───────────────────────
function ResetPasswordModal({ user, onClose }) {
  const t = useT();
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState(null);

  const submit = async (e) => {
    e.preventDefault(); setError(null); setLoading(true);
    try { await api.patch(`/auth/users/${user.id}/reset-password`, { password }); setDone(true); }
    catch (err) { setError(err.response?.data?.error || t('utilisateursPage.errorGeneric')); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden my-4 sm:my-auto sm:mt-16">
        <div className="bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface/20 flex items-center justify-center">
              <KeyRound size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{t('utilisateursPage.newPasswordTitle')}</h2>
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
              <p className="text-sm font-medium text-fg">{t('utilisateursPage.passwordResetDone')}</p>
              <p className="text-xs text-fg-muted">{t('utilisateursPage.passwordResetHint')}</p>
              <button onClick={onClose} className="btn-primary mx-auto mt-2">{t('utilisateursPage.close')}</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">{error}</div>}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">{t('utilisateursPage.newPasswordLabel')} <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    required minLength={10}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 pr-10"
                    placeholder={t('utilisateursPage.passwordPlaceholder')} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="btn-secondary">{t('utilisateursPage.cancel')}</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-warning/100 hover:bg-amber-600 text-white text-sm font-medium rounded-xl flex items-center gap-2 transition-colors">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  {t('utilisateursPage.reset')}
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
  const t = useT();
  const roles = getRoles();
  const specimens = getSpecimens(t);
  const { user: me } = useAuthStore();

  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filterRole,  setFilterRole]  = useState('');
  const [filterActif, setFilterActif] = useState('');
  const [modal,       setModal]       = useState(null);
  const [page,        setPage]        = useState(1);
  const [limit,       setLimit]       = useState(25);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/auth/users');
      setUsers([...r.data.actifs, ...r.data.en_attente]);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Réinitialiser la page sur changement de filtre
  useEffect(() => { setPage(1); }, [search, filterRole, filterActif]);

  const stats = {
    total:        users.length,
    actifs:       users.filter((u) => u.actif).length,
    enAttente:    users.filter((u) => !u.actif).length,
    admins:       users.filter((u) => u.role === 'admin').length,
    superviseurs: users.filter((u) => u.role === 'superviseur').length,
    chercheurs:   users.filter((u) => u.role === 'chercheur').length,
  };
  const pending = users.filter((u) => !u.actif);

  const filtered = users.filter((u) => {
    if (filterActif === 'actifs'  && !u.actif)  return false;
    if (filterActif === 'attente' &&  u.actif)   return false;
    if (filterRole && u.role !== filterRole)      return false;
    if (search) {
      const s = search.toLowerCase();
      return `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(s);
    }
    return true;
  });

  const pageCount = Math.ceil(filtered.length / limit) || 1;
  const paged     = filtered.slice((page - 1) * limit, page * limit);

  const toggleActif = useCallback(async (u) => {
    try { await api.patch(`/auth/users/${u.id}/activate`, { actif: !u.actif }); refresh(); }
    catch (err) { toast.error(err.response?.data?.error || t('utilisateursPage.errorGeneric')); }
  }, [refresh, t]);
  const changeRole = useCallback(async (u, role) => {
    try { await api.patch(`/auth/users/${u.id}/activate`, { role }); refresh(); }
    catch (err) { toast.error(err.response?.data?.error || t('utilisateursPage.errorGeneric')); }
  }, [refresh, t]);
  const remove = useCallback(async (u) => {
    const ok = await dialog.confirm({
      title: t('utilisateursPage.deleteAccountTitle'),
      message: interpolate(t('utilisateursPage.deleteAccountMessage'), { name: `${u.prenom} ${u.nom}` }),
    });
    if (!ok) return;
    try { await api.delete(`/auth/users/${u.id}`); refresh(); }
    catch (err) { toast.error(err.response?.data?.error || t('utilisateursPage.errorGeneric')); }
  }, [refresh, t]);

  const closeModal = () => setModal(null);
  const onSaved    = () => { closeModal(); refresh(); };

  // Colonnes — dépendent de me, toggleActif, changeRole, remove, setModal
  const columns = useMemo(() => [
    {
      key: 'nom',
      label: t('utilisateursPage.colUtilisateur'),
      skeletonWidth: '70%',
      render: (u) => (
        <div className="flex items-center gap-3">
          <AvatarCircle user={u} />
          <div>
            <p className="font-semibold text-fg text-sm">
              {u.prenom} {u.nom}
              {u.id === me?.id && (
                <span className="ml-2 text-[10px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full font-medium">{t('utilisateursPage.youBadge')}</span>
              )}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: t('utilisateursPage.colEmail'),
      skeletonWidth: '80%',
      hidden: 'hidden md:table-cell',
      className: 'text-fg-muted text-xs',
      render: (u) => u.email,
    },
    {
      key: 'role',
      label: t('utilisateursPage.colRole'),
      skeletonWidth: '55%',
      render: (u) => (
        <Select
          value={u.role}
          onChange={(val) => changeRole(u, val)}
          disabled={u.id === me?.id}
          hideChevron={u.id === me?.id}
          wrapperClassName="inline-block"
          buttonClassName={`w-full flex items-center justify-between gap-1 text-left text-xs font-semibold pl-2.5 pr-2 py-1.5 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300 ${roleInfo()[u.role]?.color || 'bg-surface-3 text-fg-muted border-border-strong'}`}
          chevronClassName="text-current opacity-70"
          options={roles.map((r) => ({ value: r.value, label: r.label }))}
        />
      ),
    },
    {
      key: 'specimens',
      label: t('utilisateursPage.colSpecimens'),
      skeletonWidth: '65%',
      hidden: 'hidden lg:table-cell',
      render: (u) => (
        <div className="flex gap-1 flex-wrap">
          {(u.role === 'admin' || u.role === 'superviseur') ? (
            <span className="text-xs text-fg-subtle italic">{t('utilisateursPage.allSpecimens')}</span>
          ) : (u.specimensAutorises || []).length === 0 ? (
            <span className="text-xs text-danger">{t('utilisateursPage.noSpecimens')}</span>
          ) : (
            (u.specimensAutorises || []).map(s => (
              <span key={s} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${specimens.find(x => x.value === s)?.color || ''}`}>
                {specimens.find(x => x.value === s)?.label ?? s}
              </span>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'statut',
      label: t('utilisateursPage.colStatut'),
      skeletonWidth: '50%',
      render: (u) => u.actif ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 border border-success/20 px-2.5 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-success" /> {t('utilisateursPage.actif')}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/10 border border-role-terrain/20 px-2.5 py-0.5 rounded-full">
          <Clock size={10} /> {t('utilisateursPage.enAttente')}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: t('utilisateursPage.colInscritLe'),
      skeletonWidth: '60%',
      hidden: 'hidden lg:table-cell',
      className: 'text-fg-subtle text-xs whitespace-nowrap',
      render: (u) => new Date(u.createdAt).toLocaleDateString(t('common.locale')),
    },
    {
      key: 'actions',
      label: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (u) => {
        const isMe = u.id === me?.id;
        return (
          <div className="flex items-center justify-end gap-1">
            {!isMe && (
              <button onClick={() => toggleActif(u)} title={u.actif ? t('utilisateursPage.desactiver') : t('utilisateursPage.activer')}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                {u.actif ? <ToggleRight size={16} className="text-success" /> : <ToggleLeft size={16} />}
              </button>
            )}
            <button onClick={() => setModal({ type: 'edit', user: u })} title={t('utilisateursPage.modifier')}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
              <Edit2 size={14} />
            </button>
            {u.role !== 'admin' && u.role !== 'superviseur' && (
              <button onClick={() => setModal({ type: 'specimens', user: u })} title={t('utilisateursPage.gererAccesSpecimens')}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-specimen-moustique hover:bg-specimen-moustique/10 rounded-lg transition-colors">
                <ShieldCheck size={14} />
              </button>
            )}
            <button onClick={() => setModal({ type: 'reset', user: u })} title={t('utilisateursPage.reinitialiserMdp')}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-amber-600 hover:bg-warning/10 rounded-lg transition-colors">
              <KeyRound size={14} />
            </button>
            {!isMe && (
              <button onClick={() => remove(u)} title={t('utilisateursPage.supprimer')}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      },
    },
  ], [me?.id, toggleActif, changeRole, remove, setModal, t, roles, specimens]);

  return (
    <div className="max-w-screen-2xl space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-fg flex items-center gap-2">
            <Users size={20} className="text-primary-600" /> {t('utilisateursPage.pageTitle')}
          </h1>
          <p className="text-xs text-fg-subtle mt-0.5">{t('utilisateursPage.pageSubtitle')}</p>
        </div>
        <button onClick={() => setModal({ type: 'create' })} className="btn-primary">
          <UserPlus size={16} /> {t('utilisateursPage.newUserBtn')}
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: t('utilisateursPage.statTotal'),        value: stats.total,        icon: Users,       bg: 'bg-surface-2',        text: 'text-gray-600'        },
          { label: t('utilisateursPage.statActifs'),       value: stats.actifs,       icon: UserCheck,   bg: 'bg-success/10',       text: 'text-success'         },
          { label: t('utilisateursPage.statEnAttente'),    value: stats.enAttente,    icon: Clock,       bg: 'bg-warning/10',       text: 'text-warning'         },
          { label: t('utilisateursPage.statAdmins'),       value: stats.admins,       icon: ShieldCheck, bg: 'bg-role-admin/10',    text: 'text-role-admin'      },
          { label: t('utilisateursPage.statSuperviseurs'), value: stats.superviseurs, icon: ShieldCheck, bg: 'bg-purple-50',        text: 'text-purple-700'      },
          { label: t('utilisateursPage.statChercheurs'),   value: stats.chercheurs,   icon: Users,       bg: 'bg-role-chercheur/10',text: 'text-role-chercheur'  },
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

      {/* Comptes en attente */}
      {pending.length > 0 && (
        <div className="card border-l-4 border-amber-400 overflow-hidden">
          <div className="px-5 py-3 bg-warning/10 border-b border-amber-100 flex items-center gap-2">
            <Clock size={15} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">
              {pending.length} {t('utilisateursPage.pendingAccountsWord')}{pending.length > 1 ? 's' : ''} {t('utilisateursPage.pendingAccountsSuffix')}
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
                  {new Date(u.createdAt).toLocaleDateString(t('common.locale'))}
                </p>
                <div className="flex items-center gap-2">
                  <Select
                    value={u.role} onChange={(val) => changeRole(u, val)}
                    wrapperClassName="w-32"
                    buttonClassName="w-full flex items-center justify-between gap-1 text-left text-xs px-2 py-1.5 rounded-lg border border-border-strong bg-surface text-fg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300"
                    options={roles.map((r) => ({ value: r.value, label: r.label }))}
                  />
                  <button onClick={() => toggleActif(u)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-success hover:brightness-110 text-white text-xs font-semibold rounded-lg transition-colors">
                    <Check size={12} /> {t('utilisateursPage.activate')}
                  </button>
                  <button onClick={() => remove(u)}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-colors">
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
            placeholder={t('utilisateursPage.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle">
              <X size={13} />
            </button>
          )}
        </div>
        <Select value={filterRole} onChange={setFilterRole} wrapperClassName="w-44 flex-shrink-0"
          options={[{ value: '', label: t('utilisateursPage.allRoles') }, ...roles.map((r) => ({ value: r.value, label: r.label }))]}
        />
        <Select value={filterActif} onChange={setFilterActif} wrapperClassName="w-44 flex-shrink-0"
          options={[{ value: '', label: t('utilisateursPage.allStatuses') }, { value: 'actifs', label: t('utilisateursPage.actifsOnly') }, { value: 'attente', label: t('utilisateursPage.enAttente') }]}
        />
        <span className="text-xs text-fg-subtle ml-auto">{interpolate(t('utilisateursPage.usersCount'), { n: filtered.length })}</span>
      </div>

      {/* Table principale */}
      <Card padding="none" className="overflow-hidden">
        <DataTable
          columns={columns}
          rows={paged}
          loading={loading}
          skeletonRows={8}
          rowClassName={(u) => !u.actif ? 'opacity-60' : ''}
          minWidth="680px"
          maxHeight="calc(100vh - 460px)"
          empty={<span className="text-fg-subtle text-sm">{t('utilisateursPage.noUserFound')}</span>}
        />
        <Pagination
          page={page} pages={pageCount} total={filtered.length} limit={limit}
          onChange={setPage}
          onLimitChange={(n) => { setLimit(n); setPage(1); }}
        />
      </Card>

      {/* Modals */}
      {modal?.type === 'create' && <UserModal onClose={closeModal} onSaved={onSaved} />}
      {modal?.type === 'edit'   && <UserModal user={modal.user} onClose={closeModal} onSaved={onSaved} />}
      {modal?.type === 'reset'  && <ResetPasswordModal user={modal.user} onClose={closeModal} />}
      {modal?.type === 'specimens' && <SpecimenAccessModal user={modal.user} onClose={closeModal} onSaved={onSaved} />}
    </div>
  );
}
