import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AccountMenu } from "@/shared/components/layout/AccountMenu";
import { HorlogeTopBar } from "@/shared/components/layout/HorlogeTopBar";
import { Button } from "@/shared/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb";
import { cn } from "@/shared/lib/utils";
import {
  getAccessiblePortails,
  getBreadcrumbItems,
  getPortalMenu,
} from "@/shared/config/menu";
import { useAuth } from "@/shared/hooks/use-auth";
import type { Portail } from "@/shared/hooks/auth-context";
import { Fragment, type ReactNode, type Ref } from "react";

interface AppTopBarProps {
  portal: Portail;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Masque le bouton de repli (mobile : la barre laterale y est toujours repliee). */
  hideToggle?: boolean;
  /** Actions a droite, avant le menu compte (ex. cloche SP). */
  actions?: ReactNode;
  /** Emplacement pour les filtres / actions de la page courante. */
  pageActionsSlotRef?: Ref<HTMLDivElement>;
}

/**
 * Barre superieure : repli de la barre laterale, fil d'Ariane, acces aux autres
 * portails et menu du compte. Le fil d'Ariane est deduit de l'URL courante
 * (getBreadcrumbItems) — les layouts n'ont rien a lui transmettre.
 */
export function AppTopBar({
  portal,
  collapsed,
  onToggleCollapse,
  hideToggle = false,
  actions,
  pageActionsSlotRef,
}: AppTopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const menu = getPortalMenu(portal);
  const theme = menu.theme;
  const plusieursPortails = getAccessiblePortails(user?.roles ?? []).length > 1;
  const crumbs = getBreadcrumbItems(portal, location.pathname);

  // Conteneur « topbar » : la mise en page suit la largeur reelle de la zone de
  // contenu (barre laterale ouverte ou repliee), pas seulement celle de l'ecran.
  // Grille large : la colonne de droite (horloge, actions, compte) garde toujours
  // sa largeur de contenu ; c'est le fil d'Ariane puis le centre qui se tronquent,
  // au lieu que les boutons se chevauchent. Le centre reste centré s'il y a la place.
  return (
    <div className="@container/topbar flex-shrink-0">
    <header
      className={cn(
        "grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background pr-2 @2xl/topbar:gap-3 @2xl/topbar:pr-4 @4xl/topbar:grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(max-content,1fr)] @4xl/topbar:pr-6",
        // Sans bouton (mobile), l'entete retrouve sa marge interne a gauche.
        hideToggle ? "pl-2 @2xl/topbar:pl-4 @4xl/topbar:pl-6" : "pl-0",
      )}
    >
      <div className="flex min-w-0 items-center gap-2 @2xl/topbar:gap-3">
      {!hideToggle && (
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? "Déplier le menu" : "Replier le menu"}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          className="flex h-16 w-11 flex-shrink-0 items-center justify-center rounded-r-xl @2xl/topbar:w-12 transition-[background-color,transform] duration-200 active:scale-95"
          style={{ color: theme.topColor, backgroundColor: `${theme.topColor}0f` }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.topColor}1f`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.topColor}0f`;
          }}
        >
          {collapsed ? (
            <PanelLeftOpen size={22} strokeWidth={2} />
          ) : (
            <PanelLeftClose size={22} strokeWidth={2} />
          )}
        </button>
      )}

      <Breadcrumb className="hidden min-w-0 @4xl/topbar:block">
        <BreadcrumbList className="text-sm font-medium text-[#64748b]">
          {crumbs.map((crumb, index) => {
            const estDernier = index === crumbs.length - 1;
            return (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 ? <BreadcrumbSeparator className="text-[#cbd5e1]" /> : null}
                <BreadcrumbItem className="min-w-0">
                  {estDernier || !crumb.href ? (
                    <BreadcrumbPage
                      className={cn(
                        "truncate font-medium text-[#334155]",
                        index === 0 && "font-semibold",
                      )}
                      style={index === 0 ? { color: theme.topColor } : undefined}
                    >
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        to={crumb.href}
                        className={cn(
                          "truncate text-[#334155] transition-colors hover:text-[#0f172a] hover:underline",
                          index === 0 && "font-semibold",
                        )}
                        style={index === 0 ? { color: theme.topColor } : undefined}
                      >
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      </div>

      <div
        ref={pageActionsSlotRef}
        className="flex min-w-0 items-center justify-center *:max-w-full"
      />

      <div className="flex min-w-0 items-center justify-end gap-1 @2xl/topbar:gap-3">
      {plusieursPortails && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/portail")}
          className="hidden gap-1 @3xl/topbar:flex"
          style={{ color: theme.topColor }}
          title="Portails"
          aria-label="Portails"
        >
          <ChevronLeft className="size-3.5" />
          <span className="hidden @6xl/topbar:inline">Portails</span>
        </Button>
      )}

      <HorlogeTopBar portal={portal} />

      {actions}

      <AccountMenu portal={portal} dansTopBar />
      </div>
    </header>
    </div>
  );
}
