import type { ReactNode } from "react";
import { getPortalMenu } from "@/shared/config/menu";

const theme = getPortalMenu("sp").theme;

/**
 * En-tête de page SP — maquette Prototype v2
 * (eyebrow mono · titre Serif · description · actions).
 */
export function SpPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-end justify-between"
      style={{ gap: 16 }}
    >
      <div className="flex min-w-0 flex-col" style={{ gap: 6 }}>
        <div
          className="font-mono text-xs"
          style={{
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            color: theme.textColor,
          }}
        >
          {eyebrow}
        </div>
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
          <div className="text-[14.5px] text-[#475569] text-pretty">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
