import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import {
  AppSidebar,
  LARGEUR_DEPLIEE_DEFAUT,
  LARGEUR_REPLIEE,
} from "@/shared/components/layout/AppSidebar";
import { AppTopBar } from "@/shared/components/layout/AppTopBar";
import { TopBarPageSlotProvider } from "@/shared/components/layout/TopBarPageActions";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";
import { getPortalMenu } from "@/shared/config/menu";
import { portalThemeVars } from "@/shared/lib/color";
import type { Portail } from "@/shared/hooks/auth-context";

const LARGEUR_MAX = 520;
/** Sous ce seuil au glisser → mode rail icônes (comme Coque 00001-dev). */
const SEUIL_REPLI_PX = 90;

function cleStockage(portal: Portail) {
  return `gespof.sidebar.${portal}`;
}

/** minSize = largeurMenu du portail (contenu), comme minSize:268 dans Coque. */
function lireLargeurEnregistree(
  portal: Portail,
  largeurMin: number,
): number {
  try {
    const brute = window.localStorage.getItem(cleStockage(portal));
    const n = brute ? Number(brute) : NaN;
    if (!Number.isFinite(n)) return largeurMin;
    return Math.min(LARGEUR_MAX, Math.max(largeurMin, Math.round(n)));
  } catch {
    return largeurMin;
  }
}

function enregistrerLargeur(
  portal: Portail,
  pixels: number,
  largeurMin: number,
) {
  if (pixels < largeurMin) return;
  try {
    window.localStorage.setItem(cleStockage(portal), String(Math.round(pixels)));
  } catch {
    /* stockage optionnel */
  }
}

interface AppShellProps {
  portal: Portail;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  hideToggle?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Cadre commun des portails : barre laterale (largeur reglable au glisser,
 * sans pastille centrale — comme Coque 00001-dev) + barre superieure + contenu.
 * Sous SEUIL_REPLI_PX, bascule en rail icônes pour eviter les libelles ecrases.
 */
export function AppShell({
  portal,
  collapsed,
  onCollapsedChange,
  hideToggle = false,
  actions,
  children,
}: AppShellProps) {
  const menu = getPortalMenu(portal);
  const theme = menu.theme;
  // Largeur mini = largeur du contenu du menu (portails/*/menu.ts), pas une
  // constante globale trop basse qui ecraserait les libelles.
  const largeurMenu = menu.largeurMenu ?? LARGEUR_DEPLIEE_DEFAUT;
  const [largeurInitiale] = useState(() =>
    lireLargeurEnregistree(portal, largeurMenu),
  );
  const [pageActionsSlot, setPageActionsSlot] = useState<HTMLElement | null>(
    null,
  );
  const sidebarPanelRef = useRef<PanelImperativeHandle | null>(null);

  useEffect(() => {
    if (hideToggle) return;
    const panel = sidebarPanelRef.current;
    if (!panel) return;
    if (collapsed) {
      if (!panel.isCollapsed()) panel.collapse();
    } else if (panel.isCollapsed()) {
      panel.expand();
    }
  }, [collapsed, hideToggle]);

  const policeSr: CSSProperties | undefined =
    portal === "sr"
      ? ({
          fontFamily: "'Inter', Arial, sans-serif",
          "--font-sans": "'Inter', Arial, sans-serif",
          "--font-heading": "'Montserrat', Arial, sans-serif",
        } as CSSProperties)
      : undefined;

  return (
    <TopBarPageSlotProvider slot={pageActionsSlot}>
      <div
        className="flex h-screen bg-background"
        style={{ ...portalThemeVars(theme.topColor), ...policeSr }}
      >
        <ResizablePanelGroup
          orientation="horizontal"
          id={`shell-${portal}`}
          className="h-full w-full"
          disabled={hideToggle}
        >
          <ResizablePanel
            id={`sidebar-${portal}`}
            panelRef={sidebarPanelRef}
            collapsible
            collapsedSize={`${LARGEUR_REPLIEE}px`}
            defaultSize={`${largeurInitiale}px`}
            minSize={`${largeurMenu}px`}
            maxSize={`${LARGEUR_MAX}px`}
            groupResizeBehavior="preserve-pixel-size"
            className="min-h-0 overflow-hidden"
            onResize={(taille) => {
              if (hideToggle) return;
              const replie = taille.inPixels <= SEUIL_REPLI_PX;
              if (replie !== collapsed) {
                onCollapsedChange(replie);
              }
              if (!replie && taille.inPixels >= largeurMenu) {
                enregistrerLargeur(portal, taille.inPixels, largeurMenu);
              }
            }}
          >
            <AppSidebar portal={portal} collapsed={collapsed} remplirLargeur />
          </ResizablePanel>

          <ResizableHandle
            disabled={hideToggle}
            className={
              hideToggle
                ? "pointer-events-none w-0 border-0 bg-transparent opacity-0"
                : "w-px transition-colors duration-[120ms] ease-[cubic-bezier(0,0,0.2,1)]"
            }
            style={
              hideToggle ? undefined : { background: `${theme.topColor}38` }
            }
          />

          <ResizablePanel
            id={`contenu-${portal}`}
            minSize="40%"
            className="min-h-0 min-w-0"
          >
            <div className="flex h-full min-w-0 flex-col overflow-hidden">
              <AppTopBar
                portal={portal}
                collapsed={collapsed}
                onToggleCollapse={() => onCollapsedChange(!collapsed)}
                hideToggle={hideToggle}
                actions={actions}
                pageActionsSlotRef={setPageActionsSlot}
              />
              {children}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TopBarPageSlotProvider>
  );
}
