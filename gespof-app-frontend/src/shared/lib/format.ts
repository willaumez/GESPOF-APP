/**
 * Formate un montant en français :
 * - parties entières avec espaces (ex. 1 500)
 * - décimales (",xx") uniquement s’il y en a vraiment
 */
export function formatMontant(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";

  const n =
    typeof val === "number"
      ? val
      : Number(
          String(val)
            .replace(/[\s\u00A0\u202F']/g, "")
            .replace(",", "."),
        );

  if (!Number.isFinite(n)) return "—";

  const cents = Math.round(Math.abs(n) * 100);
  const avecDecimales = cents % 100 !== 0;

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: avecDecimales ? 2 : 0,
    maximumFractionDigits: avecDecimales ? 2 : 0,
  }).format(n);
}
