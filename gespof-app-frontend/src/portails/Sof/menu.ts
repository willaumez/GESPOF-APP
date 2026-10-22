import {
  FileText, History, LayoutDashboard, ScrollText, User,
  UserCog, Users, TrendingUp, TrendingDown, BarChart3, Database, Calendar,
  Receipt, Banknote, PieChart, Target, FileSpreadsheet, ClipboardList, Percent,
} from "lucide-react";
import type { MenuPortal } from "@/shared/types/menu.interface";


export const MENU_SOF: MenuPortal = {
  id: "sof",
  title: "SOF",
  subtitle: "Service des Opérations Financières",
  description: "Saisie des données, règlements, compensation, SROT.",
  icon: FileText,
  logo: "/SOF-logo.png",
  path: "/sof",
  badge: null,
  ctaLabel: "Accéder au SOF",
  roles: ["AGENT_SOF"],
  theme: {
    topColor: "#2a7f62",
    bgColor: "#f0f7f4",
    iconBg: "#e8f5ef",
    iconColor: "#2a7f62",
    ctaColor: "#2a7f62",
    hoverColor: "#1e6650",
  },
  largeurMenu: 280,
  sections: [
    {
      id: "sof-accueil",
      label: "TABLEAU DE BORD",
      items: [
        {
          id: "sof-dashboard",
          label: "Tableau de bord",
          path: "/sof",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      id: "sof-confection-srot",
      label: "CONFECTION SROT",
      items: [
        {
          id: "sof-srot-recettes",
          label: "SROT - Recettes",
          path: "/sof/srot-recettes",
          icon: TrendingUp,
          children: [
            {
              id: "sof-srot-recettes-correspondants",
              label: "Recettes des correspondants",
              path: "/sof/srot-recettes/correspondants",
              icon: TrendingUp,
            },
            {
              id: "sof-srot-recettes-petrolieres",
              label: "Rapprochement — Pétrolières",
              path: "/sof/srot-recettes/petrolieres",
              icon: TrendingUp,
            },
            {
              id: "sof-srot-recettes-douanieres",
              label: "Rapprochement — Douanières",
              path: "/sof/srot-recettes/douanieres",
              icon: TrendingUp,
            },
            {
              id: "sof-srot-recettes-fiscales",
              label: "Rapprochement — Fiscales",
              path: "/sof/srot-recettes/fiscales",
              icon: TrendingUp,
            },
            {
              id: "sof-srot-recettes-ex-ant",
              label: "Recettes Ex Ant (exercice antérieur)",
              path: "/sof/srot-recettes/ex-ant",
              icon: TrendingUp,
            },
            {
              id: "sof-srot-recettes-previsions",
              label: "Prévisions de recettes (LFI / LFR)",
              path: "/sof/srot-recettes/previsions",
              icon: Calendar,
            },
            {
              id: "sof-srot-recettes-flechage",
              label: "Fléchage / Table des natures",
              path: "/sof/srot-recettes/flechage",
              icon: Target,
            },
          ],
        },
        {
          id: "sof-srot-tva",
          label: "SROT - TVA",
          path: "/sof/srot-tva",
          icon: Percent,
          children: [
            {
              id: "sof-srot-tva-rap",
              label: "RAP TVA (restes à payer, 4781-31)",
              path: "/sof/srot-tva/rap",
              icon: FileText,
            },
            {
              id: "sof-srot-tva-remboursements-dc",
              label: "Remboursements TVA (DC)",
              path: "/sof/srot-tva/remboursements-dc",
              icon: TrendingDown,
            },
            {
              id: "sof-srot-tva-remboursements-ig",
              label: "Remboursements TVA (IG)",
              path: "/sof/srot-tva/remboursements-ig",
              icon: TrendingDown,
            },
            {
              id: "sof-srot-tva-analyse",
              label: "Analyse TVA (rapprochement Arriérés / Courants)",
              path: "/sof/srot-tva/analyse",
              icon: PieChart,
            },
          ],
        },
        {
          id: "sof-srot-depenses",
          label: "SROT - Dépenses",
          path: "/sof/srot-depenses",
          icon: TrendingDown,
          children: [
            {
              id: "sof-srot-depenses-correspondants",
              label: "Dépenses des correspondants",
              path: "/sof/srot-depenses/correspondants",
              icon: TrendingDown,
            },
            {
              id: "sof-srot-depenses-avances",
              label: "Avances au budget",
              path: "/sof/srot-depenses/avances",
              icon: TrendingDown,
            },
            {
              id: "sof-srot-depenses-etats-liquidation",
              label: "États de liquidation",
              path: "/sof/srot-depenses/etats-liquidation",
              icon: ClipboardList,
            },
            {
              id: "sof-srot-depenses-reglements",
              label: "Règlements (ordonnances)",
              path: "/sof/srot-depenses/reglements",
              icon: TrendingDown,
            },
            {
              id: "sof-srot-depenses-credits",
              label: "Crédits délégués",
              path: "/sof/srot-depenses/credits",
              icon: TrendingDown,
            },
            {
              id: "sof-srot-depenses-tirages",
              label: "Tirages (dette, BTA / OTA)",
              path: "/sof/srot-depenses/tirages",
              icon: Banknote,
            },
            {
              id: "sof-srot-depenses-manuelles",
              label: "Dépenses manuelles (COVID-19, BTA/OTA, dette, facilités, agios)",
              path: "/sof/srot-depenses/manuelles",
              icon: TrendingDown,
            },
            {
              id: "sof-srot-depenses-ajustements",
              label: "Ajustements manuels",
              path: "/sof/srot-depenses/ajustements",
              icon: TrendingDown,
            },
            {
              id: "sof-srot-depenses-previsions",
              label: "Prévisions de dépenses & financement",
              path: "/sof/srot-depenses/previsions",
              icon: Calendar,
            },
          ],
        },
        {
          id: "sof-analyse-reglements",
          label: "Analyse des Règlements",
          path: "/sof/analyse-reglements",
          icon: BarChart3,
          children: [
            {
              id: "sof-analyse-resume",
              label: "Résumé (EQUILIBRE)",
              path: "/sof/analyse-reglements/resume",
              icon: PieChart,
            },
            {
              id: "sof-analyse-recettes",
              label: "Exécution en recettes",
              path: "/sof/analyse-reglements/recettes",
              icon: TrendingUp,
            },
            {
              id: "sof-analyse-depenses-natures",
              label: "Exécution en dépenses — titres & grandes natures",
              path: "/sof/analyse-reglements/depenses-natures",
              icon: TrendingDown,
            },
            {
              id: "sof-analyse-depenses-missions",
              label: "Exécution en dépenses — missions & programmes",
              path: "/sof/analyse-reglements/depenses-missions",
              icon: TrendingDown,
            },
            {
              id: "sof-analyse-titres",
              label: "Exécution par titres",
              path: "/sof/analyse-reglements/titres",
              icon: Receipt,
            },
          ],
        },
      ],
    },
    {
      id: "sof-restitutions",
      label: "RESTITUTIONS",
      items: [
        {
          id: "sof-restitutions-previsions",
          label: "Prévisions",
          path: "/sof/restitutions/previsions",
          icon: Calendar,
          children: [
            {
              id: "sof-restitutions-previsions-consulter",
              label: "Consulter les prévisions",
              path: "/sof/restitutions/previsions/consulter",
              icon: Calendar,
            },
            {
              id: "sof-restitutions-previsions-exporter",
              label: "Exporter",
              path: "/sof/restitutions/previsions/exporter",
              icon: FileSpreadsheet,
            },
          ],
        },
        {
          id: "sof-restitutions-ajustements",
          label: "RD Ajustements Manuels",
          path: "/sof/restitutions/ajustements-manuels",
          icon: ClipboardList,
          children: [
            {
              id: "sof-restitutions-ajustements-consulter",
              label: "Consulter les ajustements",
              path: "/sof/restitutions/ajustements-manuels/consulter",
              icon: ClipboardList,
            },
            {
              id: "sof-restitutions-ajustements-exporter",
              label: "Exporter",
              path: "/sof/restitutions/ajustements-manuels/exporter",
              icon: FileSpreadsheet,
            },
          ],
        },
        {
          id: "sof-restitutions-model-automatise",
          label: "RD Model Automatisé",
          path: "/sof/restitutions/model-automatise",
          icon: Database,
          children: [
            {
              id: "sof-restitutions-model-automatise-consulter",
              label: "Consulter les montants mensuels",
              path: "/sof/restitutions/model-automatise/consulter",
              icon: BarChart3,
            },
            {
              id: "sof-restitutions-model-automatise-exporter",
              label: "Exporter",
              path: "/sof/restitutions/model-automatise/exporter",
              icon: FileSpreadsheet,
            },
          ],
        },
        {
          id: "sof-restitutions-synthese-analyse",
          label: "RD Synthèse Analyse",
          path: "/sof/restitutions/synthese-analyse",
          icon: PieChart,
          children: [
            {
              id: "sof-restitutions-synthese-publier",
              label: "Publier la SROT",
              path: "/sof/restitutions/synthese-analyse/publier",
              icon: FileSpreadsheet,
            },
            {
              id: "sof-restitutions-synthese-historique",
              label: "Historique des publications",
              path: "/sof/restitutions/synthese-analyse/historique",
              icon: History,
            },
          ],
        },
      ],
    },
    {
      id: "sof-referentiels",
      label: "RÉFÉRENTIELS",
      items: [
        {
          id: "sof-referentiels-nomenclature",
          label: "Nomenclature",
          path: "/sof/referentiels/nomenclature",
          icon: Database,
          children: [
            {
              id: "sof-referentiels-natures",
              label: "Natures de recettes (57 codes)",
              path: "/sof/referentiels/nomenclature/natures-recettes",
              icon: Database,
            },
            {
              id: "sof-referentiels-rubriques",
              label: "Rubriques budgétaires (recettes & dépenses)",
              path: "/sof/referentiels/nomenclature/rubriques-budgetaires",
              icon: Database,
            },
          ],
        },
        {
          id: "sof-referentiels-comptes",
          label: "Comptes",
          path: "/sof/referentiels/comptes",
          icon: Banknote,
          children: [
            {
              id: "sof-referentiels-comptes-balance",
              label: "Comptes balance",
              path: "/sof/referentiels/comptes/balance",
              icon: Database,
            },
            {
              id: "sof-referentiels-comptes-bancaires",
              label: "Comptes bancaires (BAC, BGFI, Citi…)",
              path: "/sof/referentiels/comptes/bancaires",
              icon: Banknote,
            },
          ],
        },
        {
          id: "sof-referentiels-cadre-budgetaire",
          label: "Cadre budgétaire",
          path: "/sof/referentiels/cadre-budgetaire",
          icon: Calendar,
          children: [
            {
              id: "sof-referentiels-exercices",
              label: "Exercices",
              path: "/sof/referentiels/cadre-budgetaire/exercices",
              icon: Calendar,
            },
            {
              id: "sof-referentiels-lfi",
              label: "Loi de finances (LFI / LFR)",
              path: "/sof/referentiels/cadre-budgetaire/lfi",
              icon: Calendar,
            },
          ],
        },
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
              label: "Gestion",
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