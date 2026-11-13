import {
  FileText, History, LayoutDashboard, ScrollText, User, UserCog, Users,
  FolderInput, Database, Building2, BookOpen, Landmark, Fuel, Ship,
  Receipt, Percent, Coins, Wallet, Banknote, PenLine, Scale, TrendingUp,
  ClipboardList, Gauge, Settings, Circle, Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MenuNavItem, MenuPortal } from "@/shared/types/menu.interface";

/** Entrée feuille sans icône dédiée dans la maquette. */
const leaf = (
  id: string,
  label: string,
  path: string,
  extra: Partial<MenuNavItem> = {},
): MenuNavItem => ({
  id,
  label,
  path,
  icon: Circle,
  ...extra,
});

const group = (
  id: string,
  label: string,
  path: string,
  icon: LucideIcon,
  children: MenuNavItem[],
  extra: Partial<MenuNavItem> = {},
): MenuNavItem => ({
  id,
  label,
  path,
  icon,
  children,
  ...extra,
});

/**
 * Menu SOF — libellés et arborescence alignés sur
 * `GESPOF SOF v2.dc.html` / `sof-data.js`
 * (Cycle mensuel · Configuration · Administration).
 */
export const MENU_SOF: MenuPortal = {
  id: "sof",
  title: "SOF",
  subtitle: "Service des Opérations Financières",
  description: "Saisie des données, règlements, compensation, SROT.",
  icon: FileText,
  logo: "/SOF-logo.png",
  sidebarBrandTitle: "GESPOF · SOF",
  sidebarBrandSubtitle: "Service des Opérations Financières",
  sidebarFooterCaption: "DOMF · DGCPT",
  path: "/sof",
  badge: null,
  ctaLabel: "Accéder au SOF",
  roles: ["AGENT_SOF"],
  theme: {
    topColor: "#2a7f62",
    bgColor: "#f0f7f4",
    iconBg: "#e3f1ea",
    iconColor: "#1e6650",
    ctaColor: "#2a7f62",
    hoverColor: "#1e6650",
    sidebarBg: "#1e6650",
    borderColor: "#bfdccf",
    textColor: "#1e6650",
  },
  largeurMenu: 288,
  sections: [
    {
      id: "sof-cycle-mensuel",
      label: "Cycle mensuel",
      items: [
        {
          id: "sof-accueil",
          label: "Période en cours",
          path: "/sof",
          icon: LayoutDashboard,
        },
        group("sof-imports", "Imports", "/sof/imports", FolderInput, [
          {
            id: "sof-imports-extractions",
            label: "Extractions DC / IG",
            path: "/sof/imports/extractions",
            icon: Database,
          },
          group("sof-imports-services", "Données des autres services", "/sof/imports/services", Building2, [
            leaf("sof-srv-correspondants", "Correspondants (DSI)", "/sof/imports/services/correspondants"),
            leaf("sof-srv-dette", "Exécution de la dette (TDP)", "/sof/imports/services/dette"),
            leaf("sof-srv-titres", "Émissions BTA / OTA (SMC)", "/sof/imports/services/titres"),
            leaf("sof-srv-facilites", "Facilités et agios (SCR)", "/sof/imports/services/facilites"),
            leaf("sof-srv-covid", "Fonds COVID-19", "/sof/imports/services/covid"),
            leaf("sof-srv-liquidatifs", "États liquidatifs (solde, MONP, pension)", "/sof/imports/services/liquidatifs"),
            leaf("sof-srv-fiches-comptes", "Fiches de comptes (CAS Pensions, CNAMGS)", "/sof/imports/services/fiches-comptes"),
          ]),
          group("sof-imports-compta", "Comptabilité", "/sof/imports/comptabilite", BookOpen, [
            leaf("sof-cpt-balance", "Balance générale mensuelle", "/sof/imports/comptabilite/balance"),
          ]),
          {
            id: "sof-imports-lots",
            label: "Historique des lots",
            path: "/sof/imports/historique-lots",
            icon: History,
          },
        ]),
        group("sof-recettes", "Recettes", "/sof/recettes", Landmark, [
          group("sof-rec-petrole", "Pétrolières", "/sof/recettes/petrolieres", Fuel, [
            leaf("sof-pet-beac", "Récapitulatif BEAC", "/sof/recettes/petrolieres/beac"),
            leaf("sof-pet-transferts", "Qualification des transferts (1812-201)", "/sof/recettes/petrolieres/transferts"),
            leaf("sof-pet-consolidation", "Consolidation par type", "/sof/recettes/petrolieres/consolidation"),
            leaf("sof-pet-societes", "Détail par société", "/sof/recettes/petrolieres/societes"),
            leaf("sof-pet-rapprochement", "Rapprochement DRPHP", "/sof/recettes/petrolieres/rapprochement"),
          ]),
          group("sof-rec-douanes", "Douanières", "/sof/recettes/douanieres", Ship, [
            leaf("sof-dou-mois", "Rapprochement du mois", "/sof/recettes/douanieres/mois"),
            leaf("sof-dou-annuelle", "Vue annuelle", "/sof/recettes/douanieres/annuelle"),
          ]),
          group("sof-rec-fiscales", "Fiscales (DGI)", "/sof/recettes/fiscales", Receipt, [
            leaf("sof-fis-mode", "Par mode de recouvrement", "/sof/recettes/fiscales/mode"),
            leaf("sof-fis-appariement", "Transferts ↔ prises en charge", "/sof/recettes/fiscales/appariement"),
            leaf("sof-fis-nature", "Ventilation par nature", "/sof/recettes/fiscales/nature"),
          ]),
          group("sof-rec-tva", "TVA", "/sof/recettes/tva", Percent, [
            leaf("sof-tva-rapprochement", "Rapprochement DC ↔ IG", "/sof/recettes/tva/rapprochement"),
            leaf("sof-tva-remboursements", "Remboursements (arriérés / courants)", "/sof/recettes/tva/remboursements"),
            leaf("sof-tva-rap", "RAP TVA", "/sof/recettes/tva/rap"),
            leaf("sof-tva-tofe", "Synthèse TOFE", "/sof/recettes/tva/tofe"),
          ]),
          {
            id: "sof-rec-correspondants",
            label: "Correspondants",
            path: "/sof/recettes/correspondants",
            icon: Users,
          },
          {
            id: "sof-rec-aae",
            label: "Appuis, avances et emprunts",
            path: "/sof/recettes/appuis-avances-emprunts",
            icon: Coins,
          },
        ]),
        group("sof-depenses", "Dépenses", "/sof/depenses", Wallet, [
          leaf("sof-dep-ordonnances", "Règlements sur ordonnances", "/sof/srot-depenses/reglements"),
          leaf("sof-dep-cdel", "Crédits délégués", "/sof/srot-depenses/credits"),
          leaf("sof-dep-avances", "Avances au budget", "/sof/srot-depenses/avances"),
          leaf("sof-dep-correspondants", "Correspondants", "/sof/depenses/correspondants"),
          group("sof-dep-manuelles", "Dépenses manuelles", "/sof/depenses/manuelles", Banknote, [
            leaf("sof-man-dette", "Dette publique", "/sof/depenses/manuelles/dette"),
            leaf("sof-man-titres", "BTA / OTA", "/sof/depenses/manuelles/titres"),
            leaf("sof-man-facilites", "Facilités et agios", "/sof/depenses/manuelles/facilites"),
            leaf("sof-man-covid", "Fonds COVID-19", "/sof/depenses/manuelles/covid"),
            leaf("sof-man-personnel", "Solde, MONP et pensions", "/sof/depenses/manuelles/personnel"),
            leaf("sof-man-retenues", "Retenues pension et CNAMGS", "/sof/depenses/manuelles/retenues"),
            leaf("sof-man-imputations", "Imputations", "/sof/depenses/manuelles/imputations"),
          ]),
        ]),
        {
          id: "sof-ajustements",
          label: "Ajustements manuels",
          path: "/sof/ajustements-manuels",
          icon: PenLine,
        },
        group("sof-srot", "SROT", "/sof/srot", Scale, [
          leaf("sof-srot-recettes", "Recettes consolidées", "/sof/srot/recettes"),
          leaf("sof-srot-depenses", "Dépenses consolidées", "/sof/srot/depenses"),
          leaf("sof-srot-situation", "Situation résumée", "/sof/srot/situation"),
          leaf("sof-srot-equilibre", "Équilibre", "/sof/srot/equilibre"),
          leaf("sof-srot-soldes", "Soldes de gestion", "/sof/srot/soldes"),
          leaf("sof-srot-depots", "Fiche de dépôts (CUT)", "/sof/srot/depots"),
          group("sof-srot-analyses", "Analyses", "/sof/srot/analyses", TrendingUp, [
            leaf("sof-ana-rec-budgetaires", "Recettes budgétaires", "/sof/srot/analyses/recettes-budgetaires"),
            leaf("sof-ana-rec-mensualisees", "Recettes mensualisées", "/sof/srot/analyses/recettes-mensualisees"),
            leaf("sof-ana-rec-n1", "Comparaison N-1", "/sof/srot/analyses/comparaison-n1"),
            leaf("sof-ana-rec-hre", "Hors recettes exceptionnelles", "/sof/srot/analyses/hors-exceptionnelles"),
            leaf("sof-ana-rec-affectees", "Recettes affectées", "/sof/srot/analyses/recettes-affectees"),
            leaf("sof-ana-dep-financement", "Dépenses et financement", "/sof/srot/analyses/depenses-financement"),
            leaf("sof-ana-tirages", "Tirages", "/sof/srot/analyses/tirages"),
            leaf("sof-ana-autres-recettes", "Autres recettes", "/sof/srot/analyses/autres-recettes"),
          ]),
          {
            id: "sof-srot-cloture",
            label: "Validation et clôture",
            path: "/sof/srot/validation-cloture",
            icon: Shield,
            roles: ["CHEF_SOF"],
          },
        ]),
        group("sof-execution", "Exécution budgétaire", "/sof/execution", ClipboardList, [
          leaf("sof-exe-rap", "Situation des RAP", "/sof/execution/rap"),
          group("sof-exe-depenses", "Exécution des dépenses", "/sof/execution/depenses", Wallet, [
            leaf("sof-exe-titres", "Par titres", "/sof/execution/depenses/titres"),
            leaf("sof-exe-titres-natures", "Par titres et grandes natures", "/sof/execution/depenses/titres-natures"),
            leaf("sof-exe-missions", "Par missions et programmes", "/sof/execution/depenses/missions"),
            leaf("sof-exe-hors-ordos", "Règlements hors RAP et ordonnances", "/sof/execution/depenses/hors-ordonnances"),
          ]),
          leaf("sof-exe-resume", "Résumé de l'exécution", "/sof/execution/resume"),
          leaf("sof-exe-analyse-rap", "Analyse des RAP", "/sof/execution/analyse-rap"),
        ]),
        group("sof-rapports", "Rapports", "/sof/rapports", FileText, [
          {
            id: "sof-rpt-tdb",
            label: "Tableau de bord des opérations du Trésor",
            path: "/sof/rapports/tableau-de-bord",
            icon: Gauge,
          },
          leaf("sof-rpt-fiche", "Fiche SROT (MBCP)", "/sof/rapports/fiche-srot"),
          leaf("sof-rpt-dgbfip", "Exécution au format DGBFiP", "/sof/rapports/dgbfip"),
          {
            id: "sof-rpt-publications",
            label: "Publications",
            path: "/sof/rapports/publications",
            icon: History,
          },
        ]),
      ],
    },
    {
      id: "sof-configuration",
      label: "Configuration",
      items: [
        group(
          "sof-parametrage",
          "Paramétrage de l'exercice",
          "/sof/parametrage",
          Settings,
          [
            leaf("sof-par-exercice", "Exercice", "/sof/parametrage/exercice"),
            leaf("sof-par-lf", "Loi de finances (LFI / LFR)", "/sof/parametrage/loi-finances"),
            leaf("sof-par-plans", "Plans de trésorerie (DGI, DGH, DGDDI)", "/sof/parametrage/plans-tresorerie"),
            leaf("sof-par-dette", "Service de la dette (DGD)", "/sof/parametrage/dette"),
            leaf("sof-par-titres", "Programme d'émission des titres", "/sof/parametrage/titres"),
            leaf("sof-par-n1", "Exécution N-1", "/sof/parametrage/execution-n1"),
            leaf("sof-par-rap-ant", "RAP des exercices antérieurs", "/sof/parametrage/rap-anterieurs"),
          ],
          { roles: ["CHEF_SOF"] },
        ),
        group(
          "sof-referentiels",
          "Référentiels",
          "/sof/referentiels",
          BookOpen,
          [
            leaf("sof-ref-nomenclature", "Nomenclature SROT", "/sof/referentiels/nomenclature/rubriques-budgetaires"),
            leaf("sof-ref-tofe", "Codes TOFE", "/sof/referentiels/codes-tofe"),
            leaf("sof-ref-flechage", "Règles de fléchage", "/sof/referentiels/regles-flechage"),
            leaf("sof-ref-fiscal", "Tables des recettes fiscales", "/sof/referentiels/tables-fiscales"),
            leaf("sof-ref-societes", "Sociétés pétrolières", "/sof/referentiels/societes-petrolieres"),
            leaf("sof-ref-comptes", "Comptes douanes et pétrole", "/sof/referentiels/comptes"),
            leaf("sof-ref-postes", "Postes comptables", "/sof/referentiels/postes-comptables"),
            leaf("sof-ref-exclusions", "Exclusions RAP", "/sof/referentiels/exclusions-rap"),
          ],
          { roles: ["CHEF_SOF"] },
        ),
      ],
    },
    {
      id: "sof-gestion",
      label: "ADMINISTRATION",
      items: [
        {
          id: "sof-utilisateurs",
          label: "Utilisateurs",
          path: "/sof/utilisateurs",
          icon: Users,
          roles: ["CHEF_SOF"],
          children: [
            {
              id: "sof-utilisateurs-gestion",
              label: "Gestion utilisateur",
              path: "/sof/utilisateurs",
              icon: UserCog,
              roles: ["CHEF_SOF"],
            },
            {
              id: "sof-utilisateurs-audit",
              label: "Audit des connexions",
              path: "/sof/audit-connexions",
              icon: History,
              roles: ["CHEF_SOF"],
            },
            {
              id: "sof-utilisateurs-audit-actions",
              label: "Audit d'actions",
              path: "/sof/audit-actions",
              icon: ScrollText,
              roles: ["CHEF_SOF"],
            },
          ],
        },
      ],
    },
  ],
  accountMenu: [
    {
      id: "sof-profile",
      label: "Profil",
      path: "/sof/profile",
      icon: User,
    },
    {
      id: "sof-mes-actions",
      label: "Audit d'actions",
      path: "/sof/mes-actions",
      icon: ScrollText,
    },
  ],
};
