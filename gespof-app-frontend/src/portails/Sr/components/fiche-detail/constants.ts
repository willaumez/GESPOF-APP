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
    bar: "bg-[#fef3c7] text-[#92400e]",
    subtotal: "bg-[#fde68a]/60 text-[#92400e]",
    stat: "text-[#92400e]",
  },
  sigma: {
    label: "SYGMA",
    bar: "bg-[#ede9fe] text-[#5b21b6]",
    subtotal: "bg-[#ddd6fe]/60 text-[#5b21b6]",
    stat: "text-[#5b21b6]",
  },
  systac: {
    label: "SYSTAC",
    bar: "bg-[#dbeafe] text-[#1e40af]",
    subtotal: "bg-[#bfdbfe]/60 text-[#1e40af]",
    stat: "text-[#1e40af]",
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
