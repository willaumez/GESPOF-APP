import { createElement, type ReactNode } from "react";
import { LayoutGrid } from "lucide-react";
import { getPortalMenu, getNavItem } from "@/config/menu";
import { resolveIcon } from "@/lib/icons";
import type { Portail } from "@/contexts/auth-context";

interface ModulePagePlaceholderProps {
  portal: Portail;
  navId: string;
  description?: string;
  children?: ReactNode;
}

export function ModulePagePlaceholder({
  portal,
  navId,
  description,
  children,
}: ModulePagePlaceholderProps) {
  const menu = getPortalMenu(portal);
  const item = getNavItem(menu, navId);
  const theme = menu.theme;
  const label = item?.label ?? menu.title;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: theme.iconBg, color: theme.iconColor }}
        >
          {createElement(resolveIcon(item?.icon ?? menu.icon), { size: 20 })}
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-foreground">{label}</h2>
          <p className="mt-0.5 text-[12.5px] text-foreground/60">
            {description ?? `${menu.title} — ${menu.subtitle}`}
          </p>
        </div>
      </div>

      {children ?? (
        <div
          className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center"
          style={{ borderColor: `${theme.topColor}40`, background: theme.bgColor }}
        >
          <LayoutGrid
            size={26}
            style={{ color: theme.topColor }}
            className="opacity-60"
          />
          <p className="text-[13px] font-semibold text-foreground/70">
            Contenu du module en cours de construction
          </p>
          <p className="max-w-sm text-[12px] text-foreground/50">
            Cette section affichera prochainement le contenu métier de «{" "}
            {label} ».
          </p>
        </div>
      )}
    </div>
  );
}
