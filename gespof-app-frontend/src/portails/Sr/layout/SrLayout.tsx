import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { AppShell } from "@/shared/components/layout/AppShell";
import { ClocheNotificationsSr } from "@/portails/Sr/components/layout/ClocheNotificationsSr";

const PORTAL = "sr" as const;

export default function SrPage() {
  const isMobile = useIsMobile();
  const [collapsedManuel, setCollapsedManuel] = useState(false);
  const collapsed = isMobile || collapsedManuel;

  return (
    <AppShell
      portal={PORTAL}
      collapsed={collapsed}
      onCollapsedChange={setCollapsedManuel}
      hideToggle={isMobile}
      actions={<ClocheNotificationsSr />}
    >
      {/* Scroll sur tout le main — pas de zone interne contrainte (maquette). */}
      <main
        className="min-h-0 min-w-0 flex-1 overflow-y-auto"
        style={{
          padding: isMobile ? "20px 16px 32px" : "28px 32px 40px",
          background: "#f8fafc",
        }}
      >
        <div className="flex w-full flex-col gap-6">
          <Outlet />
        </div>
      </main>
    </AppShell>
  );
}
