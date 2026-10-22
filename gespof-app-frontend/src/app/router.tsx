import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "@/shared/hooks/use-auth";

const Login = lazy(() => import("@/pages/Login"));
const MotDePasseOublie = lazy(() => import("@/pages/MotDePasseOublie"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const PortailSelection = lazy(() => import("@/pages/PortailSelection"));

const SofPage = lazy(() => import("@/portails/Sof/layout/SofLayout"));
const SofDashboard = lazy(() => import("@/portails/Sof/pages/Dashboard"));
const SofUtilisateurs = lazy(() => import("@/portails/Sof/pages/Utilisateurs"));
const SofAuditConnexions = lazy(() => import("@/portails/Sof/pages/AuditConnexions"));
const SofAuditActions = lazy(() => import("@/portails/Sof/pages/AuditActions"));
const SofMesActions = lazy(() => import("@/portails/Sof/pages/MesActions"));
const SofProfile = lazy(() => import("@/portails/Sof/pages/Profile"));
const SofRubriquesBudgetaires = lazy(() => import("@/portails/Sof/pages/referentiels/RubriquesBudgetaires"));
const SofExercices = lazy(() => import("@/portails/Sof/pages/referentiels/Exercices"));
const SofRecettesDouanieres = lazy(() => import("@/portails/Sof/pages/srot/RecettesDouanieres"));
const SofRecettesPetrolieres = lazy(() => import("@/portails/Sof/pages/srot/RecettesPetrolieres"));
const SofAvancesBudget = lazy(() => import("@/portails/Sof/pages/srot/AvancesBudget"));
const SofEtatsLiquidation = lazy(() => import("@/portails/Sof/pages/srot/EtatsLiquidation"));
const SofReglementsOrdonnances = lazy(() => import("@/portails/Sof/pages/srot/ReglementsOrdonnances"));
const SofCreditsDelegues = lazy(() => import("@/portails/Sof/pages/srot/CreditsDelegues"));
const SofRapTva = lazy(() => import("@/portails/Sof/pages/srot/RapTva"));
const SofRemboursementsTvaDc = lazy(() => import("@/portails/Sof/pages/srot/RemboursementsTvaDc"));
const SofRemboursementsTvaIg = lazy(() => import("@/portails/Sof/pages/srot/RemboursementsTvaIg"));

const SpPage = lazy(() => import("@/portails/Sp/layout/SpLayout"));
const SpDashboard = lazy(() => import("@/portails/Sp/pages/Dashboard"));
const SpFicheMatinale = lazy(() => import("@/portails/Sp/pages/FicheMatinale"));
const SpFicheBleue = lazy(() => import("@/portails/Sp/pages/FicheBleue"));
const SpFicheDepots = lazy(() => import("@/portails/Sp/pages/FicheDepots"));
const SpJourneesTresorerie = lazy(() => import("@/portails/Sp/pages/JourneesTresorerie"));
const SpFicheExecutionConso = lazy(() => import("@/portails/Sp/pages/FicheExecutionConso"));
const SpAuditJournalier = lazy(() => import("@/portails/Sp/pages/AuditJournalier"));
const SpJourneeTresorerie = lazy(() => import("@/portails/Sp/pages/JourneeTresoreriePage"));
const SpRapprochement = lazy(() => import("@/portails/Sp/pages/Rapprochement"));
const SpParametres = lazy(() => import("@/portails/Sp/pages/Parametres"));
const SpUtilisateurs = lazy(() => import("@/portails/Sp/pages/Utilisateurs"));
const SpAuditConnexions = lazy(() => import("@/portails/Sp/pages/AuditConnexions"));
const SpAuditActions = lazy(() => import("@/portails/Sp/pages/AuditActions"));
const SpMesActions = lazy(() => import("@/portails/Sp/pages/MesActions"));
const SpProfile = lazy(() => import("@/portails/Sp/pages/Profile"));

const SrPage = lazy(() => import("@/portails/Sr/layout/SrLayout"));
const Generation = lazy(() => import("@/portails/Sr/pages/Generation"));
const GenererFiche = lazy(() => import("@/portails/Sr/pages/GenererFiche"));
const FicheDetail = lazy(() => import("@/portails/Sr/pages/FicheDetail"));
const ListeFichesDepot = lazy(() => import("@/portails/Sr/pages/ListeFichesDepot"));
const Profile = lazy(() => import("@/portails/Sr/pages/Profile"));
const UtilisateursSR = lazy(() => import("@/portails/Sr/pages/UtilisateursSR"));
const SrAuditConnexions = lazy(() => import("@/portails/Sr/pages/AuditConnexions"));
const SrAuditActions = lazy(() => import("@/portails/Sr/pages/AuditActions"));
const SrMesActions = lazy(() => import("@/portails/Sr/pages/MesActions"));
const Historique = lazy(() => import("@/portails/Sr/pages/Historique"));

const AdminPage = lazy(() => import("@/portails/Admin/layout/AdminLayout"));
const AdminDashboard = lazy(() => import("@/portails/Admin/pages/Dashboard"));
const AdminUtilisateurs = lazy(() => import("@/portails/Admin/pages/Utilisateurs"));
const AdminAuditConnexions = lazy(() => import("@/portails/Admin/pages/AuditConnexions"));
const AdminAuditActions = lazy(() => import("@/portails/Admin/pages/AuditActions"));
const AdminMesActions = lazy(() => import("@/portails/Admin/pages/MesActions"));
const AdminProfile = lazy(() => import("@/portails/Admin/pages/Profile"));

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
          <Route path="utilisateurs" element={<SofUtilisateurs />} />
          <Route path="audit-connexions" element={<SofAuditConnexions />} />
          <Route path="audit-actions" element={<SofAuditActions />} />
          <Route path="mes-actions" element={<SofMesActions />} />
          <Route path="profile" element={<SofProfile />} />
          <Route path="referentiels/nomenclature/rubriques-budgetaires" element={<SofRubriquesBudgetaires />} />
          <Route path="referentiels/cadre-budgetaire/exercices" element={<SofExercices />} />
          <Route path="srot-recettes/douanieres" element={<SofRecettesDouanieres />} />
          <Route path="srot-recettes/petrolieres" element={<SofRecettesPetrolieres />} />
          <Route path="srot-depenses/avances" element={<SofAvancesBudget />} />
          <Route path="srot-depenses/etats-liquidation" element={<SofEtatsLiquidation />} />
          <Route path="srot-depenses/reglements" element={<SofReglementsOrdonnances />} />
          <Route path="srot-depenses/credits" element={<SofCreditsDelegues />} />
          <Route path="srot-tva/rap" element={<SofRapTva />} />
          <Route path="srot-tva/remboursements-dc" element={<SofRemboursementsTvaDc />} />
          <Route path="srot-tva/remboursements-ig" element={<SofRemboursementsTvaIg />} />
          {/* Pages SOF pas encore implémentées → tableau de bord */}
          <Route path="*" element={<Navigate to="/sof" replace />} />
        </Route>
        <Route
          path="/sp"
          element={<ProtectedRoute><SpPage /></ProtectedRoute>}
        >
          <Route index element={<SpDashboard />} />
          <Route path="fiche-matinale" element={<SpFicheMatinale />} />
          <Route path="fiche-matinale/journee/:reference" element={<SpJourneeTresorerie />} />
          <Route path="fiche-matinale/rapprochement-recettes/:reference" element={<SpRapprochement key="recette" type="recette" />} />
          <Route path="fiche-matinale/rapprochement-depenses/:reference" element={<SpRapprochement key="depense" type="depense" />} />
          <Route path="fiche-bleu" element={<SpFicheBleue />} />
          <Route path="fiche-depots" element={<SpFicheDepots />} />
          <Route path="journees-tresorerie" element={<SpJourneesTresorerie />} />
          {/* Ancienne adresse « Archives » : liens et favoris existants. */}
          <Route path="archives" element={<Navigate to="/sp/journees-tresorerie" replace />} />
          <Route path="fiche-execution-conso" element={<SpFicheExecutionConso />} />
          <Route path="audit-journalier" element={<SpAuditJournalier />} />
          <Route path="parametres" element={<SpParametres />} />
          <Route path="utilisateurs" element={<SpUtilisateurs />} />
          <Route path="audit-connexions" element={<SpAuditConnexions />} />
          <Route path="audit-actions" element={<SpAuditActions />} />
          <Route path="mes-actions" element={<SpMesActions />} />
          <Route path="profile" element={<SpProfile />} />
          {/* Pages SP pas encore implémentées → tableau de bord */}
          <Route path="*" element={<Navigate to="/sp" replace />} />
        </Route>
        <Route
          path="/sr"
          element={<ProtectedRoute><SrPage /></ProtectedRoute>}
        >
          <Route index element={<Navigate to="/sr/tableau-de-bord" replace />} />
          <Route path="tableau-de-bord" element={<Generation />} />
          <Route path="generer"    element={<GenererFiche />} />
          <Route path="fiche/:reference" element={<FicheDetailRoute />} />
          <Route path="fiches-depenses" element={<ListeFichesDepot />} />
          <Route path="historique" element={<Historique />} />
          <Route path="profile"    element={<Profile />} />
          <Route path="utilisateurs" element={<UtilisateursSR />} />
          <Route path="audit-connexions" element={<SrAuditConnexions />} />
          <Route path="audit-actions" element={<SrAuditActions />} />
          <Route path="mes-actions" element={<SrMesActions />} />
        </Route>
        <Route
          path="/admin"
          element={<ProtectedRoute><AdminPage /></ProtectedRoute>}
        >
          <Route index element={<AdminDashboard />} />
          <Route path="utilisateurs" element={<AdminUtilisateurs />} />
          <Route path="audit-connexions" element={<AdminAuditConnexions />} />
          <Route path="audit-actions" element={<AdminAuditActions />} />
          <Route path="mes-actions" element={<AdminMesActions />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
