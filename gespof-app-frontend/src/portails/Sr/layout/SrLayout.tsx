import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getPortalMenu, findPageInfo } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { AppShell } from "@/shared/components/layout/AppShell";
import { Button } from "@/shared/components/ui/button";
import { ClocheNotificationsSr } from "@/portails/Sr/components/layout/ClocheNotificationsSr";

const PORTAL = "sr" as const;

function findHeading(pathname: string, fallback: string): string {
  const ficheMatch = pathname.match(/^\/sr\/fiche\/(.+)$/);
  if (ficheMatch) {
    return `Détail de la fiche ${decodeURIComponent(ficheMatch[1])}`;
  }
  return fallback;
}

export default function SrPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [collapsedManuel, setCollapsedManuel] = useState(false);
  const collapsed = isMobile || collapsedManuel;
  const location = useLocation();
  const menu = getPortalMenu(PORTAL);
  const theme = menu.theme;
  const { label: pageTitle } = findPageInfo(PORTAL, location.pathname);
  const heading = findHeading(location.pathname, pageTitle);
  const sousPage = menu.sousPages?.find((s) =>
    location.pathname.startsWith(s.prefix),
  );
  /** Page à hauteur d'écran : pas de scroll global, chaque bloc défile en interne. */
  const estTableauDeBord = location.pathname.startsWith("/sr/tableau-de-bord");
  const estPleineHauteur = estTableauDeBord && !isMobile;

  return (
    <AppShell
      portal={PORTAL}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsedManuel((c) => !c)}
      hideToggle={isMobile}
      actions={<ClocheNotificationsSr />}
    >
      <main
        className={cn(
          "flex-1 px-4 pt-4 sm:px-6",
          estPleineHauteur
            ? "flex min-h-0 flex-col overflow-y-auto pb-8 sm:pb-10"
            : "overflow-y-auto pb-4",
        )}
      >
        <div
          className={cn(
            "w-full",
            estPleineHauteur && "flex min-h-0 flex-1 flex-col",
          )}
        >
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 sm:mb-4 sm:gap-3">
            {sousPage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => void navigate(sousPage.path)}
              >
                <ArrowLeft className="size-3.5" />
                Retour
              </Button>
            ) : null}
            <div
              className="ml-auto flex w-fit max-w-full shrink-0 items-center pr-2"
              style={{ borderRight: `3px solid ${theme.topColor}` }}
            >
              <h1 className="text-right text-[17px] font-bold leading-tight break-words text-[#0f172a] sm:text-[21px]">
                {heading}
              </h1>
            </div>
          </div>
          <div
            className={cn(estPleineHauteur && "flex min-h-0 flex-1 flex-col")}
          >
            <Outlet />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
