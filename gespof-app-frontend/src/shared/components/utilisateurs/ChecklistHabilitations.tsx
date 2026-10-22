import { Checkbox } from "@/shared/components/ui/checkbox";
import { cn } from "@/shared/lib/utils";
import { LIBELLE_ACCES, type Acces } from "@/shared/lib/acces";
import type { RoleUtilisateur } from "@/shared/hooks/auth-context";
import { filtrerCatalogue } from "./habilitations-utils";

/**
 * Cases à cocher des habilitations individuelles d'un métier — réservées à
 * l'administrateur. Tout est coché par défaut (hérité du métier) ; décocher
 * une case retire cet accès précis pour CET utilisateur uniquement, sans
 * affecter les autres utilisateurs du même métier (voir
 * Utilisateur::getAcces() côté backend).
 *
 * Bloc "nu" (pas d'en-tête ni de recherche) : voir PanneauHabilitations, qui
 * fournit le compteur, la barre de recherche et le cadre scrollable autour.
 */
export function ChecklistHabilitations({
  metier,
  acces,
  onBasculer,
  recherche = "",
}: {
  metier: RoleUtilisateur | "";
  acces: Acces[];
  onBasculer: (code: Acces) => void;
  recherche?: string;
}) {
  if (!metier) return null;
  const catalogue = filtrerCatalogue(metier, recherche);

  return (
    <div className="space-y-1">
      {catalogue.map((code) => {
        const coche = acces.includes(code);
        return (
          <label
            key={code}
            className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-[12px] hover:bg-muted/50"
          >
            <Checkbox checked={coche} onCheckedChange={() => onBasculer(code)} className="mt-0.5" />
            <span className={cn(!coche && "text-muted-foreground line-through")}>
              {LIBELLE_ACCES[code]}
            </span>
          </label>
        );
      })}
    </div>
  );
}
