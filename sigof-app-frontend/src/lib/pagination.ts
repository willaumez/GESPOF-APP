import { PAGINATION } from "@/config/app";

export interface OptionTaillePage {
  value: string;
  label: string;
}

export function optionsTaillePagination(avecTout = true): OptionTaillePage[] {
  const options = PAGINATION.OPTIONS_TAILLE.map((n) => ({
    value: String(n),
    label: String(n),
  }));
  return avecTout ? [...options, { value: "all", label: "Tout" }] : options;
}
