import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import Login from "./pages/Login";
import MotDePasseOublie from "./pages/MotDePasseOublie";
import NotFound from "./pages/NotFound";
import PortailSelection from "./pages/PortailSelection";

import SofPage from "./pages/sof/SofPage";
import SofDashboard from "./pages/sof/Dashboard";
import SofExecution from "./pages/sof/Execution";
import SofReglements from "./pages/sof/Reglements";
import SofCompensation from "./pages/sof/Compensation";
import SofSrot from "./pages/sof/Srot";
import SofUtilisateurs from "./pages/sof/Utilisateurs";
import SofProfile from "./pages/sof/Profile";

import SpPage from "./pages/sp/SpPage";
import SpDashboard from "./pages/sp/Dashboard";
import SpTbot from "./pages/sp/Tbot";
import SpPrevisions from "./pages/sp/Previsions";
import SpTitres from "./pages/sp/Titres";
import SpImports from "./pages/sp/Imports";
import SpUtilisateurs from "./pages/sp/Utilisateurs";
import SpProfile from "./pages/sp/Profile";

import DrPage from "./pages/dr/DrPage";
import Generation from "./pages/dr/Generation";
import GenererFiche from "./pages/dr/GenererFiche";
import FicheDetail from "./pages/dr/FicheDetail";
import ListeFichesDepot from "./pages/dr/ListeFichesDepot";
import Profile from "./pages/dr/Profile";
import UtilisateursSR from "./pages/dr/UtilisateursSR";
import Historique from "./pages/dr/Historique";

import AdminPage from "./pages/admin/AdminPage";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUtilisateurs from "./pages/admin/Utilisateurs";
import AdminProfile from "./pages/admin/Profile";

import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./hooks/use-auth";

const queryClient = new QueryClient();

function FicheDetailRoute() {
  const { reference } = useParams();
  return <FicheDetail key={reference} />;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
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
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
