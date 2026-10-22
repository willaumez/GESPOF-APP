import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getPortalMenu, findPageInfo } from "@/shared/config/menu";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { AppShell } from "@/shared/components/layout/AppShell";
import { TopBarPageActions } from "@/shared/components/layout/TopBarPageActions";
import { PeriodDatePicker } from "@/shared/components/date/PeriodDatePicker";
import { PeriodeProvider, usePeriode } from "@/portails/Sof/hooks/PeriodeContext";

const PORTAL = "sof" as const;

function SofShell() {
  const isMobile = useIsMobile();
  const [collapsedManuel, setCollapsedManuel] = useState(false);
  const collapsed = isMobile || collapsedManuel;
  const location = useLocation();
  const menu = getPortalMenu(PORTAL);
  const theme = menu.theme;
  const { label: pageTitle } = findPageInfo(PORTAL, location.pathname);
  const { periode, setPeriode } = usePeriode();

  return (
    <AppShell
      portal={PORTAL}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsedManuel((c) => !c)}
      hideToggle={isMobile}
    >
      <TopBarPageActions>
        <PeriodDatePicker
          portail={PORTAL}
          variant="topbar"
          libelle="Exercice"
          value={periode}
          onChange={setPeriode}
        />
      </TopBarPageActions>
      <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="w-full">
          <div className="mb-4 flex justify-end">
            <div
              className="flex w-fit items-center pr-2"
              style={{ borderRight: `3px solid ${theme.topColor}` }}
            >
              <h1 className="text-[17px] font-bold leading-tight text-[#0f172a] sm:text-[21px]">
                {pageTitle}
              </h1>
            </div>
          </div>
          <Outlet />
        </div>
      </main>
    </AppShell>
  );
}

export default function SofPage() {
  return (
    <PeriodeProvider>
      <SofShell />
    </PeriodeProvider>
  );
}
