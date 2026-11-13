import { formatMontant } from "@/shared/lib/format";

/** Unité d'affichage des montants (maquette SOF — unitSeg). */
export type UniteMontant = "F" | "M" | "Md";

export const UNITES: { cle: UniteMontant; libelle: string }[] = [
  { cle: "F", libelle: "FCFA" },
  { cle: "M", libelle: "Millions" },
  { cle: "Md", libelle: "Milliards" },
];

/** Parse un montant saisi / formaté (espaces, virgule décimale). */
export function parseMontant(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n =
    typeof v === "number"
      ? v
      : Number(
          String(v)
            .replace(/[\s\u00A0\u202F']/g, "")
            .replace("−", "-")
            .replace(",", "."),
        );
  return Number.isFinite(n) ? n : 0;
}

/** Convertit un montant saisi dans l'unité d'affichage vers des FCFA (2 décimales). */
export function versFcfa(affiche: string, unite: UniteMontant): string {
  const n = parseMontant(affiche);
  if (unite === "M") return (n * 1e6).toFixed(2);
  if (unite === "Md") return (n * 1e9).toFixed(2);
  return n.toFixed(2);
}

/** Libellé court maquette (X.uL). */
export function libelleUniteCourt(unite: UniteMontant): string {
  return ({ F: "FCFA", M: "M FCFA", Md: "Md FCFA" } as const)[unite];
}

export function formaterSelonUnite(
  valeur: string | number,
  unite: UniteMontant,
): string {
  const n =
    typeof valeur === "number"
      ? valeur
      : Number(
          String(valeur)
            .replace(/[\s\u00A0\u202F']/g, "")
            .replace(",", "."),
        );
  if (!Number.isFinite(n)) return "—";
  let x = Math.abs(n);
  let decimales = 0;
  if (unite === "M") {
    x /= 1e6;
    decimales = 2;
  } else if (unite === "Md") {
    x /= 1e9;
    decimales = 2;
  }
  const signe = n < 0 ? "−" : "";
  return signe + formatMontant(x.toFixed(decimales));
}
