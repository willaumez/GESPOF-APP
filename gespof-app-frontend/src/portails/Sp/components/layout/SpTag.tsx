import type { ReactNode } from "react";

export const SP_TAG = {
  ok: { bg: "#ecfdf5", fg: "#047857" },
  warn: { bg: "#fffbeb", fg: "#b45309" },
  bad: { bg: "#fef2f2", fg: "#b91c1c" },
  info: { bg: "#eff6ff", fg: "#1d4ed8" },
  neu: { bg: "#f1f5f9", fg: "#475569" },
} as const;

export type SpTagKind = keyof typeof SP_TAG;

/** Pastille de statut — Prototype v2. */
export function SpTag({
  kind,
  children,
}: {
  kind: SpTagKind;
  children: ReactNode;
}) {
  const t = SP_TAG[kind];
  return (
    <span
      className="inline-block whitespace-nowrap rounded px-[9px] py-0.5 text-xs font-medium"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}
