import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Circle } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  FOOTER_MENU,
  getPortalMenu,
  resolveNavPath,
} from "@/shared/config/menu";
import { useAuth } from "@/shared/hooks/use-auth";
import type { Portail } from "@/shared/hooks/auth-context";
import type { MenuNavItem } from "@/shared/types/menu.interface";
import { Guilloche } from "@/shared/components/layout/Guilloche";

const LOGO_GESPOF = "/GESPOF-logo-tr.png";
/** Fond nuit Courrier (`--dgcpt-nuit`) pour la sidebar SR. */
const SR_SIDEBAR_BG = "#041A33";

/**
 * « 05/10/2026 16:22:59 » (ou ISO) → « Connecté le 05/10 à 16:22 » : sans libellé,
 * l'horodatage se confondait avec l'heure actuelle.
 */
function libelleConnexion(valeur: string): string {
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2}):(\d{2})/.exec(valeur);
  if (fr) {
    const [, jour, mois, annee, heures, minutes] = fr;
    const anneeAffichee =
      Number(annee) !== new Date().getFullYear() ? `/${annee}` : "";
    return `Connecté le ${jour}/${mois}${anneeAffichee} à ${heures}:${minutes}`;
  }
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return `Connecté le ${valeur}`;
  const jj = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const anneeAffichee =
    date.getFullYear() !== new Date().getFullYear()
      ? `/${date.getFullYear()}`
      : "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `Connecté le ${jj}/${mm}${anneeAffichee} à ${hh}:${mi}`;
}

/**
 * Largeur de la barre laterale depliee : ajustee au contenu de CHAQUE portail,
 * via `largeurMenu` dans src/portails/<Portail>/menu.ts — un menu aux intitules
 * courts n'occupe pas la largeur qu'exige un menu aux intitules longs.
 *
 * Cette largeur est declaree, pas mesuree sur le rendu : une mesure change au
 * chargement de la police web, et la barre s'affichait alors a une largeur puis
 * retrecissait toute seule. Les libelles qui depasseraient sont tronques
 * (classe `truncate`), l'intitule complet restant dans l'infobulle.
 *
 * Repere pour choisir une valeur : ~67px de decor (marge du menu, marge de
 * l'entree, filet, icone) + la largeur du plus long libelle, sans descendre
 * sous ~240px, plancher de l'en-tete (logo + nom du service du portail).
 *
 * Rail replie : largeur resserree (icones plus grandes, peu de padding).
 * L'animation ne "seque" pas les libelles : le coeur interne garde la largeur
 * depliee et le aside parent le rogne (overflow), au lieu de compresser le flex.
 */
export const LARGEUR_DEPLIEE_DEFAUT = 260;
export const LARGEUR_REPLIEE = 64;
const DUREE_TRANSITION_MS = 300;

interface AppSidebarProps {
  portal: Portail;
  /** Mode rail : seules les icones sont affichees. Pilote par AppTopBar. */
  collapsed: boolean;
  /** Occupe toute la largeur du parent (panneau Resizable). */
  remplirLargeur?: boolean;
}

