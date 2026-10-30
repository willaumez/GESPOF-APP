import { Clock, FilePlus, History, Landmark, ScrollText, User, UserCog, Users, Zap } from "lucide-react";
import type { MenuPortal } from "@/shared/types/menu.interface";

/**
 * Menu du portail SR — fichier autonome : les entrées, les sections et le
 * thème de ce portail se modifient ici, sans toucher aux autres portails.
 * L'assemblage des quatre menus est fait dans shared/config/menu.ts.
 */
export const MENU_SR: MenuPortal = {
  id: "sr",
  title: "Service Règlement",
  subtitle: "Pool SR",
  description: "Génération de la fiche de dépôt et transmission vers SP.",
  icon: Landmark,
  logo: "/SR-logo.png",
  path: "/sr",
  badge: "NOUVEAU",
  ctaLabel: "Accéder au Pool SR",
  roles: ["AGENT_SR"],
  theme: {
    topColor: "#0760A8",
    bgColor: "#EFF4FB",
    iconBg: "#D6E2F5",
    iconColor: "#0760A8",
    ctaColor: "#0760A8",
    hoverColor: "#064A85",
  },
  // Largeur de la barre laterale : "Générer une fiche de dépôt" / "Audit des connexions".
  largeurMenu: 268,
  sections: [
    {
      id: "sr-generation",
      label: "GÉNÉRATION",
      items: [
        {
          id: "sr-tableau-de-bord",
          label: "Tableau de bord",
          path: "/sr/tableau-de-bord",
          icon: Zap,
          roles: ["AGENT_SR"],
        },
        {
          id: "sr-generer",
          label: "Générer une fiche de dépôt",
          path: "/sr/generer",
          icon: FilePlus,
          roles: ["AGENT_SR"],
        },
      ],
    },
    {
      id: "sr-consultation",
      label: "CONSULTATION",
      items: [
        {
          id: "sr-fiches-depenses",
          label: "Liste des fiches de dépôt",
          path: "/sr/fiches-depenses",
          icon: Clock,
          roles: ["AGENT_SR"],
        },
        {
          id: "sr-historique",
          label: "Historique",
          path: "/sr/historique",
          icon: History,
          roles: ["AGENT_SR"],
        },
      ],
    },
    {
      id: "sr-gestion",
      label: "ADMINISTRATION",
      items: [
        {
          id: "sr-utilisateurs",
          label: "Utilisateurs",
          path: "/sr/utilisateurs",
          icon: Users,
          roles: ["CHEF_SR"],
          children: [
            {
              id: "sr-utilisateurs-gestion",
              label: "Gestion",
              path: "/sr/utilisateurs",
              icon: UserCog,
              roles: ["CHEF_SR"],
            },
            {
              id: "sr-utilisateurs-audit",
              label: "Audit des connexions",
              path: "/sr/audit-connexions",
              icon: History,
              roles: ["CHEF_SR"],
            },
            {
              id: "sr-utilisateurs-audit-actions",
              label: "Audit d'actions",
              path: "/sr/audit-actions",
              icon: ScrollText,
              roles: ["CHEF_SR"],
            },
          ],
        },
      ],
    },
  ],
  accountMenu: [
    {
      id: "sr-profile",
      label: "Profil",
      path: "/sr/profile",
      icon: User,
    },
    {
      id: "sr-mes-actions",
      label: "Audit d'actions",
      path: "/sr/mes-actions",
      icon: ScrollText,
    },
  ],
  // Le détail d'une fiche n'a pas d'entrée de menu : il garde active celle de la liste.
  sousPages: [{ prefix: "/sr/fiche/", path: "/sr/fiches-depenses" }],
};
