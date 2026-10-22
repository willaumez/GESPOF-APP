import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getPortalMenu, findPageInfo } from "@/shared/config/menu";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { AppShell } from "@/shared/components/layout/AppShell";

const PORTAL = "admin" as const;

export default function AdminPage() {
  const isMobile = useIsMobile();
  const [collapsedManuel, setCollapsedManuel] = useState(false);
  const collapsed = isMobile || collapsedManuel;
  const location = useLocation();
  const menu = getPortalMenu(PORTAL);
  const theme = menu.theme;
  const { label: pageTitle } = findPageInfo(PORTAL, location.pathname);

  return (
    <AppShell
      portal={PORTAL}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsedManuel((c) => !c)}
      hideToggle={isMobile}
    >
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