export function AppSidebar({
  portal,
  collapsed,
  remplirLargeur = false,
}: AppSidebarProps) {
  const { hasAnyRole, user } = useAuth();
  const location = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const menu = getPortalMenu(portal);
  const theme = menu.theme;
  const largeurDepliee = menu.largeurMenu ?? LARGEUR_DEPLIEE_DEFAUT;

  // Libelles masques tout de suite au repli ; reapparait apres l'elargissement.
  const [labelsVisibles, setLabelsVisibles] = useState(!collapsed);
  useEffect(() => {
    if (collapsed) {
      setLabelsVisibles(false);
      return;
    }
    const id = window.setTimeout(
      () => setLabelsVisibles(true),
      DUREE_TRANSITION_MS * 0.55,
    );
    return () => window.clearTimeout(id);
  }, [collapsed]);

  // Voiles degrades en haut / bas du menu : ils n'apparaissent que du cote ou il
  // reste des entrees hors champ, et signalent ainsi qu'il y a de quoi defiler.
  const navRef = useRef<HTMLElement>(null);
  const contenuNavRef = useRef<HTMLDivElement>(null);
  const [voiles, setVoiles] = useState({ haut: false, bas: false });

  useEffect(() => {
    const nav = navRef.current;
    const contenu = contenuNavRef.current;
    if (!nav || !contenu) return;

    const majVoiles = () => {
      const haut = nav.scrollTop > 2;
      const bas = nav.scrollHeight - nav.clientHeight - nav.scrollTop > 2;
      setVoiles((v) => (v.haut === haut && v.bas === bas ? v : { haut, bas }));
    };

    majVoiles();
    nav.addEventListener("scroll", majVoiles, { passive: true });
    // Le contenu change de hauteur quand une section se deplie ou que le menu se replie.
    const observer = new ResizeObserver(majVoiles);
    observer.observe(contenu);
    observer.observe(nav);

    return () => {
      nav.removeEventListener("scroll", majVoiles);
      observer.disconnect();
    };
  }, []);

  // A la navigation, ramene l'entree active dans le champ si elle est hors vue —
  // le defilement est anime par .scroll-fluide (scroll-behavior: smooth) et reste
  // confine au menu : aucun autre conteneur de la page n'est deplace.
  useEffect(() => {
    const nav = navRef.current;
    const actif = nav?.querySelector<HTMLElement>('[data-actif="true"]');
    if (!nav || !actif) return;

    const zone = nav.getBoundingClientRect();
    const cible = actif.getBoundingClientRect();
    const marge = 12;

    const delta =
      cible.top < zone.top + marge
        ? cible.top - zone.top - marge
        : cible.bottom > zone.bottom - marge
          ? cible.bottom - zone.bottom + marge
          : 0;

    if (delta !== 0) nav.scrollBy({ top: delta });
  }, [location.pathname]);

  const visible = (item: MenuNavItem) => !item.roles || hasAnyRole(item.roles);
  const isActivePath = (path: string) =>
    resolveNavPath(location.pathname) === path;
  const hasActiveChild = (item: MenuNavItem): boolean =>
    (item.children ?? []).some(
      (c) => isActivePath(c.path) || hasActiveChild(c),
    );
  const isExpanded = (item: MenuNavItem) =>
    expanded[item.id] ?? hasActiveChild(item);

  const filtrerArbre = (items: MenuNavItem[]): MenuNavItem[] =>
    items.filter(visible).map((item) => ({
      ...item,
      children: filtrerArbre(item.children ?? []),
    }));

  // Sections du portail (src/portails/<Portail>/menu.ts), filtrees sur les roles
  // de l'utilisateur : une section dont toutes les entrees sont masquees disparait.
  const sections = menu.sections
    .map((section) => ({
      ...section,
      items: filtrerArbre(section.items),
    }))
    .filter((section) => section.items.length > 0);

  const ordreEntrees = sections.flatMap((s) => s.items.map((i) => i.id));
  const entranceDelay = (id: string) => {
    const i = ordreEntrees.indexOf(id);
    return `${Math.min(i, 10) * 35}ms`;
  };

  const tailleIcone = collapsed ? 20 : 16;
  // SR : fond nuit Courrier ; autres portails : couleur métier + même motif.
  const sb = portal === "sr" ? SR_SIDEBAR_BG : theme.sidebarBg;

  const premiereFeuille = (item: MenuNavItem): string => {
    const kids = item.children ?? [];
    if (kids.length === 0) return item.path;
    return premiereFeuille(kids[0]);
  };

  const renderNavItem = (item: MenuNavItem, depth = 0) => {
    const Icon = item.icon;
    const enfants = item.children ?? [];
    const expandable = enfants.length > 0 && labelsVisibles;
    const opened = isExpanded(item);
    const childActive = hasActiveChild(item);
    const active = expandable
      ? false
      : collapsed && enfants.length > 0
        ? childActive || isActivePath(item.path)
        : isActivePath(item.path);
    const cibleParent = enfants.length > 0 ? premiereFeuille(item) : item.path;
    const nested = depth > 0;
    // Maquette : icônes au niveau racine / groupes / entrées avec icône dédiée ;
    // feuilles `Circle` (placeholder) sans icône visible.
    const showIcon = depth === 0 || enfants.length > 0 || item.icon !== Circle;

    return (
      <div
        key={item.id}
        className={cn(!nested && "mb-px [animation:fadeUp_.4s_ease_both]")}
        style={!nested ? { animationDelay: entranceDelay(item.id) } : undefined}
      >
        <div
          className={cn(
            "group/row flex items-center",
            expandable &&
              "rounded-md transition-[background-color] duration-150 hover:bg-white/10",
          )}
        >
          <Link
            to={cibleParent}
            title={item.label}
            data-actif={active ? "true" : undefined}
            onClick={() => {
              if (enfants.length > 0) {
                setExpanded((s) => ({ ...s, [item.id]: true }));
              }
            }}
            className={cn(
              "group relative flex flex-1 items-center overflow-hidden transition-[color,background-color,box-shadow] duration-150",
              nested
                ? "min-h-8 gap-2 rounded-[5px] px-2.5 py-1.5 text-[13px] leading-[1.35]"
                : cn(
                    "gap-2.5 text-sm",
                    collapsed
                      ? "min-h-9 justify-center px-0"
                      : "min-h-9 justify-start px-2.5 py-[7px]",
                  ),
              expandable
                ? "rounded-l-md rounded-r-none"
                : nested
                  ? "rounded-[5px]"
                  : "rounded-md",
              active
                ? "font-semibold text-white"
                : nested
                  ? "font-normal text-white/85"
                  : "font-normal text-white/90",
              !active && !expandable && "hover:bg-white/10",
            )}
            style={
              active
                ? {
                    background: "rgba(255,255,255,0.14)",
                    boxShadow: nested ? undefined : "inset 3px 0 0 #fff",
                  }
                : undefined
            }
          >
            {showIcon ? (
              <Icon
                size={nested ? 15 : tailleIcone}
                className="relative flex-shrink-0 opacity-90"
                style={{ color: active ? "#fff" : "rgba(255,255,255,0.85)" }}
              />
            ) : null}
            {labelsVisibles ? (
              <span className="relative min-w-0 flex-1 truncate leading-[1.3]">
                {item.label}
              </span>
            ) : null}
            {expandable && labelsVisibles ? (
              <span className="text-white/60" aria-hidden />
            ) : null}
          </Link>

          {expandable && (
            <button
              type="button"
              onClick={() => {
                setExpanded((s) => ({ ...s, [item.id]: !opened }));
              }}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-r-md text-white/60 transition-colors hover:text-white",
                nested ? "h-8 w-6" : "h-9 w-6",
              )}
              aria-label={opened ? "Réduire" : "Développer"}
              aria-expanded={opened}
            >
              <ChevronRight
                size={14}
                className={cn(
                  "transition-transform duration-180",
                  opened && "rotate-90",
                )}
              />
            </button>
          )}
        </div>

        {expandable && (
          <div
            className={cn(
              "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              depth === 0 ? "ml-[19px]" : "ml-[14px]",
            )}
            style={{ gridTemplateRows: opened ? "1fr" : "0fr" }}
          >
            <div
              className={cn(
                "relative flex min-h-0 flex-col gap-px overflow-hidden py-0.5 pl-2.5",
                depth >= 1 && "border-l border-dashed border-white/28",
              )}
            >
              {depth === 0 ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1 left-0 w-px bg-white/22"
                />
              ) : null}
              {enfants.map((child) => renderNavItem(child, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderNavGroup = (items: MenuNavItem[]) =>
    items.map((item) => renderNavItem(item));

  const largeurAside = remplirLargeur
    ? "100%"
    : `${collapsed ? LARGEUR_REPLIEE : largeurDepliee}px`;
  // Coeur : en mode deplie, largeur min = largeurMenu pour ne jamais ecraser
  // les libelles si le panneau Resizable passe sous ce seuil (le aside rogne).
  // En mode replie + remplirLargeur, on garde la largeur depliee pour que le
  // parent clippe pendant l'animation au lieu de compresser le flex.
  const largeurCoeur = collapsed
    ? remplirLargeur
      ? largeurDepliee
      : LARGEUR_REPLIEE
    : remplirLargeur
      ? "100%"
      : largeurDepliee;

  return (
    <aside
      className={cn(
        "relative z-10 flex h-full flex-col overflow-hidden text-white",
        remplirLargeur
          ? "min-h-0 w-full"
          : "flex-shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
      )}
      style={{
        width: largeurAside,
        background: sb,
        isolation: "isolate",
      }}
    >
      <Guilloche opacite={0.08} />
      <div
        className="relative z-[1] flex h-full min-h-0 flex-col"
        style={{
          width: largeurCoeur,
          minWidth: collapsed ? undefined : largeurDepliee,
        }}
      >
        {/* En-tête logos — en repli, ancré à gauche (zone visible 64px), pas centré sur la largeur dépliée */}
        <div
          className={cn(
            "flex min-h-[72px] shrink-0 items-center border-b border-white/14 bg-black/14 transition-[padding] duration-300",
            collapsed ? "px-0 py-3" : "gap-2.5 px-4 py-3.5",
          )}
        >
          <Link
            to="/portail"
            title={`${menu.sidebarBrandTitle ?? menu.title} — ${menu.sidebarBrandSubtitle ?? menu.subtitle}`}
            className={cn(
              "flex items-center gap-2.5",
              collapsed && "w-16 justify-center",
            )}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white p-0.5">
              <img
                src={LOGO_GESPOF}
                alt="GESPOF"
                className="size-10 rounded-full object-contain"
              />
            </span>
            {labelsVisibles ? (
              menu.sidebarBrandTitle ? (
                <div className="flex min-w-0 flex-col leading-[1.2]">
                  <span
                    className="truncate text-[18px] font-semibold"
                    style={{
                      fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif',
                    }}
                  >
                    {menu.sidebarBrandTitle}
                  </span>
                  {menu.sidebarBrandSubtitle ? (
                    <span className="truncate text-[11px] text-white/80">
                      {menu.sidebarBrandSubtitle}
                    </span>
                  ) : null}
                </div>
              ) : menu.logo ? (
                <img
                  src={menu.logo}
                  alt={`${menu.title} — ${menu.subtitle}`}
                  className="h-8 max-w-[178px] min-w-0 object-contain object-left brightness-0 invert"
                />
              ) : (
                <div className="flex min-w-0 flex-col leading-[1.15]">
                  <span
                    className="truncate text-[17px] font-semibold"
                    style={{
                      fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif',
                    }}
                  >
                    {menu.title}
                  </span>
                  <span className="text-[9px] tracking-[0.2em] text-white/75">
                    {menu.subtitle}
                  </span>
                </div>
              )
            ) : null}
          </Link>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <nav
            ref={navRef}
            className={cn(
              "scrollbar-none scroll-fluide min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
              collapsed ? "px-1.5 py-2" : "px-2.5 pb-4 pt-2",
            )}
          >
            <div
              ref={contenuNavRef}
              style={collapsed ? { width: LARGEUR_REPLIEE - 12 } : undefined}
            >
              {sections.map((section) => (
                <div key={section.id} className="flex flex-col gap-px pt-3">
                  {section.label && labelsVisibles && (
                    <p className="px-2.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/62">
                      {section.label}
                    </p>
                  )}
                  {renderNavGroup(section.items)}
                </div>
              ))}
            </div>
          </nav>

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-8 transition-opacity duration-300 ease-out"
            style={{
              opacity: voiles.haut ? 1 : 0,
              background: `linear-gradient(to bottom, ${sb}, transparent)`,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 transition-opacity duration-300 ease-out"
            style={{
              opacity: voiles.bas ? 1 : 0,
              background: `linear-gradient(to top, ${sb}, transparent)`,
            }}
          />
        </div>

        <div
          className={cn(
            "flex shrink-0 flex-col gap-1 border-t border-white/14 bg-black/10 text-[12px] text-white/80",
            collapsed ? "px-1.5 py-2" : "px-[18px] py-3",
          )}
        >
          <span
            className="flex items-center gap-2 text-white"
            style={{
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <span className="size-[7px] shrink-0 rounded-full bg-[#4ade80]" />
            {labelsVisibles ? "Système opérationnel" : null}
          </span>
          {labelsVisibles && menu.sidebarFooterCaption ? (
            <span className="truncate" title={menu.sidebarFooterCaption}>
              {menu.sidebarFooterCaption}
            </span>
          ) : (
            FOOTER_MENU.map((item) => {
              const valeur =
                item.id === "last-connexion" ? user?.derniereConnexion : null;
              if (!labelsVisibles) return null;
              return (
                <span
                  key={item.id}
                  title={valeur ? `${item.label} : ${valeur}` : item.label}
                  className="truncate"
                >
                  {valeur ? libelleConnexion(valeur) : item.label}
                </span>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
