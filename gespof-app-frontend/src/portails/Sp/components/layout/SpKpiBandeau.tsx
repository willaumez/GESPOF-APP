import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { getPortalMenu } from "@/shared/config/menu";

export interface SpKpiItem {
  libelle: string;
  valeur: ReactNode;
  sousTitre?: ReactNode;
  /** Met en avant la carte (fond teinté + barre supérieure thème). */
  highlight?: boolean;
}

/**
 * Bandeau KPI — Prototype v2 (grille blanche, libellé uppercase, valeur 24px).
 */
export function SpKpiBandeau({ items }: { items: SpKpiItem[] }) {
  const theme = getPortalMenu("sp").theme;
  return (
    <div className="grid overflow-hidden rounded-lg border border-[#e2e8f0] bg-white [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
      {items.map((item, i) => (
        <div
          key={item.libelle}
          className={cn(
            "flex flex-col gap-2 border-[#e2e8f0] px-[22px] py-[18px]",
            i < items.length - 1 && "border-r",
          )}
          style={{
            background: item.highlight ? theme.bgColor : "#fff",
            boxShadow: item.highlight
              ? `inset 0 3px 0 ${theme.topColor}`
              : undefined,
          }}
        >
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
            {item.libelle}
          </span>
          <span className="text-2xl font-semibold leading-[1.1] tabular-nums text-[#0f172a]">
            {item.valeur}
          </span>
          {item.sousTitre ? (
            <span className="text-[13px] text-[#475569]">{item.sousTitre}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
