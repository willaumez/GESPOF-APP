import { useMemo } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import {
  TableauExcelResizable,
  type ColonneExcelDef,
  type LigneExcelDef,
} from "@/portails/Sp/components/plein-ecran/TableauExcelResizable";
import {
  formaterMontantFcfa,
  styleIndentSection,
} from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import type {
  FicheExecutionDetail,
  SectionFicheExecution,
} from "@/portails/Sp/types/fiche-execution.interface";
import type { TypeSectionBibliotheque } from "@/portails/Sp/types/bibliotheque.interface";

interface LigneAplat {
  id: number;
  nom: string;
  type: TypeSectionBibliotheque;
  niveau: number;
  programme: string;
  realise: string;
  ecart: string;
  estRacine: boolean;
  estFeuille: boolean;
  nonProgramme: boolean;
}

function estZero(valeur: string): boolean {
  const n = Number(valeur.replace(",", "."));
  return Number.isFinite(n) && n === 0;
}

function estNegatif(valeur: string): boolean {
  const n = Number(valeur.replace(",", "."));
  return Number.isFinite(n) && n < 0;
}

function aplatirSections(
  sections: SectionFicheExecution[],
  niveau = 0,
  typeRacine?: TypeSectionBibliotheque,
): LigneAplat[] {
  const out: LigneAplat[] = [];
  for (const s of sections) {
    const type = niveau === 0 ? s.type : (typeRacine ?? s.type);
    out.push({
      id: s.id,
      nom: s.nom,
      type,
      niveau,
      programme: s.montant_programme,
      realise: s.montant_realise,
      ecart: s.montant_ecart,
      estRacine: niveau === 0,
      estFeuille: s.sous_sections.length === 0,
      nonProgramme: Boolean(s.non_programme),
    });
    if (s.sous_sections.length > 0) {
      out.push(...aplatirSections(s.sous_sections, niveau + 1, type));
    }
  }
  return out;
}

function fondLigne(type: TypeSectionBibliotheque, nonProgramme: boolean): string {
  if (nonProgramme) {
    if (type === "recette") return "bg-amber-50";
    if (type === "depense") return "bg-orange-50";
  }
  if (type === "recette") return "bg-emerald-50/80";
  if (type === "depense") return "bg-rose-50/80";
  if (type === "solde") return "bg-[#fdf6e3]";
  return "";
}

const COLONNES: ColonneExcelDef[] = [
  {
    id: "numero",
    label: "N°",
    defaultSize: "6%",
    minSize: "44px",
    maxSize: "14%",
    align: "center",
  },
  {
    id: "bancaire",
    label: "Bancaire",
    defaultSize: "34%",
    minSize: "18%",
  },
  {
    id: "programme",
    label: "Programme (FCFA)",
    defaultSize: "20%",
    minSize: "12%",
    align: "right",
  },
  {
    id: "realise",
    label: "Réalisé (FCFA)",
    defaultSize: "20%",
    minSize: "12%",
    align: "right",
  },
  {
    id: "ecart",
    label: "Écart (FCFA)",
    defaultSize: "20%",
    minSize: "12%",
    align: "right",
  },
];

function construireLignes(sections: SectionFicheExecution[]): LigneExcelDef[] {
  const lignes = aplatirSections(sections);
  const soldes = lignes.filter((l) => l.type === "solde");
  const mouvements = lignes.filter((l) => l.type !== "solde");
  const out: LigneExcelDef[] = [];
  let ordreSolde = 0;
  let ordreMvt = 0;

  for (const ligne of soldes) {
    if (ligne.estRacine) ordreSolde += 1;
    out.push({
      key: `solde-${ligne.id}`,
      rowClassName: fondLigne(ligne.type, ligne.nonProgramme),
      cells: {
        numero: (
          <span className="tabular-nums text-muted-foreground">
            {ligne.estRacine ? ordreSolde : ""}
          </span>
        ),
        bancaire: (
          <div
            className={cn(
              "flex min-w-0 items-center gap-2 font-medium",
              ligne.niveau > 0
                && "border-l-2 border-muted-foreground/25 text-muted-foreground",
              !ligne.estFeuille && "font-semibold",
            )}
            style={styleIndentSection(ligne.niveau)}
            title={ligne.nom}
          >
            <span className="truncate">{ligne.nom}</span>
            {ligne.estRacine ? (
              <Badge className="shrink-0 border-transparent bg-[#c9960a]/15 text-[10px] font-semibold uppercase tracking-wide text-[#8a6508]">
                Solde d&apos;ouverture
              </Badge>
            ) : null}
          </div>
        ),
        programme: (
          <span
            className={cn(
              "truncate tabular-nums",
              ligne.estRacine
                ? "text-[14px] font-bold text-[#8a6508]"
                : "font-semibold text-sky-950",
            )}
          >
            {formaterMontantFcfa(ligne.programme)}
          </span>
        ),
        realise: null,
        ecart: null,
      },
    });
  }

  for (const ligne of mouvements) {
    if (ligne.estRacine) ordreMvt += 1;
    const afficherEcart = !estZero(ligne.realise);
    out.push({
      key: `mvt-${ligne.id}`,
      rowClassName: cn(
        fondLigne(ligne.type, ligne.nonProgramme),
        ligne.nonProgramme && ligne.type === "depense" && "border-l-4 border-l-orange-500",
        ligne.nonProgramme && ligne.type === "recette" && "border-l-4 border-l-amber-500",
      ),
      cells: {
        numero: (
          <span className="tabular-nums text-muted-foreground">
            {ligne.estRacine ? ordreMvt : ""}
          </span>
        ),
        bancaire: (
          <div
            className={cn(
              "flex min-w-0 items-center gap-2 font-medium",
              ligne.niveau > 0
                && "border-l-2 border-muted-foreground/25 text-muted-foreground",
              !ligne.estFeuille && "font-semibold",
            )}
            style={styleIndentSection(ligne.niveau)}
            title={ligne.nom}
          >
            <span className="truncate">{ligne.nom}</span>
            {ligne.nonProgramme ? (
              <Badge className="shrink-0 border-transparent bg-amber-200/90 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
                Non programmé
              </Badge>
            ) : null}
          </div>
        ),
        programme: (
          <span className="truncate tabular-nums">
            {formaterMontantFcfa(ligne.programme)}
          </span>
        ),
        realise: (
          <span className="truncate font-semibold tabular-nums">
            {formaterMontantFcfa(ligne.realise)}
          </span>
        ),
        ecart: (
          <span
            className={cn(
              "truncate tabular-nums",
              afficherEcart && estNegatif(ligne.ecart)
                ? "font-medium text-red-600"
                : "text-muted-foreground",
            )}
          >
            {afficherEcart ? formaterMontantFcfa(ligne.ecart) : "—"}
          </span>
        ),
      },
    });
  }

  return out;
}

export function TableauFicheExecutionExcel({
  fiche,
  chargement,
}: {
  fiche: FicheExecutionDetail | null;
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
          Chargement de la Fiche d&apos;exécution…
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
          Aucune Fiche d&apos;exécution à afficher.
        </p>
      </div>
    );
  }

  return (
    <TableauExcelResizable
      colonnes={COLONNES}
      lignes={lignesExcel}
      videMessage="Aucune rubrique sur cette fiche."
    />
  );
}
