import { formatMontant } from "@/shared/lib/format";

export const STATUT_FICHE_DEPOT: Record<
  string,
  { label: string; badge: string }
> = {
  envoyee: {
    label: "Envoyée",
    badge: "border-transparent bg-emerald-100 text-emerald-800",
  },
  recue: {
    label: "Reçue",
    badge: "border-transparent bg-amber-100 text-amber-900",
  },
  cree: {
    label: "Créée",
    badge: "border-transparent bg-slate-100 text-slate-700",
  },
};

export function formaterMontantDepot(valeur: string | number): string {
  const formate = formatMontant(valeur);
  return formate === "—" ? String(valeur) : formate;
}

export function libelleStatutDepot(statut: string): string {
  return STATUT_FICHE_DEPOT[statut]?.label ?? statut.replace("_", " ");
}
