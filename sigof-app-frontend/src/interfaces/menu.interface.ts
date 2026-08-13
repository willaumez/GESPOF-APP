import type { RoleUtilisateur, Portail } from "@/contexts/auth-context";

export interface MenuNavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  roles: RoleUtilisateur[] | null;
  children: MenuNavItem[];
}

export interface MenuAccountItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  roles: RoleUtilisateur[] | null;
}

export interface MenuFooterItem {
  id: string;
  label: string;
  icon: string;
}

export interface MenuPortalTheme {
  topColor: string;
  bgColor: string;
  iconBg: string;
  iconColor: string;
  ctaColor: string;
  hoverColor: string;
}

export interface MenuSection {
  id: string;
  label: string;
  items: string[];
}

export interface MenuPortal {
  id: Portail;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  path: string;
  badge: string | null;
  ctaLabel: string;
  roles: RoleUtilisateur[];
  theme: MenuPortalTheme;
  sections: MenuSection[];
  nav: MenuNavItem[];
  accountMenu: MenuAccountItem[];
}

export interface MenuConfig {
  portails: MenuPortal[];
  footerMenu: MenuFooterItem[];
}
