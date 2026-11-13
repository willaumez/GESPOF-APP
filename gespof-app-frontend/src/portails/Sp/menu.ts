import {
  CalendarDays, CreditCard, FileText, History, LayoutDashboard, ListChecks, ScrollText, Settings, Sunrise,
  Table2, Tags, TrendingUp, User, UserCog, Users,
} from "lucide-react";
import type { MenuPortal } from "@/shared/types/menu.interface";

/**
 * Menu du portail SP — fichier autonome : les entrées, les sections et le
 * thème de ce portail se modifient ici, sans toucher aux autres portails.
 * L'assemblage des quatre menus est fait dans shared/config/menu.ts.
 */
export const MENU_SP: MenuPortal = {
  id: "sp",
  title: "SP",
  subtitle: "Service de Prévision",
  description: "Tableaux de bord, prévisions de trésorerie, analyses.",
  icon: TrendingUp,
  logo: "/SP-logo.png",
  path: "/sp",
  badge: null,
  ctaLabel: "Accéder au SP",
  roles: ["AGENT_SP"],
  theme: {
    topColor: "#c9960a",
    bgColor: "#fdfaf0",
    iconBg: "#fbf1d6",
    iconColor: "#7f5d05",
    ctaColor: "#a67a08",
    hoverColor: "#8a6406",
    sidebarBg: "#94690a",
    borderColor: "#ecd9a3",
    textColor: "#7f5d05",
  },
  // Largeur de la barre laterale : "Audit des connexions" (sous-menu) + plancher d'en-tête.
  largeurMenu: 260,
  sections: [
    {
      id: "sp-tableaux",
      label: "TABLEAU DE BORD",
      items: [
        {
          id: "sp-dashboard",
          label: "Tableau de bord",
          path: "/sp",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      id: "sp-fiches",
      label: "FICHES JOURNALIÈRES",
      items: [
        {
          id: "sp-fiche-matinale",
          label: "Fiche matinale",
          path: "/sp/fiche-matinale",
          icon: Sunrise,
        },
        {
          id: "sp-fiche-depots",
          label: "Fiche des dépôts",
          path: "/sp/fiche-depots",
          icon: CreditCard,
        },
        {
          id: "sp-fiche-bleu",
          label: "Fiche Bleue",
          path: "/sp/fiche-bleu",
          icon: FileText,
        },
        {
          id: "sp-audit-journalier",
          label: "Audit journalier",
          path: "/sp/audit-journalier",
          icon: ListChecks,
        },
      ],
    },
    {
      id: "sp-previsions",
      label: "PRÉVISIONS",
      items: [
        {
          id: "sp-plans-tresorerie",
          label: "Plans de trésorerie",
          path: "/sp/plans-tresorerie",
          icon: TrendingUp,
        },
      ],
    },
    {
      id: "sp-parametrage",
      label: "PARAMÉTRAGE",
      items: [
        {
          id: "sp-libelles-recettes",
          label: "Libellés recettes",
          path: "/sp/libelles-recettes",
          icon: Tags,
        },
        {
          id: "sp-parametres",
          label: "Paramètres",
          path: "/sp/parametres",
          icon: Settings,
        },
      ],
    },
    {
      id: "sp-gestion-journees",
      label: "GESTION",
      items: [
        {
          id: "sp-journees-tresorerie",
          label: "Journée trésorerie",
          path: "/sp/journees-tresorerie",
          icon: CalendarDays,
        },
        {
          id: "sp-fiche-execution-conso",
          label: "Fiche d'exécution consolidée",
          path: "/sp/fiche-execution-conso",
          icon: Table2,
        },
      ],
    },
    {
      id: "sp-gestion",
      label: "ADMINISTRATION",
      items: [
        {
          id: "sp-utilisateurs",
          label: "Utilisateurs",
          path: "/sp/utilisateurs",
          icon: Users,
          roles: ["CHEF_SP"],
          children: [
            {
              id: "sp-utilisateurs-gestion",
              label: "Gestion utilisateur",
              path: "/sp/utilisateurs",
              icon: UserCog,
              roles: ["CHEF_SP"],
            },
            {
              id: "sp-utilisateurs-audit",
              label: "Audit des connexions",
              path: "/sp/audit-connexions",
              icon: History,
              roles: ["CHEF_SP"],
            },
            {
              id: "sp-utilisateurs-audit-actions",
              label: "Audit d'actions",
              path: "/sp/audit-actions",
              icon: ScrollText,
              roles: ["CHEF_SP"],
            },
          ],
        },
      ],
    },
  ],
  accountMenu: [
    {
      id: "sp-profile",
      label: "Profil",
      path: "/sp/profile",
      icon: User,
    },
    {
      id: "sp-mes-actions",
      label: "Audit d'actions",
      path: "/sp/mes-actions",
      icon: ScrollText,
    },
  ],
  // Sous-pages sans entrée dédiée : garde « Fiche matinale » active + fil d'Ariane.
  sousPages: [
    {
      prefix: "/sp/fiche-matinale/journee/",
      path: "/sp/fiche-matinale",
      breadcrumb: "Journée de trésorerie",
    },
    {
      prefix: "/sp/fiche-matinale/rapprochement-recettes/",
      path: "/sp/fiche-matinale",
      breadcrumb: "Rapprochement des recettes",
    },
    {
      prefix: "/sp/fiche-matinale/rapprochement-depenses/",
      path: "/sp/fiche-matinale",
      breadcrumb: "Rapprochement des dépenses",
    },
  ],
};
