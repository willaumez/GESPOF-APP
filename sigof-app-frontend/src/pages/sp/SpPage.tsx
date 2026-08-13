import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { getPortalMenu, findPageInfo } from "@/shared/config/menu";
import { portalThemeVars } from "@/shared/lib/color";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { AppTopBar } from "@/shared/components/layout/AppTopBar";
import { AppSidebar } from "@/shared/components/layout/AppSidebar";

const PORTAL = "sp" as const;

export default function SpPage() {
  const isMobile = useIsMobile();
  const [collapsedManuel, setCollapsedManuel] = useState(false);
  const collapsed = isMobile || collapsedManuel;
  const location = useLocation();
  const menu = getPortalMenu(PORTAL);
  const theme = menu.theme;
  const { label: pageTitle, path: pagePath } = findPageInfo(
    PORTAL,
    location.pathname,
  );

  return (
    <div
      className="flex h-screen bg-background"
      style={portalThemeVars(theme.topColor)}
    >
      <AppSidebar
        portal={PORTAL}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsedManuel((c) => !c)}
        hideToggle={isMobile}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppTopBar portal={PORTAL} />
        <main className="flex-1 overflow-y-auto py-4 px-1 sm:py-4 sm:px-1">
          <div className="w-full px-2 sm:px-8 xl:px-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
              <div className="hidden items-center gap-1.5 text-[11.5px] font-medium text-[#64748b] sm:mb-1.5 sm:flex">
                <span
                  className="font-semibold"
                  style={{ color: theme.topColor }}
                >
                  {menu.title}
                </span>
                <span className="text-[#cbd5e1]">/</span>
                {pagePath ? (
                  <Link
                    to={pagePath}
                    className="text-[#334155] transition-colors hover:text-[#0f172a] hover:underline"
                  >
                    {pageTitle}
                  </Link>
                ) : (
                  <span className="text-[#334155]">{pageTitle}</span>
                )}
              </div>
              <div
                className="flex w-fit items-center pr-2"
                style={{ borderRight: `3px solid ${theme.topColor}` }}
              >
                <h1
                  className="text-[17px] font-bold leading-tight text-[#0f172a] sm:text-[21px]"
                  style={{ fontFamily: "'Geist Variable', sans-serif" }}
                >
                  {pageTitle}
                </h1>
              </div>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
