import type { EtatJournee } from "@/portails/Sp/types/journee-tresorerie.interface";
import { libelleDateFr } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";

export const ETAT_JOURNEE: Record<
  EtatJournee,
  { label: string; badge: string }
> = {
  brouillon: {
    label: "Brouillon",
    badge: "border-transparent bg-muted text-muted-foreground",
  },
  en_cours: {
    label: "En cours",
    badge: "border-transparent bg-primary/10 text-primary",
  },
  cloture: {
    label: "Clôturée",
    badge: "border-transparent bg-warning/10 text-warning",
  },
};

export function dateIsoDepuisReferenceJournee(reference: string): string | null {
  const m = /^JT-(\d{2})-(\d{2})-(\d{4})-/.exec(reference);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function libelleDateJournee(reference: string): string {
  const iso = dateIsoDepuisReferenceJournee(reference);
  if (!iso) return reference;
  const [y, m, d] = iso.split("-").map(Number);
  return libelleDateFr(new Date(y, m - 1, d));
}
