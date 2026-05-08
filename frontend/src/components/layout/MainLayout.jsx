import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, MapPin, Bug, BookOpen, Beaker, PawPrint, Users, Search,
  Menu, X, LogOut, FlaskConical,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import ThemeToggle from '../ThemeToggle';
import { Badge } from '../ui';

const NAV_ITEMS = [
  { path: '/dashboard',     label: 'Tableau de bord', icon: LayoutDashboard },
  { path: '/recherche',     label: 'Explorer',        icon: Search          },
  { path: '/projets',       label: 'Projets',         icon: FolderOpen      },
  { path: '/missions',      label: 'Missions',        icon: MapPin          },
  { path: '/methodes',      label: 'Méthodes',        icon: Beaker          },
  { path: '/hotes',         label: 'Hôtes',           icon: PawPrint        },
  { path: '/dictionnaire',  label: 'Dictionnaire',    icon: BookOpen        },
];

const ADMIN_NAV = [
  { path: '/utilisateurs',  label: 'Utilisateurs',    icon: Users           },
];

const SPECIMEN_ITEMS = [
  { path: '/specimens/moustiques', label: 'Moustiques', color: 'text-specimen-moustique' },
  { path: '/specimens/tiques',     label: 'Tiques',     color: 'text-specimen-tique'     },
  { path: '/specimens/puces',      label: 'Puces',      color: 'text-specimen-puce'      },
];

const ROLE_TONE = {
  admin:     'role-admin',
  chercheur: 'role-chercheur',
  terrain:   'role-terrain',
  lecteur:   'role-lecteur',
};

// Item de navigation — extracted pour ne pas dupliquer la logique active/inactive
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
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const closeSidebar = () => setSidebarOpen(false);
  const initials = `${user?.prenom?.[0] ?? ''}${user?.nom?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="flex h-screen bg-bg overflow-hidden">

      {/* ── BACKDROP MOBILE ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm" onClick={closeSidebar} />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-surface border-r border-border flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        shadow-card-lg lg:shadow-none
      `}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <FlaskConical size={16} className="text-fg-on-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-fg leading-tight">SpécimenManager</p>
              <p className="text-xs text-fg-subtle leading-tight">IPM — v2.0</p>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1 rounded-md text-fg-subtle hover:text-fg-muted hover:bg-surface-2"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.path} to={item.path} label={item.label} icon={item.icon} onClick={closeSidebar} />
          ))}

          <NavSection>Spécimens</NavSection>
          {SPECIMEN_ITEMS.map(({ path, label, color }) => (
            <NavItem key={path} to={path} label={label} icon={Bug} iconColorIdle={color} onClick={closeSidebar} />
          ))}

          {user?.role === 'admin' && (
            <>
              <NavSection>Administration</NavSection>
              {ADMIN_NAV.map((item) => (
                <NavItem key={item.path} to={item.path} label={item.label} icon={item.icon}
                  iconColorIdle="text-role-admin" onClick={closeSidebar} />
              ))}
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
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── CONTENU PRINCIPAL ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="bg-surface border-b border-border px-4 md:px-6 h-14 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-fg-muted hover:bg-surface-2 transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-fg-subtle capitalize">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <div className="hidden md:flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-fg-subtle">Connecté</span>
            </div>
            <ThemeToggle compact />
          </div>
        </header>

        {/* Page courante */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
