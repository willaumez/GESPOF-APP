import { Badge } from "@/shared/components/ui/badge";

export function initiales(nomComplet: string): string {
  const parts = nomComplet.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

export function partieDate(horodatage: string | null): string {
  if (!horodatage) return "—";
  const [date] = horodatage.split(" ");
  return date ?? horodatage;
}

export function estCompteConnecte(
  emailUtilisateur: string | undefined,
  emailSession: string | undefined,
): boolean {
  return !!emailUtilisateur && !!emailSession
    && emailUtilisateur.toLowerCase() === emailSession.toLowerCase();
}

export function BadgeVous() {
  return (
    <Badge className="border-transparent bg-primary px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
      Vous
    </Badge>
  );
}

export function formaterJourCourt(valeur: string): string {
  const [annee, mois, jour] = valeur.split("-").map(Number);
  if (!annee || !mois || !jour) return valeur;
  return new Date(annee, mois - 1, jour).toLocaleDateString("fr-FR", {
    month: "short",
    day: "numeric",
  });
}

export function formaterJourLong(valeur: string): string {
  const [annee, mois, jour] = valeur.split("-").map(Number);
  if (!annee || !mois || !jour) return valeur;
  return new Date(annee, mois - 1, jour).toLocaleDateString("fr-FR", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
