import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, MapPin, Bug, BookOpen, Beaker, PawPrint, Users, Search,
  Menu, X, LogOut, ChevronRight, FlaskConical,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

const NAV_ITEMS = [
  { path: '/dashboard',            label: 'Tableau de bord', icon: LayoutDashboard },
  { path: '/recherche',            label: 'Explorer',        icon: Search          },
  { path: '/projets',              label: 'Projets',         icon: FolderOpen      },
  { path: '/missions',             label: 'Missions',        icon: MapPin          },
  { path: '/methodes',             label: 'Méthodes',        icon: Beaker          },
  { path: '/hotes',                label: 'Hôtes',           icon: PawPrint        },
  { path: '/dictionnaire',         label: 'Dictionnaire',    icon: BookOpen        },
];

const ADMIN_NAV = [
  { path: '/utilisateurs',         label: 'Utilisateurs',    icon: Users           },
];

const SPECIMEN_ITEMS = [
  { path: '/specimens/moustiques', label: 'Moustiques', color: 'text-emerald-600' },
  { path: '/specimens/tiques',     label: 'Tiques',     color: 'text-rose-600'   },
  { path: '/specimens/puces',      label: 'Puces',      color: 'text-amber-600'  },
];

const ROLE_COLORS = {
  admin:     'bg-primary-100 text-primary-700',
  chercheur: 'bg-blue-100 text-blue-700',
  terrain:   'bg-amber-100 text-amber-700',
  lecteur:   'bg-gray-100 text-gray-600',
};

export default function MainLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  const initials = `${user?.prenom?.[0] ?? ''}${user?.nom?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── BACKDROP MOBILE ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-gray-100 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        shadow-xl lg:shadow-none
      `}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <FlaskConical size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 leading-tight">SpécimenManager</p>
              <p className="text-xs text-gray-400 leading-tight">IPM — v2.0</p>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} className={isActive ? 'text-white' : 'text-gray-400'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}

          {/* Section Spécimens */}
          <div className="pt-4 pb-1">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Spécimens
            </p>
          </div>

          {SPECIMEN_ITEMS.map(({ path, label, color }) => (
            <NavLink
              key={path}
              to={path}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Bug size={17} className={isActive ? 'text-white' : color} />
                  {label}
                </>
              )}
            </NavLink>
          ))}

          {/* Section Administration (admin uniquement) */}
          {user?.role === 'admin' && (
            <>
              <div className="pt-4 pb-1">
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Administration
                </p>
              </div>
              {ADMIN_NAV.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={17} className={isActive ? 'text-white' : 'text-purple-500'} />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Profil utilisateur */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary-700">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {user?.prenom} {user?.nom}
              </p>
              <span className={`badge text-xs ${ROLE_COLORS[user?.role] ?? 'bg-gray-100 text-gray-600'}`}>
                {user?.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── CONTENU PRINCIPAL ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="bg-white border-b border-gray-100 px-4 md:px-6 h-14 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Menu size={20} />
          </button>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 capitalize">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
              <span className="text-xs text-gray-400 hidden sm:block">Connecté</span>
            </div>
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
