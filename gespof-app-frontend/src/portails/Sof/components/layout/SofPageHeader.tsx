import type { ReactNode } from "react";
import { getPortalMenu } from "@/shared/config/menu";

const theme = getPortalMenu("sof").theme;

/**
 * En-tête de page SOF — maquette GESPOF SOF v2
 * (fil mono · titre Serif · description · actions).
 */
export function SofPageHeader({
  eyebrow,
  title,
  description,
  remplace,
  actions,
}: {
  /** Fil mono (optionnel — absent sur certaines pages SOF v2). */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Pastille « Remplace » (maquette SOF v2). */
  remplace?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <div
        className="flex flex-wrap items-end justify-between"
        style={{ gap: 16 }}
      >
        <div className="flex min-w-0 max-w-[820px] flex-col" style={{ gap: 6 }}>
          {eyebrow ? (
            <div
              className="text-xs"
              style={{
                fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                color: theme.textColor,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <h1
            className="m-0 text-[28px] font-semibold tracking-[-0.01em] text-[#0f172a]"
            style={{
              fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif',
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          {description ? (
            <div className="text-[14.5px] leading-[1.55] text-[#475569] text-pretty">
              {description}
            </div>
          ) : null}
          {remplace ? (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[#64748b]">
              <span className="text-[10.5px] font-semibold tracking-[0.08em] uppercase">
                Remplace
              </span>
              <span
                className="rounded border border-dashed border-[#cbd5e1] bg-white px-2 py-0.5 text-[#334155]"
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                }}
              >
                {remplace}
              </span>
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
