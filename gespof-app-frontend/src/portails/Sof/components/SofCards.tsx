import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Minus, X } from "lucide-react";
import { toast } from "sonner";
import { listerPeriodes } from "@/portails/Sof/api/referentiel";
import type { PeriodeSof } from "@/portails/Sof/types/referentiel.interface";
import { cn } from "@/shared/lib/utils";

/** Éléments d'UI partagés des pages SOF Phase 2 (maquette SOF v2). */

export const SOF_VERT = "#2a7f62";
export const MONO = '"IBM Plex Mono", ui-monospace, monospace';

export const champCls =
  "h-[34px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[13px] text-[#0f172a] outline-none";

export const btnSecondaire =
  "inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";

export const btnPrimaire =
  "inline-flex h-[38px] items-center gap-2 rounded-md px-3.5 text-[13.5px] font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";

export const thCls =
  "px-2.5 py-2 text-[11px] font-semibold tracking-[0.05em] whitespace-nowrap text-[#64748b] uppercase";
export const tdCls = "px-2.5 py-2 text-[13px] text-[#0f172a]";
export const tdMontant: CSSProperties = {
  textAlign: "right",
  fontFamily: MONO,
  fontVariantNumeric: "tabular-nums",
};

export const NOMS_MOIS = [
  "",
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

export function dateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function moisPeriodeLibelle(p: PeriodeSof | undefined): string {
  if (!p) return "";
  const m = NOMS_MOIS[p.mois] ?? String(p.mois);
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${p.exercice_annee}`;
}

/** Charge les périodes (plus récente d'abord) et sélectionne la première. */
export function usePeriodesSof() {
  const [periodes, setPeriodes] = useState<PeriodeSof[]>([]);
  const [periodeId, setPeriodeId] = useState<number | "">("");
  const [pret, setPret] = useState(false);

  useEffect(() => {
    listerPeriodes()
      .then((res) => {
        const liste = [...(res.periodes ?? [])].sort(
          (a, b) => b.exercice_annee - a.exercice_annee || b.mois - a.mois,
        );
        setPeriodes(liste);
        if (liste[0]) setPeriodeId(liste[0].id);
      })
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Périodes indisponibles."),
      )
      .finally(() => setPret(true));
  }, []);

  const periode = periodes.find((p) => p.id === periodeId);
  return { periodes, periodeId, setPeriodeId, periode, pret };
}

/** Sélecteur de mois (maquette « mc »). */
export function SofPeriodeSelect({
  periodes,
  value,
  onChange,
  label = "Période",
}: {
  periodes: PeriodeSof[];
  value: number | "";
  onChange: (id: number | "") => void;
  label?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
      {label}
      <select
        value={value === "" ? "" : String(value)}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        className={cn(champCls, "min-w-[200px]")}
      >
        {periodes.map((p) => (
          <option key={p.id} value={p.id}>
            {moisPeriodeLibelle(p)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Barre de filtres (période · segments) au-dessus du contenu. */
export function SofBarreFiltres({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-end gap-x-3.5 gap-y-3 rounded-lg border border-[#e2e8f0] bg-white"
      style={{ padding: "12px 14px" }}
    >
      {children}
    </div>
  );
}

export function CardShell({
  title,
  sub,
  headRight,
  children,
  tone,
  className,
  stretch,
}: {
  title: string;
  sub?: string;
  headRight?: ReactNode;
  children: ReactNode;
  tone?: { bg: string; bd: string };
  className?: string;
  /** Occupe la hauteur restante dans une colonne flex. */
  stretch?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border",
        stretch && "flex-1",
        className,
      )}
      style={{
        background: tone?.bg ?? "#fff",
        borderColor: tone?.bd ?? "#e2e8f0",
      }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e2e8f0]"
        style={{ padding: "12px 16px" }}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-[#0f172a]">
            {title}
          </span>
          {sub ? (
            <span className="text-[12.5px] text-[#64748b]">{sub}</span>
          ) : null}
        </span>
        {headRight ? (
          <div className="flex flex-wrap items-center gap-2">{headRight}</div>
        ) : null}
      </div>
      <div className={cn(stretch && "min-h-0 flex-1")}>{children}</div>
    </section>
  );
}

export function ChipCol({
  label,
  st,
}: {
  label: string;
  st: "ok" | "ko" | "neu";
}) {
  const T = {
    ok: { bd: "#bfdccf", bg: "#f0f7f4", fg: "#1e6650", Icon: Check },
    ko: { bd: "#fecaca", bg: "#fee2e2", fg: "#b91c1c", Icon: X },
    neu: { bd: "#e2e8f0", bg: "#f8fafc", fg: "#64748b", Icon: Minus },
  }[st];
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px]"
      style={{
        border: `1px solid ${T.bd}`,
        background: T.bg,
        color: T.fg,
        fontFamily: MONO,
      }}
    >
      <T.Icon size={12} strokeWidth={2.5} />
      {label}
    </span>
  );
}

export function Kpi({
  label,
  valeur,
  unite,
  sous,
  accent = SOF_VERT,
  fg = "#0f172a",
  sousColor = "#64748b",
  onClick,
  className,
}: {
  label: string;
  valeur: string;
  unite?: string;
  sous: string;
  accent?: string;
  fg?: string;
  sousColor?: string;
  onClick?: () => void;
  className?: string;
}) {
  const classNames = cn(
    "flex flex-col gap-1.5 rounded-lg border border-[#e2e8f0] bg-white text-left",
    onClick && "cursor-pointer transition-colors hover:bg-[#f8fafc]",
    className,
  );
  const style = { padding: "14px 16px", borderTop: `3px solid ${accent}` };
  const body = (
    <>
      <span className="text-[11.5px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
        {label}
      </span>
      <span className="flex flex-wrap items-baseline gap-1.5">
        <span
          className="text-[21px] font-semibold"
          style={{ fontVariantNumeric: "tabular-nums", color: fg }}
        >
          {valeur}
        </span>
        {unite ? (
          <span className="text-[12px] font-medium text-[#64748b]">{unite}</span>
        ) : null}
      </span>
      <span className="text-[12.5px]" style={{ color: sousColor }}>
        {sous}
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classNames} style={style}>
        {body}
      </button>
    );
  }
  return (
    <div className={classNames} style={style}>
      {body}
    </div>
  );
}

/** Pastille de statut (maquette « t »). */
export function SofTag({
  children,
  ton,
}: {
  children: ReactNode;
  ton: "ok" | "rose" | "neu" | "ambre";
}) {
  const T = {
    ok: { bg: "#e3f1ea", fg: "#1e6650", bd: "#bfdccf" },
    rose: { bg: "#fee2e2", fg: "#b91c1c", bd: "#fecaca" },
    neu: { bg: "#f1f5f9", fg: "#475569", bd: "#e2e8f0" },
    ambre: { bg: "#fef3c7", fg: "#92400e", bd: "#fde68a" },
  }[ton];
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[12px] font-semibold"
      style={{ background: T.bg, color: T.fg, border: `1px solid ${T.bd}` }}
    >
      {children}
    </span>
  );
}

/** Note d'information (maquette X.TX tone « canard »). */
export function SofNote({
  lignes,
  title,
}: {
  lignes: string[];
  title?: string;
}) {
  return (
    <CardShell
      title={title ?? "Information"}
      tone={{ bg: "#f0f7f4", bd: "#bfdccf" }}
    >
      <div className="flex flex-col gap-2" style={{ padding: "14px 16px" }}>
        {lignes.map((l) => (
          <div
            key={l}
            className="flex gap-2.5 text-[13.5px] leading-[1.55]"
            style={{ color: "#1e6650" }}
          >
            <span
              className="mt-[9px] size-[5px] flex-none rounded-full"
              style={{ background: SOF_VERT }}
            />
            <span>{l}</span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

export function Chargement({ texte = "Chargement…" }: { texte?: string }) {
  return (
    <div className="flex min-h-[160px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
      {texte}
    </div>
  );
}
