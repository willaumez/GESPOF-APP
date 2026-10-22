import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CornerDownRight, Eye, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Badge } from "@/shared/components/ui/badge";
import { detailSectionBibliotheque } from "@/portails/Sp/api/bibliotheque-sections";
import type {
  SectionBibliotheque, TypeSectionBibliotheque,
} from "@/portails/Sp/types/bibliotheque.interface";
import { libelleTypeSection } from "@/portails/Sp/types/bibliotheque.interface";
import { CLASSE_ARBRE_SOUS_SECTION } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";

/** Date d'ajout à la bibliothèque, ex. "19/08/2026". */
function formaterDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

const STYLE_TYPE: Record<TypeSectionBibliotheque, string> = {
  solde: "border-transparent bg-primary/10 text-primary",
  recette: "border-transparent bg-success/10 text-success",
  depense: "border-transparent bg-warning/10 text-warning",
};

interface DialogDetailSectionProps {
  sectionId: number;
  onClose: () => void;
}

/**
 * Vue en lecture seule d'une section de la bibliothèque : toute son
 * arborescence de sous-sections, avec la date d'ajout et le créateur de
 * chaque entrée.
 */
export function DialogDetailSection({ sectionId, onClose }: DialogDetailSectionProps) {
  const [section, setSection] = useState<SectionBibliotheque | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    detailSectionBibliotheque(sectionId)
      .then((data) => setSection(data.section))
      .catch(() => setErreur(true));
  }, [sectionId]);

  const noeud = (s: SectionBibliotheque, racine: boolean): ReactNode => (
    <div key={s.id} className="space-y-1.5">
      <div className="flex items-start gap-2">
        {!racine && <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
        <div className="min-w-0">
          <p className={racine ? "text-[13px] font-semibold text-foreground" : "text-[12.5px] text-foreground"}>
            {s.libelle}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Ajoutée le {formaterDate(s.date_creation)} par {s.createur}
          </p>
        </div>
        {s.sous_sections.length > 0 && (
          <Badge className="ml-auto shrink-0 border-transparent bg-muted text-muted-foreground">
            {s.sous_sections.length} sous-section{s.sous_sections.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
        {s.sous_sections.length > 0 && (
          <div className={CLASSE_ARBRE_SOUS_SECTION}>
            {s.sous_sections.map((enfant) => noeud(enfant, false))}
          </div>
        )}
    </div>
  );

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="pr-10">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Eye className="size-4" />
            </span>
            <div>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {section?.libelle ?? "Détail de la section"}
                {section && (
                  <Badge className={STYLE_TYPE[section.type]}>
                    {libelleTypeSection(section.type)}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {section
                  ? `Ajoutée le ${formaterDate(section.date_creation)} par ${section.createur}.`
                  : "Arborescence complète de la section."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {erreur ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            Impossible de charger le détail de la section.
          </p>
        ) : section === null ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : section.sous_sections.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            Cette section ne contient aucune sous-section.
          </p>
        ) : (
          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto rounded-lg border p-3 pr-2">
            {section.sous_sections.map((enfant) => noeud(enfant, false))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
