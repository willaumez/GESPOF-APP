import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "@/shared/hooks/use-auth";

const Login = lazy(() => import("@/pages/Login"));
const MotDePasseOublie = lazy(() => import("@/pages/MotDePasseOublie"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const PortailSelection = lazy(() => import("@/pages/PortailSelection"));

const SofPage = lazy(() => import("@/pages/sof/SofPage"));
const SofDashboard = lazy(() => import("@/pages/sof/Dashboard"));
const SofExecution = lazy(() => import("@/pages/sof/Execution"));
const SofReglements = lazy(() => import("@/pages/sof/Reglements"));
const SofCompensation = lazy(() => import("@/pages/sof/Compensation"));
const SofSrot = lazy(() => import("@/pages/sof/Srot"));
const SofUtilisateurs = lazy(() => import("@/pages/sof/Utilisateurs"));
const SofProfile = lazy(() => import("@/pages/sof/Profile"));

const SpPage = lazy(() => import("@/pages/sp/SpPage"));
const SpDashboard = lazy(() => import("@/pages/sp/Dashboard"));
const SpTbot = lazy(() => import("@/pages/sp/Tbot"));
const SpPrevisions = lazy(() => import("@/pages/sp/Previsions"));
const SpTitres = lazy(() => import("@/pages/sp/Titres"));
const SpImports = lazy(() => import("@/pages/sp/Imports"));
const SpUtilisateurs = lazy(() => import("@/pages/sp/Utilisateurs"));
const SpProfile = lazy(() => import("@/pages/sp/Profile"));

const DrPage = lazy(() => import("@/portails/Dr/layout/DrLayout"));
const Generation = lazy(() => import("@/portails/Dr/modules/ServiceReglement/pages/Generation"));
const GenererFiche = lazy(() => import("@/portails/Dr/modules/ServiceReglement/pages/GenererFiche"));
const FicheDetail = lazy(() => import("@/portails/Dr/modules/ServiceReglement/pages/FicheDetail"));
const ListeFichesDepot = lazy(() => import("@/portails/Dr/modules/ServiceReglement/pages/ListeFichesDepot"));
const Profile = lazy(() => import("@/portails/Dr/modules/ServiceReglement/pages/Profile"));
const UtilisateursSR = lazy(() => import("@/portails/Dr/modules/ServiceReglement/pages/UtilisateursSR"));
const Historique = lazy(() => import("@/portails/Dr/modules/ServiceReglement/pages/Historique"));

const AdminPage = lazy(() => import("@/pages/admin/AdminPage"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminUtilisateurs = lazy(() => import("@/pages/admin/Utilisateurs"));
const AdminProfile = lazy(() => import("@/pages/admin/Profile"));

function FicheDetailRoute() {
  const { reference } = useParams();
  return <FicheDetail key={reference} />;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

function ChargementPage() {
  return (
    <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      Chargement…
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<ChargementPage />}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
        <Route
          path="/portail"
          element={<ProtectedRoute><PortailSelection /></ProtectedRoute>}
        />
        <Route
          path="/sof"
          element={<ProtectedRoute><SofPage /></ProtectedRoute>}
        >
          <Route index element={<SofDashboard />} />
          <Route path="execution" element={<SofExecution />} />
          <Route path="reglements" element={<SofReglements />} />
          <Route path="compensation" element={<SofCompensation />} />
          <Route path="srot" element={<SofSrot />} />
          <Route path="utilisateurs" element={<SofUtilisateurs />} />
          <Route path="profile" element={<SofProfile />} />
        </Route>
        <Route
          path="/sp"
          element={<ProtectedRoute><SpPage /></ProtectedRoute>}
        >
          <Route index element={<SpDashboard />} />
          <Route path="tbot" element={<SpTbot />} />
          <Route path="previsions" element={<SpPrevisions />} />
          <Route path="titres" element={<SpTitres />} />
          <Route path="imports" element={<SpImports />} />
          <Route path="utilisateurs" element={<SpUtilisateurs />} />
          <Route path="profile" element={<SpProfile />} />
        </Route>
        <Route
          path="/dr"
          element={<ProtectedRoute><DrPage /></ProtectedRoute>}
        >
          <Route index element={<Navigate to="/dr/tableau-de-bord" replace />} />
          <Route path="tableau-de-bord" element={<Generation />} />
          <Route path="generer"    element={<GenererFiche />} />
          <Route path="fiche/:reference" element={<FicheDetailRoute />} />
          <Route path="fiches-depenses" element={<ListeFichesDepot />} />
          <Route path="historique" element={<Historique />} />
          <Route path="profile"    element={<Profile />} />
          <Route path="utilisateurs" element={<UtilisateursSR />} />
        </Route>
        <Route
          path="/admin"
          element={<ProtectedRoute><AdminPage /></ProtectedRoute>}
        >
          <Route index element={<AdminDashboard />} />
          <Route path="utilisateurs" element={<AdminUtilisateurs />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
