import { formatMontant } from "@/shared/lib/format";
import type { SpTagKind } from "@/portails/Sp/components/layout/SpTag";
import type { FicheDepotResumeSp } from "@/portails/Sp/types/fiche-depot.interface";

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

/** Affichage liste maquette v2 (Reçue / Rapprochée / À rattacher). */
export function statutDepotMaquette(fiche: FicheDepotResumeSp): {
  label: string;
  kind: SpTagKind;
} {
  if (!fiche.journee_tresorerie_reference) {
    return { label: "À rattacher", kind: "warn" };
  }
  const s = fiche.statut.toLowerCase();
  if (s.includes("rapproch")) {
    return { label: "Rapprochée", kind: "info" };
  }
  if (s === "recue" || s === "envoyee") {
    return { label: "Reçue", kind: "ok" };
  }
  return { label: libelleStatutDepot(fiche.statut), kind: "neu" };
}
