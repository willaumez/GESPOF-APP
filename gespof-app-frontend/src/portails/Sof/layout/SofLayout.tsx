import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { AppShell } from "@/shared/components/layout/AppShell";
import { TopBarPageActions } from "@/shared/components/layout/TopBarPageActions";
import { PeriodeProvider } from "@/portails/Sof/hooks/PeriodeContext";
import { SofPeriodeMoisPicker } from "@/portails/Sof/components/layout/SofPeriodeMoisPicker";

const PORTAL = "sof" as const;

function SofShell() {
  const isMobile = useIsMobile();
  const [collapsedManuel, setCollapsedManuel] = useState(false);
  const collapsed = isMobile || collapsedManuel;

  return (
    <AppShell
      portal={PORTAL}
      collapsed={collapsed}
      onCollapsedChange={setCollapsedManuel}
      hideToggle={isMobile}
    >
      <TopBarPageActions>
        <SofPeriodeMoisPicker />
      </TopBarPageActions>
      <main
        className="min-h-0 min-w-0 flex-1 overflow-y-auto"
        style={{
          padding: isMobile ? "20px 16px 40px" : "22px 32px 56px",
          background: "#f8fafc",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-[18px]">
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
