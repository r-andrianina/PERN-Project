// frontend/src/router/index.jsx
//
// Fichier de config du routeur : le seul export est `router` (un objet de
// config, pas un composant), donc react-refresh ne peut de toute façon pas
// faire du hot-reload fin ici quoi qu'on fasse — une édition de ce fichier
// recharge toujours la page entière. Désactivé au niveau du fichier plutôt
// que ligne par ligne sur chacun des ~40 composants lazy() ci-dessous.
/* eslint-disable react-refresh/only-export-components */

import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { hasMinRole } from '../lib/roles';
import { Spinner } from '../components/ui';
import RouteErrorBoundary from '../components/RouteErrorBoundary';

// Chargement synchrone : pages critiques (premier rendu visible)
import LoginPage    from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import MainLayout   from '../components/layout/MainLayout';

// Chargement différé : toutes les autres pages (code splitting)
const DashboardPage       = lazy(() => import('../pages/dashboard/DashboardPage'));
const ProjetsPage         = lazy(() => import('../pages/projets/ProjetsPage'));
const ProjetDetail        = lazy(() => import('../pages/projets/ProjetDetail'));
const NouveauProjet       = lazy(() => import('../pages/projets/NouveauProjet'));
const MissionsPage        = lazy(() => import('../pages/missions/MissionsPage'));
const MissionDetail       = lazy(() => import('../pages/missions/MissionDetail'));
const NouvelleMission     = lazy(() => import('../pages/missions/NouvelleMission'));
const MoustiquesPage      = lazy(() => import('../pages/specimens/MoustiquesPage'));
const NouveauMoustique    = lazy(() => import('../pages/specimens/NouveauMoustique'));
const MoustiqueDetail     = lazy(() => import('../pages/specimens/MoustiqueDetail'));
const TiquesPage          = lazy(() => import('../pages/specimens/TiquesPage'));
const NouveauTique        = lazy(() => import('../pages/specimens/NouveauTique'));
const TiqueDetail         = lazy(() => import('../pages/specimens/TiqueDetail'));
const PucesPage           = lazy(() => import('../pages/specimens/PucesPage'));
const NouveauPuce         = lazy(() => import('../pages/specimens/NouveauPuce'));
const PuceDetail          = lazy(() => import('../pages/specimens/PuceDetail'));
const AutresSpecimensPage = lazy(() => import('../pages/specimens/AutresSpecimensPage'));
const NouvelAutreSpecimen = lazy(() => import('../pages/specimens/NouvelAutreSpecimen'));
const AutreSpecimenDetail = lazy(() => import('../pages/specimens/AutreSpecimenDetail'));
const LaboPage            = lazy(() => import('../pages/labo/LaboPage'));
const NouvelleManipulation = lazy(() => import('../pages/labo/NouvelleManipulation'));
const ManipulationDetail  = lazy(() => import('../pages/labo/ManipulationDetail'));
const HotesPage           = lazy(() => import('../pages/hotes/HotesPage'));
const NouvelHote          = lazy(() => import('../pages/hotes/NouvelHote'));
const HoteDetail          = lazy(() => import('../pages/hotes/HoteDetail'));
const DictionnairePage          = lazy(() => import('../pages/dictionnaire/DictionnairePage'));
const TaxonomieSpecimensPage    = lazy(() => import('../pages/dictionnaire/TaxonomieSpecimensPage'));
const TaxonomieHotesPage        = lazy(() => import('../pages/dictionnaire/TaxonomieHotesPage'));
const TypesMethodePage          = lazy(() => import('../pages/dictionnaire/TypesMethodePage'));
const SolutionsConservationPage = lazy(() => import('../pages/dictionnaire/SolutionsConservationPage'));
const TypesEnvironnementPage    = lazy(() => import('../pages/dictionnaire/TypesEnvironnementPage'));
const TypesHabitatPage          = lazy(() => import('../pages/dictionnaire/TypesHabitatPage'));
const AuditLogsPage             = lazy(() => import('../pages/dictionnaire/AuditLogsPage'));
const TypesAutreSpecimenPage    = lazy(() => import('../pages/dictionnaire/TypesAutreSpecimenPage'));
const PathogenesCiblesPage      = lazy(() => import('../pages/dictionnaire/PathogenesCiblesPage'));
const UtilisateursPage    = lazy(() => import('../pages/utilisateurs/UtilisateursPage'));
const AdminPresencePage   = lazy(() => import('../pages/admin/AdminPresencePage'));
const RecherchePage       = lazy(() => import('../pages/recherche/RecherchePage'));
const ImportPage          = lazy(() => import('../pages/import/ImportPage'));
const CartePage           = lazy(() => import('../pages/carte/CartePage'));
const NotificationsPage   = lazy(() => import('../pages/notifications/NotificationsPage'));

function PageLoader() {
  return <Spinner.Block height="h-64" />;
}

const ProtectedRoute = ({ children }) => {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const token = useAuthStore((s) => s.token);
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
};

const MinRoleRoute = ({ children, minRole }) => {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!hasMinRole(user?.role, minRole)) return <Navigate to="/dashboard" replace />;
  return children;
};

