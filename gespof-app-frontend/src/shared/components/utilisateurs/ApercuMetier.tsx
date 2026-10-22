import { Badge } from "@/shared/components/ui/badge";
import { infoMetier } from "@/shared/lib/metiers";
import type { RoleUtilisateur } from "@/shared/hooks/auth-context";

/** Aperçu lecture-seule du portail + des actions qu'un métier attribue automatiquement. */
export function ApercuMetier({ metier }: { metier: RoleUtilisateur | "" }) {
  if (!metier) return null;
  const info = infoMetier(metier);
  if (!info) return null;

  return (
    <div className="space-y-1.5 rounded-lg border bg-muted/40 px-3 py-2.5 text-[12px]">
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-muted-foreground">Portail attribué :</span>
        <span className="font-semibold text-foreground">
          {info.portail ? info.portail.toUpperCase() : "Aucun (métier transverse)"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-muted-foreground">Actions attribuées :</span>
        {info.actions.map((a) => (
          <Badge key={a} variant="outline" className="text-[10.5px] font-normal">{a}</Badge>
        ))}
      </div>
    </div>
  );
}
