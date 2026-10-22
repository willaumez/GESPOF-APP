import type { LucideIcon } from "lucide-react";
import type { RoleUtilisateur, Portail } from "@/shared/hooks/auth-context";

/**
 * Types du menu. Chaque portail décrit son propre menu dans
 * `src/portails/<Portail>/menu.ts` ; shared/config/menu.ts ne fait que les
 * rassembler et fournir les fonctions de recherche.
 */

export interface MenuNavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Rôles autorisés à voir l'entrée. Omis = visible par tous les accès au portail. */
  roles?: RoleUtilisateur[];
  /** Sous-entrées dépliables. Omis = entrée simple. */
  children?: MenuNavItem[];
}

/** Groupe d'entrées dans la barre latérale. `label: null` = groupe sans titre, en tête du menu. */
export interface MenuSection {
  id: string;
  label: string | null;
  items: MenuNavItem[];
}

export interface MenuAccountItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  roles?: RoleUtilisateur[];
}

export interface MenuFooterItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface MenuPortalTheme {
  topColor: string;
  bgColor: string;
  iconBg: string;
  iconColor: string;
  ctaColor: string;
  hoverColor: string;
}

/** Sous-page sans entrée de menu : elle garde active l'entrée `path` (ex. /sr/fiche/12). */
export interface MenuSousPage {
  prefix: string;
  path: string;
  /** Libellé du dernier segment du fil d'Ariane (ex. « Journée de trésorerie »). */
  breadcrumb?: string;
}

export interface MenuPortal {
  id: Portail;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  /**
   * Logo du service (chemin d'un fichier de public/), affiché à côté du logo
   * GESPOF dans l'en-tête de la barre latérale. Omis = nom du service en texte.
   */
  logo?: string;
  path: string;
  badge: string | null;
  ctaLabel: string;
  /** Rôles donnant accès au portail (la hiérarchie est appliquée, voir shared/lib/roles.ts). */
  roles: RoleUtilisateur[];
  theme: MenuPortalTheme;
  sections: MenuSection[];
  accountMenu: MenuAccountItem[];
  sousPages?: MenuSousPage[];
  /**
   * Largeur de la barre laterale depliee, en pixels. Chaque portail fixe la
   * sienne d'apres ses propres libelles : un menu aux intitules courts (SP) n'a
   * pas a occuper la place qu'exige un menu aux intitules longs (SOF). Omise =
   * LARGEUR_DEPLIEE_DEFAUT (voir AppSidebar).
   */
  largeurMenu?: number;
}
