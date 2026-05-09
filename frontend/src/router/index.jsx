// frontend/src/router/index.jsx

import { createBrowserRouter, Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

import LoginPage        from '../pages/auth/LoginPage';
import RegisterPage     from '../pages/auth/RegisterPage';
import DashboardPage    from '../pages/dashboard/DashboardPage';
import ProjetsPage      from '../pages/projets/ProjetsPage';
import ProjetDetail     from '../pages/projets/ProjetDetail';
import NouveauProjet    from '../pages/projets/NouveauProjet';
import MissionsPage     from '../pages/missions/MissionsPage';
import MissionDetail    from '../pages/missions/MissionDetail';
import NouvelleMission  from '../pages/missions/NouvelleMission';
import MoustiquesPage   from '../pages/specimens/MoustiquesPage';
import NouveauMoustique from '../pages/specimens/NouveauMoustique';
import TiquesPage       from '../pages/specimens/TiquesPage';
import NouveauTique     from '../pages/specimens/NouveauTique';
import PucesPage        from '../pages/specimens/PucesPage';
import NouveauPuce      from '../pages/specimens/NouveauPuce';
import MainLayout       from '../components/layout/MainLayout';

import MethodesPage             from '../pages/methodes/MethodesPage';
import NouvelleMethode          from '../pages/methodes/NouvelleMethode';
import HotesPage                from '../pages/hotes/HotesPage';
import NouvelHote               from '../pages/hotes/NouvelHote';
import DictionnairePage         from '../pages/dictionnaire/DictionnairePage';
import TaxonomieSpecimensPage   from '../pages/dictionnaire/TaxonomieSpecimensPage';
import TaxonomieHotesPage       from '../pages/dictionnaire/TaxonomieHotesPage';
import TypesMethodePage         from '../pages/dictionnaire/TypesMethodePage';
import SolutionsConservationPage from '../pages/dictionnaire/SolutionsConservationPage';
import TypesEnvironnementPage   from '../pages/dictionnaire/TypesEnvironnementPage';
import TypesHabitatPage         from '../pages/dictionnaire/TypesHabitatPage';
import AuditLogsPage            from '../pages/dictionnaire/AuditLogsPage';
import UtilisateursPage         from '../pages/utilisateurs/UtilisateursPage';
import RecherchePage            from '../pages/recherche/RecherchePage';
import ImportPage               from '../pages/import/ImportPage';

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

const router = createBrowserRouter([
  { path: '/login',    element: <PublicRoute><LoginPage /></PublicRoute> },
  { path: '/register', element: <PublicRoute><RegisterPage /></PublicRoute> },
  {
    path: '/',
    element: <ProtectedRoute><MainLayout /></ProtectedRoute>,
    children: [
      { index: true,                        element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard',                  element: <DashboardPage /> },

      // Projets
      { path: 'projets',                    element: <ProjetsPage /> },
      { path: 'projets/nouveau',            element: <NouveauProjet /> },
      { path: 'projets/:id',                element: <ProjetDetail /> },

      // Missions
      { path: 'missions',                   element: <MissionsPage /> },
      { path: 'missions/nouvelle',          element: <NouvelleMission /> },
      { path: 'missions/:id',               element: <MissionDetail /> },

      // Méthodes de collecte
      { path: 'methodes',                     element: <MethodesPage /> },
      { path: 'methodes/nouvelle',            element: <NouvelleMethode /> },

      // Hôtes
      { path: 'hotes',                        element: <HotesPage /> },
      { path: 'hotes/nouveau',                element: <NouvelHote /> },

      // Recherche / explorer
      { path: 'recherche',                    element: <RecherchePage /> },
      { path: 'import',                       element: <ImportPage /> },

      // Spécimens
      { path: 'specimens/moustiques',         element: <MoustiquesPage /> },
      { path: 'specimens/moustiques/nouveau', element: <NouveauMoustique /> },
      { path: 'specimens/tiques',             element: <TiquesPage /> },
      { path: 'specimens/tiques/nouveau',     element: <NouveauTique /> },
      { path: 'specimens/puces',              element: <PucesPage /> },
      { path: 'specimens/puces/nouveau',      element: <NouveauPuce /> },

      // Utilisateurs (admin)
      { path: 'utilisateurs',                          element: <AdminRoute><UtilisateursPage /></AdminRoute> },

      // Dictionnaire de données
      { path: 'dictionnaire',                          element: <DictionnairePage /> },
      { path: 'dictionnaire/taxonomie-specimens',      element: <TaxonomieSpecimensPage /> },
      { path: 'dictionnaire/taxonomie-hotes',          element: <TaxonomieHotesPage /> },
      { path: 'dictionnaire/types-methode',            element: <TypesMethodePage /> },
      { path: 'dictionnaire/solutions-conservation',   element: <SolutionsConservationPage /> },
      { path: 'dictionnaire/types-environnement',      element: <TypesEnvironnementPage /> },
      { path: 'dictionnaire/types-habitat',            element: <TypesHabitatPage /> },
      { path: 'dictionnaire/audit-logs',               element: <AuditLogsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

export default router;
