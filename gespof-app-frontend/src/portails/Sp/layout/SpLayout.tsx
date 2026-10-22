import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { getPortalMenu, findPageInfo } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { AppShell } from "@/shared/components/layout/AppShell";
import { TopBarPageActions } from "@/shared/components/layout/TopBarPageActions";
import { ClocheNotificationsSp } from "@/portails/Sp/components/layout/ClocheNotificationsSp";
import { SelecteurJourneeSp } from "@/portails/Sp/components/layout/SelecteurJourneeSp";
import { JourneeSelectionneeProvider } from "@/portails/Sp/hooks/JourneeSelectionneeContext";

const PORTAL = "sp" as const;

function SpShell() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [collapsedManuel, setCollapsedManuel] = useState(false);
  const collapsed = isMobile || collapsedManuel;
  const location = useLocation();
  const menu = getPortalMenu(PORTAL);
  const theme = menu.theme;
  const { label: pageMenuLabel } = findPageInfo(PORTAL, location.pathname);
  const sousPage = menu.sousPages?.find((s) =>
    location.pathname.startsWith(s.prefix),
  );
  const pageTitle = sousPage?.breadcrumb ?? pageMenuLabel;
  const estFicheDepots = location.pathname.startsWith("/sp/fiche-depots");
  const estTableauDeBord =
    location.pathname === "/sp" || location.pathname === "/sp/";
  const estPageJournee = location.pathname.startsWith("/sp/fiche-matinale/journee/");
  const estRapprochement = location.pathname.startsWith("/sp/fiche-matinale/rapprochement-");
  /** Page à hauteur d'écran : pas de scroll global, chaque bloc défile en interne. */
  const estPleineHauteur = estTableauDeBord || ((estRapprochement || estFicheDepots) && !isMobile);

  /**
   * Après un choix dans la TopBar : la page d'une journée suit la sélection ;
   * ailleurs, on quitte l'onglet « liste » global / les paramètres de lien pour voir
   * la journée (les deux onglets de la Fiche des dépôts sont déjà propres à la journée).
   */
  function afficherJourneeChoisie(reference: string | null) {
    if (estPageJournee) {
      void navigate(
        reference
          ? `/sp/fiche-matinale/journee/${encodeURIComponent(reference)}`
          : "/sp/fiche-matinale",
      );
      return;
    }
    if (location.search !== "" && !estFicheDepots) {
      void navigate(location.pathname, { replace: true });
    }
  }

  return (
    <AppShell
      portal={PORTAL}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsedManuel((c) => !c)}
      hideToggle={isMobile}
      actions={<ClocheNotificationsSp />}
    >
      <TopBarPageActions>
        <SelecteurJourneeSp onSelection={afficherJourneeChoisie} />
      </TopBarPageActions>
      <main
        className={cn(
          "flex-1 px-4 py-4 sm:px-6",
          estPleineHauteur
            ? "flex min-h-0 flex-col overflow-hidden"
            : "overflow-y-auto",
        )}
      >
        <div
          className={cn(
            "w-full",
            estPleineHauteur && "flex min-h-0 flex-1 flex-col",
          )}
        >
          <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div
              className="ml-auto flex w-fit max-w-full shrink-0 items-center pr-2"
              style={{ borderRight: `3px solid ${theme.topColor}` }}
            >
              <h1 className="truncate text-[17px] font-bold leading-tight text-[#0f172a] sm:text-[21px]">
                {pageTitle}
              </h1>
            </div>
          </div>
          <div className={cn(estPleineHauteur && "flex min-h-0 flex-1 flex-col")}>
            <Outlet />
          </div>
        </div>
      </main>
    </AppShell>
  );
}

export default function SpPage() {
  return (
    <JourneeSelectionneeProvider>
      <SpShell />
    </JourneeSelectionneeProvider>
  );
}
