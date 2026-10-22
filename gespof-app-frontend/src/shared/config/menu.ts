import { LogIn } from "lucide-react";
import type { Portail, RoleUtilisateur } from "@/shared/hooks/auth-context";
import type {
  MenuFooterItem, MenuNavItem, MenuPortal,
} from "@/shared/types/menu.interface";
import { rolesEffectifs } from "@/shared/lib/roles";
import { MENU_SOF } from "@/portails/Sof/menu";
import { MENU_SP } from "@/portails/Sp/menu";
import { MENU_SR } from "@/portails/Sr/menu";
import { MENU_ADMIN } from "@/portails/Admin/menu";

/**
 * Assemblage des menus : chaque portail definit le sien dans
 * `src/portails/<Portail>/menu.ts`. Ce fichier ne fait que les rassembler et
 * exposer les fonctions de recherche communes — pour ajouter ou modifier une
 * entree, editer le fichier du portail concerne, pas celui-ci. Seul l'ajout
 * d'un nouveau portail se repercute ici (une ligne dans PORTAILS).
 */
export const PORTAILS: MenuPortal[] = [MENU_SOF, MENU_SP, MENU_SR, MENU_ADMIN];

/** Bas de la barre laterale, commun a tous les portails. */
export const FOOTER_MENU: MenuFooterItem[] = [
  { id: "last-connexion", label: "Dernière connexion", icon: LogIn },
];

export function getPortalMenu(id: Portail): MenuPortal {
  const portal = PORTAILS.find((p) => p.id === id);
  if (!portal) throw new Error(`Aucune configuration de menu pour le portail "${id}"`);
  return portal;
}

export function getAccessiblePortails(roles: RoleUtilisateur[]): MenuPortal[] {
  const effectifs = rolesEffectifs(roles);
  return PORTAILS.filter((p) => p.roles.some((r) => effectifs.has(r)));
}

/** Entrees du portail a plat (sections + sous-entrees), dans l'ordre d'affichage. */
export function getNavItems(menu: MenuPortal): MenuNavItem[] {
  return menu.sections.flatMap((s) => s.items.flatMap((i) => [i, ...(i.children ?? [])]));
}

export function getNavItem(menu: MenuPortal, id: string): MenuNavItem | undefined {
  return getNavItems(menu).find((i) => i.id === id)
    ?? menu.accountMenu.find((a) => a.id === id);
}

/**
 * Chemin de l'entree de menu correspondant a une URL : une sous-page declaree
 * par un portail (MenuPortal.sousPages) garde active l'entree dont elle depend.
 */
export function resolveNavPath(pathname: string): string {
  for (const portail of PORTAILS) {
    const sousPage = portail.sousPages?.find((s) => pathname.startsWith(s.prefix));
    if (sousPage) return sousPage.path;
  }
  return pathname;
}

export interface PageInfo {
  label: string;
  path: string | null;
}

export function findPageInfo(portal: Portail, pathname: string): PageInfo {
  const menu = getPortalMenu(portal);
  const resolved = resolveNavPath(pathname);

  for (const section of menu.sections) {
    for (const item of section.items) {
      const enfant = (item.children ?? []).find((c) => c.path === resolved);
      if (enfant) return { label: enfant.label, path: enfant.path };
    }
  }

  const items = getNavItems(menu);
  const trouve = items.find((i) => i.path === resolved);
  if (trouve) return { label: trouve.label, path: trouve.path };

  const compte = menu.accountMenu.find((a) => a.path === resolved);
  if (compte) return { label: compte.label, path: compte.path };

  return {
    label: items[0]?.label ?? menu.title,
    path: items[0]?.path ?? null,
  };
}

export interface BreadcrumbItem {
  label: string;
  /** Absent = page courante (non cliquable). */
  href?: string;
}

/**
 * Segments du fil d'Ariane pour la topbar : portail → page menu → sous-page éventuelle.
 */
export function getBreadcrumbItems(
  portal: Portail,
  pathname: string,
): BreadcrumbItem[] {
  const menu = getPortalMenu(portal);
  const crumbs: BreadcrumbItem[] = [{ label: menu.title, href: menu.path }];
  const resolved = resolveNavPath(pathname);
  const sousPage = menu.sousPages?.find((s) => pathname.startsWith(s.prefix));

  for (const section of menu.sections) {
    for (const item of section.items) {
      const enfant = (item.children ?? []).find((c) => c.path === resolved);
      if (enfant) {
        crumbs.push({ label: item.label, href: item.path });
        if (sousPage?.breadcrumb) {
          crumbs.push({ label: enfant.label, href: enfant.path });
          crumbs.push({ label: sousPage.breadcrumb });
          return crumbs;
        }
        crumbs.push({ label: enfant.label });
        return crumbs;
      }
    }
  }

  const compte = menu.accountMenu.find((a) => a.path === resolved);
  if (compte) {
    crumbs.push({ label: compte.label });
    return crumbs;
  }

  const page = findPageInfo(portal, pathname);
  if (sousPage?.breadcrumb) {
    crumbs.push({ label: page.label, href: page.path ?? undefined });
    crumbs.push({ label: sousPage.breadcrumb });
    return crumbs;
  }

  crumbs.push({ label: page.label });
  return crumbs;
}
