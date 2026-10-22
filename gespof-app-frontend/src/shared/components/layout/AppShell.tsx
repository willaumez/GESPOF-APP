import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { AppSidebar, LARGEUR_DEPLIEE_DEFAUT, LARGEUR_REPLIEE } from "@/shared/components/layout/AppSidebar";
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

const LARGEUR_MIN = 220;
const LARGEUR_MAX = 520;

function cleStockage(portal: Portail) {
  return `gespof.sidebar.${portal}`;
}

function lireLargeurEnregistree(portal: Portail, fallback: number): number {
  try {
    const brute = window.localStorage.getItem(cleStockage(portal));
    const n = brute ? Number(brute) : NaN;
    if (!Number.isFinite(n)) return fallback;
    return Math.min(LARGEUR_MAX, Math.max(LARGEUR_MIN, Math.round(n)));
  } catch {
    return fallback;
  }
}

function enregistrerLargeur(portal: Portail, pixels: number) {
  if (pixels < LARGEUR_MIN) return;
  try {
    window.localStorage.setItem(cleStockage(portal), String(Math.round(pixels)));
  } catch {
    /* stockage optionnel */
  }
}

interface AppShellProps {
  portal: Portail;
  collapsed: boolean;
  onToggleCollapse: () => void;
  hideToggle?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Cadre commun des portails : barre laterale redimensionnable
 * (poignee verticale) + barre superieure + contenu.
 */
export function AppShell({
  portal,
  collapsed,
  onToggleCollapse,
  hideToggle = false,
  actions,
  children,
}: AppShellProps) {
  const menu = getPortalMenu(portal);
  const theme = menu.theme;
  const largeurMenu = menu.largeurMenu ?? LARGEUR_DEPLIEE_DEFAUT;
  const [largeurInitiale] = useState(() =>
    lireLargeurEnregistree(portal, largeurMenu),
  );
  const [pageActionsSlot, setPageActionsSlot] = useState<HTMLElement | null>(null);
  const sidebarPanelRef = useRef<PanelImperativeHandle | null>(null);

  useEffect(() => {
    const panel = sidebarPanelRef.current;
    if (!panel) return;
    if (collapsed) {
      if (!panel.isCollapsed()) panel.collapse();
    } else if (panel.isCollapsed()) {
      panel.expand();
    }
  }, [collapsed]);

  return (
    <TopBarPageSlotProvider slot={pageActionsSlot}>
      <div
        className="flex h-screen bg-background"
        style={portalThemeVars(theme.topColor)}
      >
      <ResizablePanelGroup
        orientation="horizontal"
        id={`shell-${portal}`}
        className="h-full w-full"
        disabled={collapsed}
      >
        <ResizablePanel
          id={`sidebar-${portal}`}
          panelRef={sidebarPanelRef}
          collapsible
          collapsedSize={`${LARGEUR_REPLIEE}px`}
          defaultSize={`${largeurInitiale}px`}
          minSize={`${LARGEUR_MIN}px`}
          maxSize={`${LARGEUR_MAX}px`}
          groupResizeBehavior="preserve-pixel-size"
          className="min-h-0"
          onResize={(taille) => {
            if (collapsed || taille.inPixels < LARGEUR_MIN) return;
            enregistrerLargeur(portal, taille.inPixels);
          }}
        >
          <AppSidebar portal={portal} collapsed={collapsed} remplirLargeur />
        </ResizablePanel>

        <ResizableHandle
          withHandle={!collapsed}
          disabled={collapsed}
          className={
            collapsed
              ? "pointer-events-none w-0 border-0 bg-transparent opacity-0"
              : "w-px bg-transparent after:w-2 hover:bg-foreground/15"
          }
          style={
            collapsed
              ? undefined
              : { background: `${theme.topColor}26` }
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
              onToggleCollapse={onToggleCollapse}
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
