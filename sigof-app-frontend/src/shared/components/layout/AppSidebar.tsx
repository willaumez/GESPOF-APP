import { createElement, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { MENU, getPortalMenu, resolveNavPath } from "@/shared/config/menu";
import { resolveIcon } from "@/shared/lib/icons";
import { useAuth } from "@/shared/hooks/use-auth";
import type { Portail } from "@/shared/hooks/auth-context";
import type { MenuNavItem } from "@/shared/types/menu.interface";
import logo from "@/shared/assets/SIGOF-logo-tr.png";

interface AppSidebarProps {
  portal: Portail;
  collapsed: boolean;
  onToggleCollapse: () => void;
  hideToggle?: boolean;
}

export function AppSidebar({
  portal,
  collapsed,
  onToggleCollapse,
  hideToggle = false,
}: AppSidebarProps) {
  const { hasAnyRole, user } = useAuth();
  const location = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const menu = getPortalMenu(portal);
  const theme = menu.theme;

  const contentRef = useRef<HTMLDivElement>(null);
  const [expandedWidth, setExpandedWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (collapsed || !contentRef.current) return;
    const el = contentRef.current;
    const mesurer = () => setExpandedWidth(Math.ceil(el.offsetWidth));
    mesurer();
    const observer = new ResizeObserver(mesurer);
    observer.observe(el);
    return () => observer.disconnect();
  }, [collapsed]);

  const largeurDepliee =
    expandedWidth !== null ? Math.min(320, Math.max(220, expandedWidth)) : null;

  const visible = (item: MenuNavItem) => !item.roles || hasAnyRole(item.roles);
  const isActivePath = (path: string) =>
    resolveNavPath(location.pathname) === path;
  const hasActiveChild = (item: MenuNavItem) =>
    item.children.some((c) => isActivePath(c.path));
  const isExpanded = (item: MenuNavItem) =>
    expanded[item.id] ?? hasActiveChild(item);

  const buildNavItem = (item: MenuNavItem): MenuNavItem => ({
    ...item,
    children: item.children.filter(visible),
  });

  const navById = new Map(
    menu.nav.filter(visible).map((n) => [n.id, buildNavItem(n)]),
  );
  const groupedIds = new Set(menu.sections.flatMap((s) => s.items));
  const ungrouped = [...navById.values()].filter((n) => !groupedIds.has(n.id));

  const orderedIds = [
    ...ungrouped.map((n) => n.id),
    ...menu.sections.flatMap((s) => s.items.filter((id) => navById.has(id))),
  ];
  const entranceDelay = (id: string) => {
    const i = orderedIds.indexOf(id);
    return `${Math.min(i, 10) * 35}ms`;
  };

  const toggleExpand = (id: string) => {
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
  };

  const renderNavItem = (
    item: MenuNavItem,
    level: "parent" | "child" = "parent",
  ) => {
    const Icon = resolveIcon(item.icon);
    const active = isActivePath(item.path);
    const expandable = item.children.length > 0 && !collapsed;
    const opened = isExpanded(item);
    const activeColor = theme.topColor;

    return (
      <div
        key={item.id}
        className="mb-0.5 [animation:fadeUp_.4s_ease_both] object-contain"
        style={{ animationDelay: entranceDelay(item.id) }}
      >
        <div className="group/row flex items-center gap-0.5">
          <Link
            to={item.path}
            title={item.label}
            className={cn(
              "group relative flex flex-1 items-center gap-2 overflow-hidden rounded-md border-l-[3px] border-b-[2px] border-transparent p-2 text-sm font-medium transition-all duration-200 active:scale-[0.98]",
              collapsed ? "justify-center" : "justify-start",
              active
                ? "font-semibold shadow-sm"
                : "text-foreground/80 hover:bg-white/70 hover:text-foreground hover:shadow-sm",
            )}
            style={
              active
                ? {
                    color: activeColor,
                    background: "var(--color-card)",
                    borderLeftColor: activeColor,
                    borderBottomColor: activeColor,
                  }
                : undefined
            }
          >
            <Icon
              size={level === "parent" ? 16 : 14}
              className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
              style={active ? { color: activeColor } : undefined}
            />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>

          {expandable && (
            <button
              onClick={() => toggleExpand(item.id)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-foreground/60 transition-all duration-150 hover:bg-white/70 active:scale-90"
              aria-label={opened ? "Réduire" : "Développer"}
            >
              <ChevronRight
                size={15}
                className={cn(
                  "transition-transform duration-200",
                  opened && "rotate-90",
                )}
              />
            </button>
          )}
        </div>

        {expandable && (
          <div
            className="ml-[19px] grid overflow-hidden pl-3 transition-[grid-template-rows] duration-200 ease-out"
            style={{
              gridTemplateRows: opened ? "1fr" : "0fr",
              borderLeft: opened
                ? `1.5px solid ${activeColor}30`
                : "1.5px solid transparent",
              borderBottom: opened
                ? `1.5px solid ${activeColor}30`
                : "1.5px solid transparent",
            }}
          >
            <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
              {item.children.map((child) => {
                const ChildIcon = resolveIcon(child.icon);
                const childActive = isActivePath(child.path);
                return (
                  <Link
                    key={child.id}
                    to={child.path}
                    title={child.label}
                    className={cn(
                      "group mt-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium transition-all duration-200 active:scale-[0.98]",
                      !childActive &&
                        "text-foreground/80 hover:bg-white/70 hover:text-foreground",
                      childActive && "font-semibold shadow-sm",
                    )}
                    style={
                      childActive
                        ? {
                            color: activeColor,
                            background: "var(--color-card)",
                          }
                        : undefined
                    }
                  >
                    <ChildIcon
                      size={15}
                      className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                    />
                    <span className="truncate">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderNavGroup = (items: MenuNavItem[]) =>
    items.map((item) => renderNavItem(item));

  return (
    <aside
      className="relative z-10 flex h-full flex-shrink-0 flex-col transition-[width] duration-300 ease-in-out"
      style={{
        width: collapsed
          ? "76px"
          : largeurDepliee !== null
            ? `${largeurDepliee}px`
            : "fit-content",
        background: theme.bgColor,
        borderRight: `2px solid ${theme.topColor}22`,
        boxShadow: "2px 0 12px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
        style={{ background: theme.topColor }}
      />

      {!hideToggle && (
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          className="absolute z-20 flex h-[55px] w-[40px] cursor-pointer items-center justify-center border-r border-b border-transparent transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            right: "-40px",
            color: theme.topColor,
            backgroundColor: theme.bgColor,
            borderBottomRightRadius: "16px",
            borderRightColor: `${theme.topColor}30`,
            borderBottomColor: `${theme.topColor}30`,
          }}
        >
          <div
            className="relative transition-transform duration-500"
            style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}
          >
            {collapsed ? (
              <PanelLeftOpen size={20} strokeWidth={2.5} />
            ) : (
              <PanelLeftClose size={20} strokeWidth={2.5} />
            )}
          </div>

          <span
            className="absolute bottom-0 left-1/2 h-1 -translate-x-1/2 rounded-t-none transition-all duration-300"
            style={{
              width: collapsed ? "12px" : "20px",
              background: theme.topColor,
              opacity: 0.3,
              borderBottomRightRadius: collapsed ? "0px" : "4px",
              borderBottomLeftRadius: collapsed ? "0px" : "4px",
            }}
          />
        </button>
      )}

      <div className="flex-shrink-0 px-4 py-3.5">
        <Link to="/portail" title="SIGOF" className="flex items-center gap-2.5">
          <img
            src={logo}
            alt="Logo"
            className="h-12 w-12 flex-shrink-0 object-contain"
          />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate font-heading text-base font-semibold text-foreground">
                SIGOF
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Plateforme de Trésorerie
              </p>
            </div>
          )}
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden">
        <div ref={contentRef} className="flex w-fit min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div
              className="px-4 py-3.5"
              style={{ borderBottom: `1px solid ${theme.topColor}1a` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-card transition-transform duration-300"
                  style={{ color: theme.iconColor }}
                >
                  {createElement(resolveIcon(menu.icon), { size: 18 })}
                </div>
                {!collapsed && (
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {menu.title}
                    </p>
                    <p className="truncate text-xs text-foreground/60">
                      {menu.subtitle}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <nav className="p-2.5">
              {ungrouped.length > 0 && (
                <div className="mt-1">{renderNavGroup(ungrouped)}</div>
              )}

              {menu.sections.map((section) => {
                const items = section.items
                  .map((id) => navById.get(id))
                  .filter((n): n is MenuNavItem => !!n);
                if (items.length === 0) return null;

                return (
                  <div key={section.id} className="mt-6">
                    {!collapsed && (
                      <p className="px-2.5 pb-2 pt-2 text-xs font-semibold text-foreground/70">
                        {section.label}
                      </p>
                    )}
                    {renderNavGroup(items)}
                  </div>
                );
              })}
            </nav>
          </div>

          <div
            className="flex-shrink-0 p-2.5"
            style={{ borderTop: `1px solid ${theme.topColor}1a` }}
          >
            <div
              className="flex items-center gap-2.5 px-2.5 py-2"
              style={{ justifyContent: collapsed ? "center" : "flex-start" }}
            >
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                  style={{ background: theme.topColor }}
                />
                <span
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ background: theme.topColor }}
                />
              </span>
              {!collapsed && (
                <span className="truncate text-sm font-medium text-foreground/80">
                  Système opérationnel
                </span>
              )}
            </div>

            {MENU.footerMenu.map((item) => {
              const Icon = resolveIcon(item.icon);
              const valeur =
                item.id === "last-connexion" ? user?.derniereConnexion : null;
              return (
                <div
                  key={item.id}
                  title={valeur ? `${item.label} : ${valeur}` : item.label}
                  className="mt-1.5 flex w-full items-center gap-2.5 px-2.5 py-1 text-xs text-foreground/70"
                  style={{
                    justifyContent: collapsed ? "center" : "flex-start",
                  }}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  {!collapsed && (
                    <span className="truncate">{valeur ?? item.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
