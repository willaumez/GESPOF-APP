import { cloneElement, isValidElement, useMemo, useState, type MouseEvent, type ReactElement } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import type { SectionBibliotheque } from "@/portails/Sp/types/bibliotheque.interface";

export function normaliserLibelleRecherche(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

interface ComboboxRechercheSectionProps {
  sections: SectionBibliotheque[];
  placeholder: string;
  libelleCreer: string;
  disabled?: boolean;
  creationEnCours?: boolean;
  onSelect: (section: SectionBibliotheque) => void;
  onCreer: (libelle: string) => void;
  trigger: React.ReactNode;
  /** Clic (défaut) ou double-clic pour ouvrir, comme CelluleEditable. */
  ouvrirSur?: "click" | "doubleClick";
  /** Texte prérempli dans le champ de recherche à l'ouverture. */
  rechercheInitiale?: string;
  align?: "start" | "end";
}

export function ComboboxRechercheSection({
  sections,
  placeholder,
  libelleCreer,
  disabled = false,
  creationEnCours = false,
  onSelect,
  onCreer,
  trigger,
  ouvrirSur = "click",
  rechercheInitiale = "",
  align = "end",
}: ComboboxRechercheSectionProps) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");

  const terme = normaliserLibelleRecherche(recherche);
  const filtrées = useMemo(() => {
    if (terme === "") return sections;
    return sections.filter((s) =>
      normaliserLibelleRecherche(s.libelle).includes(terme),
    );
  }, [sections, terme]);

  const exact = sections.some(
    (s) => normaliserLibelleRecherche(s.libelle) === terme,
  );
  const peutCreer = terme !== "" && !exact;

  function fermer() {
    setOuvert(false);
    setRecherche("");
  }

  type PropsTrigger = {
    onClick?: (e: MouseEvent) => void;
    onDoubleClick?: (e: MouseEvent) => void;
  };

  const declencheur =
    ouvrirSur === "doubleClick" && isValidElement<PropsTrigger>(trigger)
      ? cloneElement(trigger as ReactElement<PropsTrigger>, {
          onClick: (e) => {
            e.preventDefault();
            (trigger as ReactElement<PropsTrigger>).props.onClick?.(e);
          },
          onDoubleClick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            (trigger as ReactElement<PropsTrigger>).props.onDoubleClick?.(e);
            if (disabled) return;
            setRecherche(rechercheInitiale);
            setOuvert(true);
          },
        })
      : trigger;

  return (
    <Popover
      open={ouvert}
      onOpenChange={(o) => {
        if (o && ouvrirSur === "doubleClick") return;
        setOuvert(o);
        if (o) setRecherche(rechercheInitiale);
        else setRecherche("");
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        {declencheur}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-80 p-0"
        onOpenAutoFocus={(e) => {
          if (ouvrirSur === "doubleClick") return;
          e.preventDefault();
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={recherche}
            onValueChange={setRecherche}
          />
          <CommandList>
            {filtrées.length === 0 && !peutCreer ? (
              <CommandEmpty>Aucun résultat.</CommandEmpty>
            ) : null}
            {filtrées.length > 0 ? (
              <CommandGroup>
                {filtrées.map((section) => (
                  <CommandItem
                    key={section.id}
                    value={section.libelle}
                    onSelect={() => {
                      onSelect(section);
                      fermer();
                    }}
                  >
                    {section.libelle}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {peutCreer ? (
              <CommandGroup>
                <CommandItem
                  value={`creer-${recherche}`}
                  disabled={creationEnCours}
                  onSelect={() => {
                    onCreer(recherche.trim());
                    fermer();
                  }}
                >
                  {creationEnCours ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  {libelleCreer} « {recherche.trim()} »
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
