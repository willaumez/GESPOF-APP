import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  FOOTER_MENU,
  getPortalMenu,
  resolveNavPath,
} from "@/shared/config/menu";
import { useAuth } from "@/shared/hooks/use-auth";
import type { Portail } from "@/shared/hooks/auth-context";
import type { MenuNavItem } from "@/shared/types/menu.interface";
import logo from "@/shared/assets/GESPOF-logo-tr.png";

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
  const hasActiveChild = (item: MenuNavItem) =>
    (item.children ?? []).some((c) => isActivePath(c.path));
  const isExpanded = (item: MenuNavItem) =>
    expanded[item.id] ?? hasActiveChild(item);

  // Sections du portail (src/portails/<Portail>/menu.ts), filtrees sur les roles
  // de l'utilisateur : une section dont toutes les entrees sont masquees disparait.
  const sections = menu.sections
    .map((section) => ({
      ...section,
      items: section.items.filter(visible).map((item) => ({
        ...item,
        children: (item.children ?? []).filter(visible),
      })),
    }))
    .filter((section) => section.items.length > 0);

  const ordreEntrees = sections.flatMap((s) => s.items.map((i) => i.id));
  const entranceDelay = (id: string) => {
    const i = ordreEntrees.indexOf(id);
    return `${Math.min(i, 10) * 35}ms`;
  };

  const tailleIcone = collapsed ? 20 : 16;

  const renderNavItem = (item: MenuNavItem) => {
    const Icon = item.icon;
    const enfants = item.children ?? [];
    const premierEnfant = enfants[0];
    const expandable = enfants.length > 0 && labelsVisibles;
    const opened = isExpanded(item);
    const childActive = hasActiveChild(item);
    const active = expandable
      ? false
      : collapsed && enfants.length > 0
        ? childActive || isActivePath(item.path)
        : isActivePath(item.path);
    const activeColor = theme.topColor;
    const cibleParent = premierEnfant?.path ?? item.path;

    return (
      <div
        key={item.id}
        className="mb-0.5 [animation:fadeUp_.4s_ease_both]"
        style={{ animationDelay: entranceDelay(item.id) }}
      >
        <div
          className={cn(
            "group/row flex items-center",
            expandable &&
              "rounded-md transition-[background-color] duration-[120ms] ease-[cubic-bezier(0,0,0.2,1)] hover:bg-white/[0.08]",
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
              "group relative flex flex-1 items-center gap-2 overflow-hidden text-sm font-medium transition-[color,background-color,box-shadow,transform] duration-[120ms] ease-[cubic-bezier(0,0,0.2,1)] active:scale-[0.98]",
              collapsed ? "h-10 justify-center px-0" : "h-9 justify-start px-2",
              expandable ? "rounded-l-md rounded-r-none" : "rounded-md",
              active
                ? "font-semibold"
                : expandable
                  ? "text-foreground/80 hover:text-foreground"
                  : "text-foreground/80 hover:bg-white/[0.08] hover:text-foreground",
            )}
            style={
              active
                ? {
                    color: activeColor,
                    background: `linear-gradient(90deg, ${activeColor}38 0%, ${activeColor}0f 100%)`,
                    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.35)",
                  }
                : undefined
            }
          >
            {active ? (
              <span
                aria-hidden
                className="pointer-events-none absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm"
                style={{
                  background: `linear-gradient(180deg, ${activeColor}, ${activeColor}cc)`,
                  boxShadow: `0 0 10px ${activeColor}73`,
                }}
              />
            ) : null}
            <Icon
              size={tailleIcone}
              className="relative flex-shrink-0 transition-transform duration-[120ms] ease-[cubic-bezier(0,0,0.2,1)] group-hover:scale-110"
              style={active ? { color: activeColor } : undefined}
            />
            {labelsVisibles ? (
              <span className="relative min-w-0 flex-1 truncate">
                {item.label}
              </span>
            ) : null}
          </Link>

          {expandable && (
              <button
              type="button"
              onClick={() => {
                setExpanded((s) => ({ ...s, [item.id]: !opened }));
              }}
              className="flex h-9 w-6 shrink-0 items-center justify-center rounded-r-md text-foreground/55 transition-[color,transform] duration-[120ms] ease-[cubic-bezier(0,0,0.2,1)] hover:text-foreground"
              aria-label={opened ? "Réduire" : "Développer"}
              aria-expanded={opened}
            >
              <ChevronRight
                size={14}
                className={cn(
                  "transition-transform duration-[180ms] ease-[cubic-bezier(0,0,0.2,1)]",
                  opened && "rotate-90",
                )}
              />
            </button>
          )}
        </div>

        {expandable && (
          <div
            className="ml-[19px] grid overflow-hidden transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ gridTemplateRows: opened ? "1fr" : "0fr" }}
          >
            <div className="relative flex min-h-0 flex-col overflow-hidden pb-1.5 pl-3.5">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  borderLeft: `3px solid ${activeColor}`,
                  borderBottom: `3px solid ${activeColor}`,
                  borderBottomLeftRadius: 14,
                  opacity: opened ? 0.55 : 0,
                  clipPath: opened ? "inset(0 0 0 0)" : "inset(100% 0 0 0)",
                  transition: opened
                    ? "clip-path 400ms cubic-bezier(0.22, 1, 0.36, 1) 50ms, opacity 200ms ease"
                    : "clip-path 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease",
                }}
              />
              {enfants.map((child, index) => {
                const ChildIcon = child.icon;
                const enfantActif = isActivePath(child.path);
                return (
                  <Link
                    key={child.id}
                    to={child.path}
                    title={child.label}
                    data-actif={enfantActif ? "true" : undefined}
                    className={cn(
                      "group relative mt-0.5 flex h-8 items-center gap-2 overflow-hidden rounded-md px-2 text-[13px] font-medium transition-[color,background-color,box-shadow,transform,opacity] duration-[120ms] ease-[cubic-bezier(0,0,0.2,1)] active:scale-[0.98]",
                      opened
                        ? "translate-x-0 opacity-100"
                        : "-translate-x-1.5 opacity-0",
                      !enfantActif &&
                        "text-foreground/80 hover:bg-white/[0.08] hover:text-foreground",
                      enfantActif && "font-semibold",
                    )}
                    style={{
                      transitionDelay: opened ? `${40 + index * 45}ms` : "0ms",
                      ...(enfantActif
                        ? {
                            color: activeColor,
                            background: `linear-gradient(90deg, ${activeColor}38 0%, ${activeColor}0f 100%)`,
                            boxShadow:
                              "inset 0 1px 0 rgba(255, 255, 255, 0.35)",
                          }
                        : undefined),
                    }}
                  >
                    {enfantActif ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-sm"
                        style={{
                          background: `linear-gradient(180deg, ${activeColor}, ${activeColor}cc)`,
                          boxShadow: `0 0 10px ${activeColor}73`,
                        }}
                      />
                    ) : null}
                    <ChildIcon
                      size={14}
                      className="relative flex-shrink-0 transition-transform duration-[120ms] ease-[cubic-bezier(0,0,0.2,1)] group-hover:scale-110"
                      style={
                        enfantActif ? { color: activeColor } : undefined
                      }
                    />
                    <span className="relative truncate">{child.label}</span>
                  </Link>
                );
              })}
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
        "relative z-10 flex h-full flex-col overflow-hidden",
        remplirLargeur
          ? "min-h-0 w-full"
          : "flex-shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
      )}
      style={{
        width: largeurAside,
        background: theme.bgColor,
        borderRight: remplirLargeur ? "none" : `1px solid ${theme.topColor}22`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[3px]"
        style={{ background: theme.topColor }}
      />

      {/*
        Coeur a largeur depliee minimale : pendant le repli / un drag trop serre,
        le parent rogne au lieu de comprimer les libelles / le flex.
      */}
      <div
        className="flex h-full min-h-0 flex-col"
        style={{
          width: largeurCoeur,
          minWidth: collapsed ? undefined : largeurDepliee,
        }}
      >
        {/* En-tete : logo + identite du service du portail.
            Le repli de la barre est commande depuis AppTopBar. */}
        <div
          className={cn(
            "flex-shrink-0 transition-[padding] duration-300",
            collapsed ? "px-1.5 py-3" : "px-4 py-4",
          )}
          style={{ borderBottom: `1px solid ${theme.topColor}1a` }}
        >
          <Link
            to="/portail"
            title={`${menu.title} — ${menu.subtitle}`}
            className={cn(
              "flex items-center gap-2.5",
              collapsed && "w-full justify-center",
            )}
            style={collapsed ? { width: LARGEUR_REPLIEE - 12 } : undefined}
          >
            <img
              src={logo}
              alt="Logo"
              className={cn(
                "flex-shrink-0 object-contain transition-[width,height] duration-300",
                collapsed ? "h-9 w-9" : "h-12 w-12",
              )}
            />
            {/* Logo du service : il occupe toute la place restante de l'en-tete
                (flex-1 + object-contain, cale a gauche contre le logo GESPOF).
                Portail sans logo (Admin) : nom du service en texte. */}
            {labelsVisibles ? (
              menu.logo ? (
                <img
                  src={menu.logo}
                  alt={`${menu.title} — ${menu.subtitle}`}
                  className="h-12 min-w-0 flex-1 object-contain object-left"
                />
              ) : (
                <div className="min-w-0 leading-tight">
                  <p
                    className="truncate font-heading text-base font-bold uppercase tracking-wide"
                    style={{ color: theme.topColor }}
                  >
                    {menu.title}
                  </p>
                  <p className="truncate text-xs font-medium text-foreground/60">
                    {menu.subtitle}
                  </p>
                </div>
              )
            ) : null}
          </Link>
        </div>

        {/* Menu : seule zone defilante (barre de defilement masquee, voiles degrades
            en haut / bas pour signaler le contenu hors champ). */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <nav
            ref={navRef}
            className={cn(
              "scrollbar-none scroll-fluide min-h-0 flex-1 overflow-y-auto overflow-x-hidden transition-[padding] duration-300",
              collapsed ? "px-1.5 py-2" : "p-3",
            )}
          >
            <div
              ref={contenuNavRef}
              style={collapsed ? { width: LARGEUR_REPLIEE - 12 } : undefined}
            >
              {sections.map((section, index) => (
                <div
                  key={section.id}
                  className={cn(
                    index === 0 ? "mt-0" : collapsed ? "mt-2" : "mt-5",
                  )}
                >
                  {section.label && labelsVisibles && (
                    <p className="px-2 pb-1.5 pt-2 text-xs font-semibold text-foreground/70">
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
              background: `linear-gradient(to bottom, ${theme.bgColor}, ${theme.bgColor}00)`,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 transition-opacity duration-300 ease-out"
            style={{
              opacity: voiles.bas ? 1 : 0,
              background: `linear-gradient(to top, ${theme.bgColor}, ${theme.bgColor}00)`,
            }}
          />
        </div>

        <div
          className={cn(
            "flex-shrink-0 transition-[padding] duration-300",
            collapsed ? "px-1.5 py-2" : "p-3",
          )}
          style={{ borderTop: `1px solid ${theme.topColor}1a` }}
        >
          <div
            className="flex items-center gap-2.5 px-1 py-1.5"
            style={{
              justifyContent: collapsed ? "center" : "flex-start",
              width: collapsed ? LARGEUR_REPLIEE - 12 : undefined,
            }}
          >
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ background: theme.topColor }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: theme.topColor }}
              />
            </span>
            {labelsVisibles && (
              <span className="truncate text-sm font-medium text-foreground/80">
                Système opérationnel
              </span>
            )}
          </div>

          {FOOTER_MENU.map((item) => {
            const Icon = item.icon;
            const valeur =
              item.id === "last-connexion" ? user?.derniereConnexion : null;
            return (
              <div
                key={item.id}
                title={valeur ? `${item.label} : ${valeur}` : item.label}
                className="mt-1 flex w-full items-center gap-2.5 px-1 py-1 text-xs text-foreground/70"
                style={{
                  justifyContent: collapsed ? "center" : "flex-start",
                  width: collapsed ? LARGEUR_REPLIEE - 12 : undefined,
                }}
              >
                <Icon size={collapsed ? 18 : 15} className="flex-shrink-0" />
                {labelsVisibles && (
                  <span className="truncate">
                    {valeur ? libelleConnexion(valeur) : item.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
