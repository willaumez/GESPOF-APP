import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { getPortalMenu } from "@/shared/config/menu";

const theme = getPortalMenu("sp").theme;

const base =
  "inline-flex h-[38px] items-center gap-2 whitespace-nowrap rounded-md px-3.5 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50";

export function SpBoutonSecondaire({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        base,
        "border border-[#cbd5e1] bg-white font-medium text-[#0f172a] hover:border-[#94a3b8] hover:bg-[#f8fafc]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SpBoutonPrimaire({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(base, "border-0 font-semibold text-white", className)}
      style={{ background: theme.ctaColor }}
      {...props}
    >
      {children}
    </button>
  );
}
