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
const SofCodesTofe = lazy(() => import("@/portails/Sof/pages/referentiels/CodesTofe"));
const SofReglesFlechage = lazy(() => import("@/portails/Sof/pages/referentiels/ReglesFlechage"));
const SofComptesSuivi = lazy(() => import("@/portails/Sof/pages/referentiels/ComptesSuivi"));
const SofSocietesPetrolieres = lazy(() => import("@/portails/Sof/pages/referentiels/SocietesPetrolieres"));
const SofPostesComptables = lazy(() => import("@/portails/Sof/pages/referentiels/PostesComptables"));
const SofTablesFiscales = lazy(() => import("@/portails/Sof/pages/referentiels/TablesFiscales"));
const SofExclusionsRap = lazy(() => import("@/portails/Sof/pages/referentiels/ExclusionsRap"));
const SofHistoriqueLots = lazy(() => import("@/portails/Sof/pages/imports/HistoriqueLots"));
const SofExtractions = lazy(() => import("@/portails/Sof/pages/imports/ExtractionsPage"));
const SofDetteTdp = lazy(() => import("@/portails/Sof/pages/imports/DetteTdp"));
const SofEmissionsTitresSmc = lazy(
  () => import("@/portails/Sof/pages/imports/EmissionsTitresSmc"),
);
const SofFacilitesAgiosScr = lazy(
  () => import("@/portails/Sof/pages/imports/FacilitesAgiosScr"),
);
const SofFondsCovidImport = lazy(() => import("@/portails/Sof/pages/imports/FondsCovid"));
const SofEtatsLiquidatifsImport = lazy(
  () => import("@/portails/Sof/pages/imports/EtatsLiquidatifs"),
);
const SofFichesComptesImport = lazy(
  () => import("@/portails/Sof/pages/imports/FichesComptes"),
);
const SofBalanceGenerale = lazy(
  () => import("@/portails/Sof/pages/imports/BalanceGenerale"),
);
const SofRecapBeac = lazy(() => import("@/portails/Sof/pages/recettes/RecapBeac"));
const SofQualificationTransferts = lazy(
  () => import("@/portails/Sof/pages/recettes/QualificationTransferts"),
);
const SofConsolidationPetrole = lazy(
  () => import("@/portails/Sof/pages/recettes/ConsolidationPetrole"),
);
const SofDetailParSociete = lazy(
  () => import("@/portails/Sof/pages/recettes/DetailParSociete"),
);
const SofRapprochementDrphp = lazy(
  () => import("@/portails/Sof/pages/recettes/RapprochementDrphp"),
);
const SofRapprochementDouanesMois = lazy(
  () => import("@/portails/Sof/pages/recettes/RapprochementDouanesMois"),
);
const SofVueAnnuelleDouanes = lazy(
  () => import("@/portails/Sof/pages/recettes/VueAnnuelleDouanes"),
);
const SofCorrespondantsDsi = lazy(
  () => import("@/portails/Sof/pages/imports/CorrespondantsDsi"),
);
const SofTvaRapprochement = lazy(
  () => import("@/portails/Sof/pages/recettes/TvaRapprochement"),
);
const SofTvaRemboursements = lazy(
  () => import("@/portails/Sof/pages/recettes/TvaRemboursements"),
);
const SofTvaRap = lazy(() => import("@/portails/Sof/pages/recettes/TvaRap"));
const SofTvaSyntheseTofe = lazy(
  () => import("@/portails/Sof/pages/recettes/TvaSyntheseTofe"),
);
const SofRecettesCorrespondants = lazy(
  () => import("@/portails/Sof/pages/recettes/Correspondants"),
);
const SofFiscalesMode = lazy(
  () => import("@/portails/Sof/pages/recettes/FiscalesMode"),
);
const SofFiscalesAppariement = lazy(
  () => import("@/portails/Sof/pages/recettes/FiscalesAppariement"),
);
const SofFiscalesNature = lazy(
  () => import("@/portails/Sof/pages/recettes/FiscalesNature"),
);
const SofAppuisAvancesEmprunts = lazy(
  () => import("@/portails/Sof/pages/recettes/AppuisAvancesEmprunts"),
);
const SofExercice = lazy(() => import("@/portails/Sof/pages/parametrage/Exercice"));
const SofLoiFinances = lazy(() => import("@/portails/Sof/pages/parametrage/LoiFinances"));
const SofPlansTresorerie = lazy(
  () => import("@/portails/Sof/pages/parametrage/PlansTresorerie"),
);
const SofServiceDette = lazy(() => import("@/portails/Sof/pages/parametrage/ServiceDette"));
const SofProgrammeTitres = lazy(
  () => import("@/portails/Sof/pages/parametrage/ProgrammeTitres"),
);
const SofExecutionN1 = lazy(() => import("@/portails/Sof/pages/parametrage/ExecutionN1"));
const SofRapAnterieurs = lazy(
  () => import("@/portails/Sof/pages/parametrage/RapAnterieurs"),
);
const SofAjustementsManuels = lazy(
  () => import("@/portails/Sof/pages/AjustementsManuels"),
);
const SofRecettesDouanieres = lazy(() => import("@/portails/Sof/pages/srot/RecettesDouanieres"));
const SofRecettesPetrolieres = lazy(() => import("@/portails/Sof/pages/srot/RecettesPetrolieres"));
const SofAvancesBudget = lazy(() => import("@/portails/Sof/pages/srot/AvancesBudget"));
const SofEtatsLiquidation = lazy(() => import("@/portails/Sof/pages/srot/EtatsLiquidation"));
const SofReglementsOrdonnances = lazy(() => import("@/portails/Sof/pages/srot/ReglementsOrdonnances"));
const SofCreditsDelegues = lazy(() => import("@/portails/Sof/pages/srot/CreditsDelegues"));
const SofDepensesCorrespondants = lazy(
  () => import("@/portails/Sof/pages/depenses/Correspondants"),
);
const SofManDette = lazy(() => import("@/portails/Sof/pages/depenses/manuelles/DettePublique"));
const SofManTitres = lazy(() => import("@/portails/Sof/pages/depenses/manuelles/BtaOta"));
const SofManFacilites = lazy(
  () => import("@/portails/Sof/pages/depenses/manuelles/FacilitesAgios"),
);
const SofManCovid = lazy(() => import("@/portails/Sof/pages/depenses/manuelles/FondsCovid"));
const SofManPersonnel = lazy(() => import("@/portails/Sof/pages/depenses/manuelles/Personnel"));
const SofManRetenues = lazy(() => import("@/portails/Sof/pages/depenses/manuelles/Retenues"));
const SofManImputations = lazy(
  () => import("@/portails/Sof/pages/depenses/manuelles/Imputations"),
);
const SofRapTva = lazy(() => import("@/portails/Sof/pages/srot/RapTva"));
const SofRemboursementsTvaDc = lazy(() => import("@/portails/Sof/pages/srot/RemboursementsTvaDc"));
const SofRemboursementsTvaIg = lazy(() => import("@/portails/Sof/pages/srot/RemboursementsTvaIg"));
const SofSrotRecettes = lazy(() => import("@/portails/Sof/pages/srot/RecettesConsolidees"));
const SofSrotDepenses = lazy(() => import("@/portails/Sof/pages/srot/DepensesConsolidees"));
const SofSrotSituation = lazy(() => import("@/portails/Sof/pages/srot/SituationResumee"));
const SofSrotEquilibre = lazy(() => import("@/portails/Sof/pages/srot/Equilibre"));
const SofSrotSoldes = lazy(() => import("@/portails/Sof/pages/srot/SoldesGestion"));
const SofSrotDepots = lazy(() => import("@/portails/Sof/pages/srot/FicheDepotsCut"));
const SofSrotCloture = lazy(() => import("@/portails/Sof/pages/srot/ValidationCloture"));
const SofAnaRecBudgetaires = lazy(
  () => import("@/portails/Sof/pages/srot/analyses/RecettesBudgetaires"),
);
const SofAnaRecMensualisees = lazy(
  () => import("@/portails/Sof/pages/srot/analyses/RecettesMensualisees"),
);
const SofAnaComparaisonN1 = lazy(
  () => import("@/portails/Sof/pages/srot/analyses/ComparaisonN1"),
);
const SofAnaHorsExceptionnelles = lazy(
  () => import("@/portails/Sof/pages/srot/analyses/HorsExceptionnelles"),
);
const SofAnaRecAffectees = lazy(
  () => import("@/portails/Sof/pages/srot/analyses/RecettesAffectees"),
);
const SofAnaDepFinancement = lazy(
  () => import("@/portails/Sof/pages/srot/analyses/DepensesFinancement"),
);
const SofAnaTirages = lazy(() => import("@/portails/Sof/pages/srot/analyses/Tirages"));
const SofAnaAutresRecettes = lazy(
  () => import("@/portails/Sof/pages/srot/analyses/AutresRecettes"),
);
const SofExeSituationRap = lazy(() => import("@/portails/Sof/pages/execution/SituationRap"));
const SofExeParTitres = lazy(() => import("@/portails/Sof/pages/execution/ParTitres"));
const SofExeParTitresNatures = lazy(
  () => import("@/portails/Sof/pages/execution/ParTitresNatures"),
);
const SofExeParMissions = lazy(() => import("@/portails/Sof/pages/execution/ParMissions"));
const SofExeHorsOrdonnances = lazy(
  () => import("@/portails/Sof/pages/execution/HorsOrdonnances"),
);
const SofExeResume = lazy(() => import("@/portails/Sof/pages/execution/ResumeExecution"));
const SofExeAnalyseRap = lazy(() => import("@/portails/Sof/pages/execution/AnalyseRap"));
const SofRptTdb = lazy(() => import("@/portails/Sof/pages/rapports/TableauDeBord"));
const SofRptFiche = lazy(() => import("@/portails/Sof/pages/rapports/FicheSrot"));
const SofRptDgbfip = lazy(() => import("@/portails/Sof/pages/rapports/ExecutionDgbfip"));
const SofRptPublications = lazy(() => import("@/portails/Sof/pages/rapports/Publications"));

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
          <Route path="referentiels/codes-tofe" element={<SofCodesTofe />} />
          <Route path="referentiels/regles-flechage" element={<SofReglesFlechage />} />
          <Route path="referentiels/comptes" element={<SofComptesSuivi />} />
          <Route path="referentiels/societes-petrolieres" element={<SofSocietesPetrolieres />} />
          <Route path="referentiels/postes-comptables" element={<SofPostesComptables />} />
          <Route path="referentiels/tables-fiscales" element={<SofTablesFiscales />} />
          <Route path="referentiels/exclusions-rap" element={<SofExclusionsRap />} />
          <Route path="imports/historique-lots" element={<SofHistoriqueLots />} />
          <Route path="imports/extractions" element={<SofExtractions />} />
          <Route
            path="imports/dc/reglements"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=dc-reglements&preset=dc-xrgv"
                replace
              />
            }
          />
          <Route
            path="imports/dc/ordonnances"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=dc-ordonnances&preset=dc-xlop"
                replace
              />
            }
          />
          <Route
            path="imports/dc/rap-bop"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=dc-rap&preset=dc-xrav"
                replace
              />
            }
          />
          <Route
            path="imports/dc/rap-avant-bop"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=dc-rap&preset=dc-rap-avant-bop"
                replace
              />
            }
          />
          <Route
            path="imports/dc/credits-delegues"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=dc-ordonnances&preset=dc-cdel"
                replace
              />
            }
          />
          <Route
            path="imports/dc/reglements-tva"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=dc-reglements&preset=dc-xrgm-tva"
                replace
              />
            }
          />
          <Route
            path="imports/dc/rap-tva"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=dc-rap&preset=dc-xram-tva"
                replace
              />
            }
          />
          <Route
            path="imports/ig/credits-delegues"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=ig-operations&preset=ig-cdel-4742"
                replace
              />
            }
          />
          <Route
            path="imports/ig/avances"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=ig-operations&preset=ig-avances-etat"
                replace
              />
            }
          />
          <Route
            path="imports/ig/reglements-tva"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=ig-operations&preset=ig-tva"
                replace
              />
            }
          />
          <Route
            path="imports/ig/fiscales"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=ig-operations&preset=ig-recettes-fiscales"
                replace
              />
            }
          />
          <Route
            path="imports/ig/deversements"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=ig-recaps&preset=ig-rcdd"
                replace
              />
            }
          />
          <Route
            path="imports/ig/petrole"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=ig-operations&preset=ig-petrole-1812-201"
                replace
              />
            }
          />
          <Route
            path="imports/ig/douanes"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=ig-operations&preset=ig-douanes"
                replace
              />
            }
          />
          <Route
            path="imports/services/correspondants"
            element={<SofCorrespondantsDsi />}
          />
          <Route
            path="imports/services/mouvements"
            element={
              <Navigate
                to="/sof/imports/extractions?onglet=ig-operations&preset=ig-mvm-fe"
                replace
              />
            }
          />
          <Route path="imports/services/dette" element={<SofDetteTdp />} />
          <Route path="imports/services/titres" element={<SofEmissionsTitresSmc />} />
          <Route path="imports/services/facilites" element={<SofFacilitesAgiosScr />} />
          <Route path="imports/services/covid" element={<SofFondsCovidImport />} />
          <Route path="imports/services/liquidatifs" element={<SofEtatsLiquidatifsImport />} />
          <Route path="imports/services/fiches-comptes" element={<SofFichesComptesImport />} />
          <Route path="imports/comptabilite/balance" element={<SofBalanceGenerale />} />
          <Route
            path="recettes/tva/rapprochement"
            element={<SofTvaRapprochement />}
          />
          <Route
            path="recettes/tva/remboursements"
            element={<SofTvaRemboursements />}
          />
          <Route path="recettes/tva/rap" element={<SofTvaRap />} />
          <Route path="recettes/tva/tofe" element={<SofTvaSyntheseTofe />} />
          <Route
            path="recettes/correspondants"
            element={<SofRecettesCorrespondants />}
          />
          <Route path="recettes/fiscales/mode" element={<SofFiscalesMode />} />
          <Route path="recettes/fiscales/appariement" element={<SofFiscalesAppariement />} />
          <Route path="recettes/fiscales/nature" element={<SofFiscalesNature />} />
          <Route
            path="recettes/appuis-avances-emprunts"
            element={<SofAppuisAvancesEmprunts />}
          />
          <Route path="recettes/petrolieres/beac" element={<SofRecapBeac />} />
          <Route
            path="recettes/petrolieres/transferts"
            element={<SofQualificationTransferts />}
          />
          <Route
            path="recettes/petrolieres/consolidation"
            element={<SofConsolidationPetrole />}
          />
          <Route
            path="recettes/petrolieres/societes"
            element={<SofDetailParSociete />}
          />
          <Route
            path="recettes/petrolieres/rapprochement"
            element={<SofRapprochementDrphp />}
          />
          <Route
            path="recettes/douanieres/mois"
            element={<SofRapprochementDouanesMois />}
          />
          <Route
            path="recettes/douanieres/annuelle"
            element={<SofVueAnnuelleDouanes />}
          />
          <Route
            path="recettes/douanieres"
            element={<Navigate to="/sof/recettes/douanieres/mois" replace />}
          />
          <Route path="parametrage/exercice" element={<SofExercice />} />
          <Route path="parametrage/loi-finances" element={<SofLoiFinances />} />
          <Route path="parametrage/plans-tresorerie" element={<SofPlansTresorerie />} />
          <Route path="parametrage/dette" element={<SofServiceDette />} />
          <Route path="parametrage/titres" element={<SofProgrammeTitres />} />
          <Route path="parametrage/execution-n1" element={<SofExecutionN1 />} />
          <Route path="parametrage/rap-anterieurs" element={<SofRapAnterieurs />} />
          <Route
            path="referentiels/cadre-budgetaire/exercices"
            element={<Navigate to="/sof/parametrage/exercice" replace />}
          />
          <Route path="ajustements-manuels" element={<SofAjustementsManuels />} />
          <Route path="srot-recettes/douanieres" element={<SofRecettesDouanieres />} />
          <Route path="srot-recettes/petrolieres" element={<SofRecettesPetrolieres />} />
          <Route path="srot-depenses/avances" element={<SofAvancesBudget />} />
          <Route path="srot-depenses/etats-liquidation" element={<SofEtatsLiquidation />} />
          <Route path="srot-depenses/reglements" element={<SofReglementsOrdonnances />} />
          <Route path="srot-depenses/credits" element={<SofCreditsDelegues />} />
          <Route path="depenses/correspondants" element={<SofDepensesCorrespondants />} />
          <Route path="depenses/manuelles/dette" element={<SofManDette />} />
          <Route path="depenses/manuelles/titres" element={<SofManTitres />} />
          <Route path="depenses/manuelles/facilites" element={<SofManFacilites />} />
          <Route path="depenses/manuelles/covid" element={<SofManCovid />} />
          <Route path="depenses/manuelles/personnel" element={<SofManPersonnel />} />
          <Route path="depenses/manuelles/retenues" element={<SofManRetenues />} />
          <Route path="depenses/manuelles/imputations" element={<SofManImputations />} />
          <Route path="srot-tva/rap" element={<SofRapTva />} />
          <Route path="srot-tva/remboursements-dc" element={<SofRemboursementsTvaDc />} />
          <Route path="srot-tva/remboursements-ig" element={<SofRemboursementsTvaIg />} />
          <Route path="srot/recettes" element={<SofSrotRecettes />} />
          <Route path="srot/depenses" element={<SofSrotDepenses />} />
          <Route path="srot/situation" element={<SofSrotSituation />} />
          <Route path="srot/equilibre" element={<SofSrotEquilibre />} />
          <Route path="srot/soldes" element={<SofSrotSoldes />} />
          <Route path="srot/depots" element={<SofSrotDepots />} />
          <Route path="srot/validation-cloture" element={<SofSrotCloture />} />
          <Route path="srot/analyses/recettes-budgetaires" element={<SofAnaRecBudgetaires />} />
          <Route path="srot/analyses/recettes-mensualisees" element={<SofAnaRecMensualisees />} />
          <Route path="srot/analyses/comparaison-n1" element={<SofAnaComparaisonN1 />} />
          <Route path="srot/analyses/hors-exceptionnelles" element={<SofAnaHorsExceptionnelles />} />
          <Route path="srot/analyses/recettes-affectees" element={<SofAnaRecAffectees />} />
          <Route path="srot/analyses/depenses-financement" element={<SofAnaDepFinancement />} />
          <Route path="srot/analyses/tirages" element={<SofAnaTirages />} />
          <Route path="srot/analyses/autres-recettes" element={<SofAnaAutresRecettes />} />
          <Route path="execution/rap" element={<SofExeSituationRap />} />
          <Route path="execution/depenses/titres" element={<SofExeParTitres />} />
          <Route path="execution/depenses/titres-natures" element={<SofExeParTitresNatures />} />
          <Route path="execution/depenses/missions" element={<SofExeParMissions />} />
          <Route path="execution/depenses/hors-ordonnances" element={<SofExeHorsOrdonnances />} />
          <Route path="execution/resume" element={<SofExeResume />} />
          <Route path="execution/analyse-rap" element={<SofExeAnalyseRap />} />
          <Route path="rapports/tableau-de-bord" element={<SofRptTdb />} />
          <Route path="rapports/fiche-srot" element={<SofRptFiche />} />
          <Route path="rapports/dgbfip" element={<SofRptDgbfip />} />
          <Route path="rapports/publications" element={<SofRptPublications />} />
          {/* Pages SOF inconnues → tableau de bord */}
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