const router = createBrowserRouter([
  { path: '/login',    element: <PublicRoute><LoginPage /></PublicRoute>, errorElement: <RouteErrorBoundary /> },
  { path: '/register', element: <PublicRoute><RegisterPage /></PublicRoute>, errorElement: <RouteErrorBoundary /> },
  {
    path: '/',
    element: <ProtectedRoute><MainLayout /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true,                        element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard',                  element: <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense> },

      // Projets
      { path: 'projets',                    element: <Suspense fallback={<PageLoader />}><ProjetsPage /></Suspense> },
      { path: 'projets/nouveau',            element: <MinRoleRoute minRole="chercheur"><Suspense fallback={<PageLoader />}><NouveauProjet /></Suspense></MinRoleRoute> },
      { path: 'projets/:id',                element: <Suspense fallback={<PageLoader />}><ProjetDetail /></Suspense> },

      // Missions
      { path: 'missions',                   element: <Suspense fallback={<PageLoader />}><MissionsPage /></Suspense> },
      { path: 'missions/nouvelle',          element: <Suspense fallback={<PageLoader />}><NouvelleMission /></Suspense> },
      { path: 'missions/:id',               element: <Suspense fallback={<PageLoader />}><MissionDetail /></Suspense> },

      // Hôtes
      { path: 'hotes',                      element: <Suspense fallback={<PageLoader />}><HotesPage /></Suspense> },
      { path: 'hotes/nouveau',              element: <Suspense fallback={<PageLoader />}><NouvelHote /></Suspense> },
      { path: 'hotes/:id',                  element: <Suspense fallback={<PageLoader />}><HoteDetail /></Suspense> },

      // Recherche / explorer
      { path: 'recherche',                  element: <Suspense fallback={<PageLoader />}><RecherchePage /></Suspense> },
      { path: 'carte',                      element: <Suspense fallback={<PageLoader />}><CartePage /></Suspense> },
      { path: 'import',                     element: <Suspense fallback={<PageLoader />}><ImportPage /></Suspense> },
      { path: 'notifications',              element: <Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense> },

      // Spécimens
      { path: 'specimens/moustiques',         element: <Suspense fallback={<PageLoader />}><MoustiquesPage /></Suspense> },
      { path: 'specimens/moustiques/nouveau', element: <Suspense fallback={<PageLoader />}><NouveauMoustique /></Suspense> },
      { path: 'specimens/moustiques/:id',     element: <Suspense fallback={<PageLoader />}><MoustiqueDetail /></Suspense> },
      { path: 'specimens/tiques',             element: <Suspense fallback={<PageLoader />}><TiquesPage /></Suspense> },
      { path: 'specimens/tiques/nouveau',     element: <Suspense fallback={<PageLoader />}><NouveauTique /></Suspense> },
      { path: 'specimens/tiques/:id',         element: <Suspense fallback={<PageLoader />}><TiqueDetail /></Suspense> },
      { path: 'specimens/puces',              element: <Suspense fallback={<PageLoader />}><PucesPage /></Suspense> },
      { path: 'specimens/puces/nouveau',      element: <Suspense fallback={<PageLoader />}><NouveauPuce /></Suspense> },
      { path: 'specimens/puces/:id',          element: <Suspense fallback={<PageLoader />}><PuceDetail /></Suspense> },
      { path: 'specimens/autres',             element: <Suspense fallback={<PageLoader />}><AutresSpecimensPage /></Suspense> },
      { path: 'specimens/autres/nouveau',     element: <Suspense fallback={<PageLoader />}><NouvelAutreSpecimen /></Suspense> },
      { path: 'specimens/autres/:id',         element: <Suspense fallback={<PageLoader />}><AutreSpecimenDetail /></Suspense> },

      // Laboratoire
      { path: 'labo',          element: <Suspense fallback={<PageLoader />}><LaboPage /></Suspense> },
      { path: 'labo/nouvelle', element: <Suspense fallback={<PageLoader />}><NouvelleManipulation /></Suspense> },
      { path: 'labo/:id',      element: <Suspense fallback={<PageLoader />}><ManipulationDetail /></Suspense> },

      // Administration
      { path: 'utilisateurs',   element: <AdminRoute><Suspense fallback={<PageLoader />}><UtilisateursPage /></Suspense></AdminRoute> },
      { path: 'admin/presence', element: <MinRoleRoute minRole="superviseur"><Suspense fallback={<PageLoader />}><AdminPresencePage /></Suspense></MinRoleRoute> },

      // Dictionnaire de données
      { path: 'dictionnaire',                        element: <Suspense fallback={<PageLoader />}><DictionnairePage /></Suspense> },
      { path: 'dictionnaire/taxonomie-specimens',    element: <Suspense fallback={<PageLoader />}><TaxonomieSpecimensPage /></Suspense> },
      { path: 'dictionnaire/taxonomie-hotes',        element: <Suspense fallback={<PageLoader />}><TaxonomieHotesPage /></Suspense> },
      { path: 'dictionnaire/types-methode',          element: <Suspense fallback={<PageLoader />}><TypesMethodePage /></Suspense> },
      { path: 'dictionnaire/solutions-conservation', element: <Suspense fallback={<PageLoader />}><SolutionsConservationPage /></Suspense> },
      { path: 'dictionnaire/types-environnement',    element: <Suspense fallback={<PageLoader />}><TypesEnvironnementPage /></Suspense> },
      { path: 'dictionnaire/types-habitat',          element: <Suspense fallback={<PageLoader />}><TypesHabitatPage /></Suspense> },
      { path: 'dictionnaire/audit-logs',             element: <Suspense fallback={<PageLoader />}><AuditLogsPage /></Suspense> },
      { path: 'dictionnaire/types-autre-specimen',   element: <Suspense fallback={<PageLoader />}><TypesAutreSpecimenPage /></Suspense> },
      { path: 'dictionnaire/pathogenes-cibles',      element: <Suspense fallback={<PageLoader />}><PathogenesCiblesPage /></Suspense> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

export default router;
