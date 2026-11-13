import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, PanelLeftClose } from "lucide-react";
import { AccountMenu } from "@/shared/components/layout/AccountMenu";
import { HorlogeTopBar } from "@/shared/components/layout/HorlogeTopBar";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import {
  getAccessiblePortails,
  getBreadcrumbItems,
  getPortalMenu,
  type BreadcrumbItem as Crumb,
} from "@/shared/config/menu";
import { useAuth } from "@/shared/hooks/use-auth";
import type { Portail } from "@/shared/hooks/auth-context";
import {
  Fragment,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";

interface AppTopBarProps {
  portal: Portail;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Masque le bouton de repli (mobile : la barre laterale y est toujours repliee). */
  hideToggle?: boolean;
  /** Actions a droite, avant le menu compte (ex. cloche SR). */
  actions?: ReactNode;
  /** Emplacement pour les filtres / actions de la page courante. */
  pageActionsSlotRef?: Ref<HTMLDivElement>;
}

/**
 * Barre supérieure — hauteur fixe h-16 (maquette Prototype v2 / SOF).
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
  /** Au-delà de 2 segments : … (menu clic) + les 2 derniers. */
  const condensed = crumbs.length > 2;
  const crumbsMasques: Crumb[] = condensed ? crumbs.slice(0, -2) : [];
  const crumbsVisibles: Crumb[] = condensed ? crumbs.slice(-2) : crumbs;

  return (
    <div className="@container/topbar flex-shrink-0">
      <header
        className={cn(
          "sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-[#e2e8f0] bg-white",
          hideToggle ? "pl-5" : "pl-0",
          "pr-5",
        )}
      >
        {!hideToggle ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? "Déplier le menu" : "Replier le menu"}
            aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
            className="flex h-16 w-11 flex-shrink-0 items-center justify-center rounded-r-xl transition-[background-color,color,transform] duration-[180ms] ease-[cubic-bezier(0,0,0.2,1)] active:scale-95"
            style={{
              color: theme.topColor,
              backgroundColor: `${theme.topColor}0f`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${theme.topColor}1a`;
              e.currentTarget.style.color = theme.hoverColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `${theme.topColor}0f`;
              e.currentTarget.style.color = theme.topColor;
            }}
          >
            <span
              className="inline-flex transition-transform duration-[180ms] ease-[cubic-bezier(0,0,0.2,1)]"
              style={{
                transform: collapsed ? "scaleX(-1)" : "scaleX(1)",
              }}
            >
              <PanelLeftClose size={22} strokeWidth={2} />
            </span>
          </button>
        ) : null}

        <div className="mr-2 flex min-w-0 max-w-[min(100%,320px)] flex-1 items-center gap-2 overflow-hidden text-sm @md/topbar:max-w-[420px] @2xl/topbar:max-w-[520px]">
          <Breadcrumb className="min-w-0 max-w-full">
            <BreadcrumbList className="flex-nowrap gap-1.5 text-sm sm:gap-2">
              {condensed ? (
                <>
                  <BreadcrumbItem className="shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center rounded px-0.5 text-[#64748b] outline-none transition-colors hover:bg-[var(--crumb-bg)] hover:text-[var(--crumb-fg)] focus-visible:ring-2 focus-visible:ring-[color:var(--crumb-ring)] data-[state=open]:bg-[var(--crumb-bg)] data-[state=open]:text-[var(--crumb-fg)]"
                          style={
                            {
                              ["--crumb-bg" as string]: theme.topColor,
                              ["--crumb-fg" as string]: "#ffffff",
                              ["--crumb-ring" as string]: `${theme.topColor}55`,
                            } as CSSProperties
                          }
                          aria-label="Afficher les segments masqués du fil d'Ariane"
                        >
                          <BreadcrumbEllipsis className="size-5 text-current" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        sideOffset={8}
                        className="min-w-[200px] max-w-[min(90vw,360px)] rounded-lg border border-[#e2e8f0] p-1.5 shadow-[0_12px_32px_-8px_rgba(15,23,42,.18)]"
                        style={
                          {
                            ["--crumb-focus-bg" as string]: theme.topColor,
                            ["--crumb-focus-fg" as string]: "#ffffff",
                          } as CSSProperties
                        }
                      >
                        {crumbsMasques.map((crumb, index) => (
                          <DropdownMenuItem
                            key={`${crumb.label}-masque-${index}`}
                            disabled={!crumb.href}
                            onSelect={() => {
                              if (crumb.href) navigate(crumb.href);
                            }}
                            className={cn(
                              "cursor-pointer rounded-[5px] px-2.5 py-2 text-[13.5px] text-[#334155] focus:!bg-[var(--crumb-focus-bg)] focus:!text-[var(--crumb-focus-fg)] data-[highlighted]:!bg-[var(--crumb-focus-bg)] data-[highlighted]:!text-[var(--crumb-focus-fg)]",
                              index === 0 && "font-semibold",
                              !crumb.href && "cursor-default opacity-70",
                            )}
                            style={
                              index === 0
                                ? { color: theme.textColor }
                                : undefined
                            }
                            title={crumb.label}
                          >
                            <span className="truncate">{crumb.label}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="shrink-0 text-[#cbd5e1]" />
                </>
              ) : null}

              {crumbsVisibles.map((crumb, index) => {
                const estDernier = index === crumbsVisibles.length - 1;
                const estPremierVisible = !condensed && index === 0;
                return (
                  <Fragment key={`${crumb.label}-${index}`}>
                    {index > 0 ? (
                      <BreadcrumbSeparator className="shrink-0 text-[#cbd5e1]" />
                    ) : null}
                    <BreadcrumbItem className="min-w-0 max-w-[min(100%,220px)]">
                      {estDernier || !crumb.href ? (
                        <BreadcrumbPage
                          className={cn(
                            "block truncate whitespace-nowrap",
                            estDernier || estPremierVisible
                              ? "font-semibold"
                              : "font-normal text-[#64748b]",
                            estDernier && "text-[#0f172a]",
                          )}
                          style={
                            estPremierVisible
                              ? { color: theme.textColor }
                              : undefined
                          }
                          title={crumb.label}
                        >
                          {crumb.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link
                            to={crumb.href}
                            title={crumb.label}
                            className={cn(
                              "block truncate whitespace-nowrap transition-colors hover:underline",
                              estPremierVisible
                                ? "font-semibold"
                                : "font-normal text-[#64748b]",
                            )}
                            style={
                              estPremierVisible
                                ? { color: theme.textColor }
                                : undefined
                            }
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
          className="flex min-w-0 flex-1 items-center justify-end *:max-w-full @4xl/topbar:justify-center"
        />

        <div className="flex shrink-0 items-center gap-2">
          {actions}

          {plusieursPortails ? (
            <button
              type="button"
              onClick={() => navigate("/portail")}
              title="Changer de portail"
              aria-label="Changer de portail"
              className="grid size-9 shrink-0 place-items-center rounded-md text-[#475569] transition-colors hover:bg-[#f1f5f9]"
            >
              <LayoutGrid size={18} strokeWidth={1.7} />
            </button>
          ) : null}

          <HorlogeTopBar portal={portal} />

          <AccountMenu portal={portal} dansTopBar />
        </div>
      </header>
    </div>
  );
}
