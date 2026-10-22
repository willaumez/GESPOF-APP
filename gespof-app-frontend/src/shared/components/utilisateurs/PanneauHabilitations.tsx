import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import type { RoleUtilisateur } from "@/shared/hooks/auth-context";
import type { Acces } from "@/shared/lib/acces";
import { ChecklistHabilitations } from "./ChecklistHabilitations";
import { accesParDefaut, filtrerCatalogue } from "./habilitations-utils";

/**
 * Panneau "Habilitations individuelles" affiché en colonne droite des
 * dialogues de création/modification (réservé à l'administrateur) : compteur,
 * recherche et liste scrollable des cases à cocher.
 *
 * La recherche est un état local à ce composant — pas d'effet de synchronisation
 * ici. L'appelant doit le monter avec `key={metier}` pour repartir d'une
 * recherche vide quand le métier change (remonter via la key plutôt que
 * réinitialiser dans un effet).
 */
export function PanneauHabilitations({
  metier,
  acces,
  onBasculer,
  disabled = false,
}: {
  metier: RoleUtilisateur | "";
  acces: Acces[];
  onBasculer: (code: Acces) => void;
  disabled?: boolean;
}) {
  const [recherche, setRecherche] = useState("");
  const catalogue = accesParDefaut(metier);
  const resultats = filtrerCatalogue(metier, recherche);

  return (
    <div className="sm:border-l sm:pl-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Habilitations
          <span className="ml-2 text-xs text-muted-foreground/70">
            ({acces.length}/{catalogue.length})
          </span>
        </span>
        <div className="relative max-w-[180px] flex-1">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="h-8 pl-7 pr-2 text-sm"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="max-h-[22rem] overflow-y-auto rounded-lg border p-2.5">
        <ChecklistHabilitations metier={metier} acces={acces} onBasculer={onBasculer} recherche={recherche} />
        {recherche.trim() && resultats.length === 0 && (
          <p className="px-1.5 py-4 text-center text-xs text-muted-foreground">
            Aucune habilitation trouvée
          </p>
        )}
      </div>
    </div>
  );
}
