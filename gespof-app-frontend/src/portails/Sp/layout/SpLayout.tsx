import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const [collapsedManuel, setCollapsedManuel] = useState(false);
  const collapsed = isMobile || collapsedManuel;

  const estPageJournee = location.pathname.startsWith(
    "/sp/fiche-matinale/journee/",
  );
  const estFicheDepots = location.pathname.startsWith("/sp/fiche-depots");
  const estDashboard =
    location.pathname === "/sp" || location.pathname === "/sp/";

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
      onCollapsedChange={setCollapsedManuel}
      hideToggle={isMobile}
      actions={<ClocheNotificationsSp />}
    >
      <TopBarPageActions>
        <SelecteurJourneeSp onSelection={afficherJourneeChoisie} />
      </TopBarPageActions>
      {/* Dashboard : hauteur fixe (résumé collé en bas). Autres pages : scroll main. */}
      <main
        className={
          estDashboard
            ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            : "min-h-0 min-w-0 flex-1 overflow-y-auto"
        }
        style={{
          padding: estDashboard
            ? isMobile
              ? "20px 16px 12px"
              : "28px 32px 16px"
            : isMobile
              ? "20px 16px 32px"
              : "28px 32px 40px",
          background: "#f8fafc",
        }}
      >
        <div
          className={
            estDashboard
              ? "flex min-h-0 w-full flex-1 flex-col"
              : "flex w-full flex-col gap-6"
          }
        >
          <Outlet />
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
