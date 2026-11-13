import { useMemo } from "react";
import { FileText, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  CelluleExcel,
  TableauExcelResizable,
  type ColonneExcelDef,
  type LigneExcelDef,
} from "@/portails/Sp/components/plein-ecran/TableauExcelResizable";
import {
  estConteneurTypeSection,
  formaterMontantFcfa,
  LIBELLE_GROUPE_TYPE,
  styleIndentSection,
} from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import type {
  FicheBleueDetail,
  SectionFicheBleue,
} from "@/portails/Sp/types/fiche-bleue.interface";
import type { TypeSectionBibliotheque } from "@/portails/Sp/types/bibliotheque.interface";

interface LigneFicheBleue {
  id: number;
  nom: string;
  niveau: number;
  montantProgramme: string;
  estRacine: boolean;
  type: TypeSectionBibliotheque;
}

function aplatirSections(
  sections: SectionFicheBleue[],
  niveau = 0,
): LigneFicheBleue[] {
  const out: LigneFicheBleue[] = [];
  for (const s of sections) {
    out.push({
      id: s.id,
      nom: s.nom,
      niveau,
      montantProgramme: s.montant_programme,
      estRacine: niveau === 0,
      type: s.type,
    });
    if (s.sous_sections.length > 0) {
      out.push(...aplatirSections(s.sous_sections, niveau + 1));
    }
  }
  return out;
}

const COLONNES: ColonneExcelDef[] = [
  {
    id: "numero",
    label: "N°",
    defaultSize: "7%",
    minSize: "48px",
    maxSize: "18%",
    align: "center",
  },
  {
    id: "bancaire",
    label: "Bancaire",
    defaultSize: "58%",
    minSize: "25%",
  },
  {
    id: "programme",
    label: "Programme (FCFA)",
    defaultSize: "35%",
    minSize: "15%",
    align: "right",
  },
];

function construireLignes(sections: SectionFicheBleue[]): LigneExcelDef[] {
  const lignes = aplatirSections(sections);
  const out: LigneExcelDef[] = [];
  let ordreRacine = 0;
  const idPremiereRecette = lignes.find(
    (l) => l.estRacine && l.type === "recette",
  )?.id;
  const idPremiereDepense = lignes.find(
    (l) => l.estRacine && l.type === "depense",
  )?.id;

  for (const ligne of lignes) {
    if (ligne.estRacine) ordreRacine += 1;
    const afficherGroupe =
      ligne.estRacine &&
      (ligne.type === "recette" || ligne.type === "depense") &&
      ligne.id ===
        (ligne.type === "recette" ? idPremiereRecette : idPremiereDepense) &&
      !estConteneurTypeSection(ligne.nom, ligne.type, true);

    if (afficherGroupe) {
      out.push({
        key: `groupe-${ligne.type}`,
        groupe: true,
        groupeClassName:
          ligne.type === "recette" ? "bg-emerald-100/90" : "bg-orange-100/90",
        cells: {
          numero: (
            <span className="truncate text-[12px] font-bold tracking-wide">
              {LIBELLE_GROUPE_TYPE[ligne.type]}
            </span>
          ),
          bancaire: null,
          programme: null,
        },
      });
    }

    out.push({
      key: `ligne-${ligne.id}`,
      cells: {
        numero: (
          <span className="tabular-nums text-muted-foreground">
            {ligne.estRacine ? ordreRacine : ""}
          </span>
        ),
        bancaire: (
          <div
            className={cn(
              "min-w-0 font-medium",
              ligne.niveau > 0 &&
                "border-l-2 border-muted-foreground/25 text-muted-foreground",
            )}
            style={styleIndentSection(ligne.niveau)}
            title={ligne.nom}
          >
            <span className="block break-words whitespace-normal leading-snug">
              {ligne.nom}
            </span>
          </div>
        ),
        programme: (
          <span className="truncate font-semibold tabular-nums">
            {formaterMontantFcfa(ligne.montantProgramme)}
          </span>
        ),
      },
    });
  }
  return out;
}

export function TableauFicheBleueExcel({
  fiche,
  chargement,
}: {
  fiche: FicheBleueDetail | null;
  chargement?: boolean;
}) {
  const lignesExcel = useMemo(
    () => (fiche ? construireLignes(fiche.sections) : []),
    [fiche],
  );

  if (chargement && !fiche) {
    return (
      <div className="flex h-full min-h-44 items-center justify-center rounded-xl border text-muted-foreground">
        <div className="flex items-center gap-2 text-[13px]">
          <Loader2 className="size-5 animate-spin" />
          Chargement de la Fiche Bleue…
        </div>
      </div>
    );
  }

  if (!fiche) {
    return (
      <div
        className="flex h-full min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center"
        role="status"
      >
        <FileText className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-[13px] text-muted-foreground">
          Aucune Fiche Bleue à afficher.
        </p>
      </div>
    );
  }

  return (
    <TableauExcelResizable
      colonnes={COLONNES}
      lignes={lignesExcel}
      videMessage="Aucune section sur cette fiche."
    />
  );
}

/** Réexport pour les consommateurs qui style des cellules. */
export { CelluleExcel };
