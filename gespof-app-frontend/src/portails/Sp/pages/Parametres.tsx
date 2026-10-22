import { useState } from "react";
import type { ReactNode } from "react";
import { Library } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { getPortalMenu } from "@/shared/config/menu";
import { BibliothequeSections } from "@/portails/Sp/components/parametres/fiche-bleue/BibliothequeSections";

interface RubriqueParametres {
  id: string;
  libelle: string;
  description: string;
  icone: LucideIcon;
  contenu: () => ReactNode;
}


const RUBRIQUES: RubriqueParametres[] = [
  {
    id: "bibliotheque-sections",
    libelle: "Bibliothèque Sections",
    description: "Sections et sous-sections réutilisables des Fiches Bleues.",
    icone: Library,
    contenu: () => <BibliothequeSections />,
  },
];

export default function Parametres() {
  const [rubriqueActive, setRubriqueActive] = useState(RUBRIQUES[0].id);
  const theme = getPortalMenu("sp").theme;
  const rubrique = RUBRIQUES.find((r) => r.id === rubriqueActive) ?? RUBRIQUES[0];

  return (

    <div className="flex flex-col-reverse gap-5 lg:flex-row">
      <div className="min-w-0 flex-1">{rubrique.contenu()}</div>

      <nav
        aria-label="Rubriques des paramètres"
        className="shrink-0 lg:w-60"
      >
        <ul className="space-y-1">
          {RUBRIQUES.map((item) => {
            const Icone = item.icone;
            const active = item.id === rubrique.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setRubriqueActive(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left transition-[color,background-color,border-color] duration-200",
                    active
                      ? "bg-card shadow-sm"
                      : "text-foreground/80 hover:bg-card/60 hover:text-foreground",
                  )}
                  style={
                    active
                      ? { color: theme.topColor, borderColor: `${theme.topColor}33` }
                      : undefined
                  }
                >
                  <Icone className="mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">{item.libelle}</span>
                    <span className="block text-[11.5px] text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
