import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, MapPin, BookOpen, PawPrint, Users, Upload,
  Menu, X, LogOut, FlaskConical, Map, Radio, Microscope,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import ThemeToggle from '../ThemeToggle';
import { Badge } from '../ui';
import SpecimenIcon from '../SpecimenIcon';
import GlobalSearch from '../GlobalSearch';
import NotificationBell from '../NotificationBell';
import Footer from './Footer';
import Clock from './Clock';
import { useT } from '../../lib/i18n';
import { canBypass, ROLE_TONE as ROLE_TONE_MAP } from '../../lib/roles';

const ROLE_TONE = {
  ...ROLE_TONE_MAP,
  admin:       'role-admin',
  superviseur: 'role-superviseur',
  chercheur:   'role-chercheur',
  technicien:  'role-terrain',
  lecteur:     'role-lecteur',
};

function NavItem({ to, label, icon: Icon, iconColorIdle, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-primary text-fg-on-primary shadow-card'
            : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={17} className={isActive ? 'text-fg-on-primary' : (iconColorIdle || 'text-fg-subtle')} />
          {label}
        </>
      )}
    </NavLink>
  );
}

function NavSection({ children }) {
  return (
    <div className="pt-4 pb-1">
      <p className="px-3 text-xs font-semibold text-fg-subtle uppercase tracking-wider">{children}</p>
    </div>
  );
}

export default function MainLayout() {
  const { user, logout } = useAuthStore();
  const navigate         = useNavigate();
  const t                = useT();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const closeSidebar = () => setSidebarOpen(false);
  const initials = `${user?.prenom?.[0] ?? ''}${user?.nom?.[0] ?? ''}`.toUpperCase();

  // Nav dynamique (traduite)
  const NAV_ITEMS = [
    { path: '/dashboard',    label: t('nav.dashboard'),    icon: LayoutDashboard },
    { path: '/recherche',    label: t('nav.explorer'),     icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> },
    { path: '/carte',        label: t('nav.carte'),        icon: Map             },
    { path: '/projets',      label: t('nav.projets'),      icon: FolderOpen      },
    { path: '/missions',     label: t('nav.missions'),     icon: MapPin          },
    { path: '/hotes',        label: t('nav.hotes'),        icon: PawPrint        },
    { path: '/dictionnaire', label: t('nav.dictionnaire'), icon: BookOpen        },
    { path: '/import',       label: t('nav.import'),       icon: Upload          },
  ];

  const SPECIMEN_ITEMS = [
    { path: '/specimens/moustiques', label: t('nav.moustiques'), type: 'moustique' },
    { path: '/specimens/tiques',     label: t('nav.tiques'),     type: 'tique'     },
    { path: '/specimens/puces',      label: t('nav.puces'),      type: 'puce'      },
    { path: '/specimens/autres',     label: 'Autres spécimens',  type: 'autre'     },
  ];

  return (
    <div className="flex h-screen bg-bg overflow-hidden">

      {/* ── BACKDROP MOBILE ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm" onClick={closeSidebar} />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 xl:w-72 2xl:w-80 bg-surface border-r border-border flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        shadow-card-lg lg:shadow-none
      `}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-card flex-shrink-0">
              <FlaskConical size={20} className="text-fg-on-primary" />
            </div>
            <div>
              <p className="text-base font-bold text-fg leading-tight tracking-tight">
                Spécimen<span className="text-primary">Manager</span>
              </p>
              <p className="text-[10px] text-fg-subtle leading-tight">{t('sidebar.subtitle')}</p>
            </div>
          </div>
          <button onClick={closeSidebar} className="lg:hidden p-1 rounded-md text-fg-subtle hover:text-fg-muted hover:bg-surface-2">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.path} to={item.path} label={item.label} icon={item.icon} onClick={closeSidebar} />
          ))}

          <NavSection>Laboratoire</NavSection>
          <NavItem to="/labo" label="Manipulations labo" icon={Microscope} iconColorIdle="text-warning" onClick={closeSidebar} />

          <NavSection>{t('nav.specimens')}</NavSection>
          {SPECIMEN_ITEMS.filter(({ type }) =>
            canBypass(user?.role) || (user?.specimensAutorises || []).includes(type)
          ).map(({ path, label, type }) => (
            <NavLink
              key={path} to={path} onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-fg-on-primary shadow-card'
                    : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
                }`
              }
            >
              {() => (
                <>
                  <SpecimenIcon type={type} size={17} className="flex-shrink-0" />
                  {label}
                </>
              )}
            </NavLink>
          ))}

          {canBypass(user?.role) && (
            <>
              <NavSection>{t('nav.admin')}</NavSection>
              {user?.role === 'admin' && (
                <NavItem to="/utilisateurs" label={t('nav.utilisateurs')} icon={Users}
                  iconColorIdle="text-role-admin" onClick={closeSidebar} />
              )}
              <NavItem to="/admin/presence" label={t('nav.presence')} icon={Radio}
                iconColorIdle="text-success" onClick={closeSidebar} />
            </>
          )}
        </nav>

        {/* Profil utilisateur */}
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-fg truncate">{user?.prenom} {user?.nom}</p>
              <Badge tone={ROLE_TONE[user?.role] ?? 'default'} size="xs" className="mt-0.5">{user?.role}</Badge>
            </div>
            <button onClick={handleLogout} title={t('common.logout')}
              className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── CONTENU PRINCIPAL ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="bg-surface border-b border-border px-4 md:px-6 h-14 flex items-center flex-shrink-0 gap-3">
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-fg-muted hover:bg-surface-2 transition-colors flex-shrink-0">
            <Menu size={20} />
          </button>

          {/* Marque — visible quand la sidebar est masquée (mobile/tablette) */}
          <div className="flex items-center gap-2 lg:hidden flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <FlaskConical size={14} className="text-fg-on-primary" />
            </div>
            <span className="hidden sm:inline text-sm font-bold text-fg tracking-tight whitespace-nowrap">
              Spécimen<span className="text-primary">Manager</span>
            </span>
          </div>

          {/* Recherche globale */}
          <div className="flex-1 flex justify-center max-w-2xl mx-auto min-w-0">
            <GlobalSearch />
          </div>

          {/* Droite : date, heure, statut, thème */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <Clock />
            <div className="hidden md:flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-fg-subtle">{t('topbar.connected')}</span>
            </div>
            <NotificationBell />
            <ThemeToggle compact />
          </div>
        </header>

        {/* Page courante */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 2xl:p-8">
          <Outlet />
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
