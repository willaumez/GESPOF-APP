import type { Portail, RoleUtilisateur } from "@/shared/hooks/auth-context";
import type { MenuConfig, MenuPortal } from "@/shared/types/menu.interface";
import { rolesEffectifs } from "@/shared/lib/roles";
import menuData from "./menu.json";

export const MENU = menuData as unknown as MenuConfig;

export function getPortalMenu(id: Portail): MenuPortal {
  const portal = MENU.portails.find((p) => p.id === id);
  if (!portal) throw new Error(`Aucune configuration de menu pour le portail "${id}"`);
  return portal;
}

export function getAccessiblePortails(roles: RoleUtilisateur[]): MenuPortal[] {
  const effectifs = rolesEffectifs(roles);
  return MENU.portails.filter((p) => p.roles.some((r) => effectifs.has(r)));
}

interface MenuLookupItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

export function getNavItem(menu: MenuPortal, id: string): MenuLookupItem | undefined {
  for (const item of menu.nav) {
    if (item.id === id) return item;
    const child = item.children.find((c) => c.id === id);
    if (child) return child;
  }
  return menu.accountMenu.find((a) => a.id === id);
}

const SOUS_PAGES_VERS_MENU: { prefix: string; path: string }[] = [
  { prefix: "/dr/fiche/", path: "/dr/fiches-depenses" },
];

export function resolveNavPath(pathname: string): string {
  const correspondance = SOUS_PAGES_VERS_MENU.find((s) => pathname.startsWith(s.prefix));
  return correspondance ? correspondance.path : pathname;
}

export interface PageInfo {
  label: string;
  path: string | null;
}

export function findPageInfo(portal: Portail, pathname: string): PageInfo {
  const menu = getPortalMenu(portal);
  const resolved = resolveNavPath(pathname);
  for (const item of menu.nav) {
    if (item.path === resolved) return { label: item.label, path: item.path };
    const child = item.children.find((c) => c.path === resolved);
    if (child) return { label: child.label, path: child.path };
  }
  return {
    label: menu.nav[0]?.label ?? menu.title,
    path: menu.nav[0]?.path ?? null,
  };
}
