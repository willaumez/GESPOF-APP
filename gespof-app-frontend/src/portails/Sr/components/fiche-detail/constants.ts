import type { LigneMouvement } from "@/portails/Sr/types";

export const STATUT_CFG: Record<
  string,
  { badge: string; dot: string; accent: string; bg: string; label: string }
> = {
  envoyee: {
    badge: "border-transparent bg-success/10 text-success",
    dot: "bg-success",
    accent: "border-l-success border-r-success",
    bg: "bg-[#2a7f62]/5",
    label: "Envoyée",
  },
  recue: {
    badge: "border-transparent bg-warning/10 text-warning",
    dot: "bg-warning",
    accent: "border-l-warning border-r-warning",
    bg: "",
    label: "Reçue SP",
  },
  cree: {
    badge: "border-transparent bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
    accent: "border-l-muted-foreground/30 border-r-muted-foreground/30",
    bg: "",
    label: "Créée",
  },
};

export type TypeMouvement = "numeraire" | "sigma" | "systac";

export const TYPE_CFG: Record<
  TypeMouvement,
  { label: string; bar: string; subtotal: string; stat: string }
> = {
  numeraire: {
    label: "Numéraire",
    bar: "bg-violet-500/10 text-violet-800 dark:text-violet-300",
    subtotal: "bg-violet-500/15 text-violet-900 dark:text-violet-200",
    stat: "text-violet-700 dark:text-violet-300",
  },
  sigma: {
    label: "Sigma",
    bar: "bg-rose-500/10 text-rose-800 dark:text-rose-300",
    subtotal: "bg-rose-500/15 text-rose-900 dark:text-rose-200",
    stat: "text-rose-700 dark:text-rose-300",
  },
  systac: {
    label: "Systac",
    bar: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    subtotal: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
    stat: "text-amber-700 dark:text-amber-300",
  },
};

export const SYSTAC_COL_WIDTHS = [
  "4%",
  "5%",
  "12%",
  "7%",
  "5%",
  "12%",
  "13%",
  "28%",
  "14%",
];

export interface LigneFiltrable extends LigneMouvement {
  type: TypeMouvement;
}

export interface SectionMouvement {
  type: TypeMouvement;
  lignes: LigneMouvement[];
  total: string | undefined;
  totalGroupe?: string;
  montant: number;
}
