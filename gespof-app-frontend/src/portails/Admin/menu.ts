import { History, LayoutDashboard, ScrollText, Settings, User, UserCog, Users } from "lucide-react";
import type { MenuPortal } from "@/shared/types/menu.interface";

/**
 * Menu du portail Admin — fichier autonome : les entrées, les sections et le
 * thème de ce portail se modifient ici, sans toucher aux autres portails.
 * L'assemblage des quatre menus est fait dans shared/config/menu.ts.
 */
export const MENU_ADMIN: MenuPortal = {
  id: "admin",
  title: "Admin",
  subtitle: "Administration Système",
  description: "Gestion des utilisateurs, des rôles et des paramètres système.",
  icon: Settings,
  sidebarBrandTitle: "Administration",
  sidebarBrandSubtitle: "DOMF · DGCPT",
  path: "/admin",
  badge: null,
  ctaLabel: "Accéder à l'Administration",
  roles: ["ADMINISTRATEUR"],
  theme: {
    topColor: "#0f172a",
    bgColor: "#f1f5f9",
    iconBg: "#e2e8f0",
    iconColor: "#0f172a",
    ctaColor: "#0f172a",
    hoverColor: "#1e293b",
    sidebarBg: "#0f172a",
    borderColor: "#cbd5e1",
    textColor: "#0f172a",
  },
  // Largeur de la barre laterale : "Audit des connexions" (sous-menu).
  largeurMenu: 260,
  sections: [
    {
      id: "admin-administration",
      label: "ADMINISTRATION",
      items: [
        {
          id: "admin-dashboard",
          label: "Tableau de bord Admin",
          path: "/admin",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      id: "admin-gestion",
      label: "ADMINISTRATION",
      items: [
        {
          id: "admin-utilisateurs",
          label: "Utilisateurs",
          path: "/admin/utilisateurs",
          icon: Users,
          children: [
            {
              id: "admin-utilisateurs-gestion",
              label: "Gestion",
              path: "/admin/utilisateurs",
              icon: UserCog,
            },
            {
              id: "admin-utilisateurs-audit",
              label: "Audit des connexions",
              path: "/admin/audit-connexions",
              icon: History,
            },
            {
              id: "admin-utilisateurs-audit-actions",
              label: "Audit d'actions",
              path: "/admin/audit-actions",
              icon: ScrollText,
            },
          ],
        },
      ],
    },
  ],
  accountMenu: [
    {
      id: "admin-profile",
      label: "Profil",
      path: "/admin/profile",
      icon: User,
    },
    {
      id: "admin-mes-actions",
      label: "Audit d'actions",
      path: "/admin/mes-actions",
      icon: ScrollText,
    },
  ],
};
