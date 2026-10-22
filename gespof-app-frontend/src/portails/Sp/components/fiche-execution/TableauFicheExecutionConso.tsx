import { Inbox, Loader2, Table2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  estConteneurTypeSection,
  formaterMontantFcfa,
  styleIndentSection,
} from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { LigneGroupeType } from "@/portails/Sp/components/fiche-bleue/LigneGroupeType";
import type {
  ColonneConso,
  LigneConso,
  MatriceFicheExecutionConso,
} from "@/portails/Sp/types/fiche-execution-conso.interface";

function fondLigne(ligne: LigneConso): string | undefined {
  if (ligne.type === "solde") {
    return ligne.est_racine ? "bg-[#fdf6e3]" : "bg-sky-50";
  }
  if (ligne.type === "recette") return "bg-emerald-50";
  if (ligne.type === "depense") return "bg-rose-50";
  return undefined;
}

function valeurCellule(ligne: LigneConso, colonne: ColonneConso): string | null {
  if (colonne.type === "total") {
    return ligne.totaux_semaine[colonne.cle] ?? null;
  }
  return ligne.valeurs[colonne.cle] ?? (colonne.date ? ligne.valeurs[colonne.date] : null);
}

interface TableauFicheExecutionConsoProps {
  matrice: MatriceFicheExecutionConso | null;
  chargement?: boolean;
  /** Hauteur max du conteneur scrollable (inline). En plein écran, laisser vide. */
  maxHeightClassName?: string;
}

export function TableauFicheExecutionConso({
  matrice,
  chargement = false,
  maxHeightClassName = "max-h-[calc(100vh-16rem)]",
}: TableauFicheExecutionConsoProps) {
  const colonnes = matrice?.colonnes ?? [];
  const lignes = matrice?.lignes ?? [];
  const idPremiereRecette = lignes.find((l) => l.est_racine && l.type === "recette")?.id;
  const idPremiereDepense = lignes.find((l) => l.est_racine && l.type === "depense")?.id;

  if (chargement && !matrice) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin" aria-label="Chargement" />
      </div>
    );
  }

  if (!matrice || lignes.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
        <Table2 className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-[13px] text-muted-foreground">
          Aucune rubrique consolidée pour cette période.
        </p>
      </div>
    );
  }

  return (
    <Table
      className="border-separate border-spacing-0"
      containerClassName={cn(
        "h-full overflow-auto rounded-xl border",
        maxHeightClassName,
      )}
    >
      <TableHeader className="sticky top-0 z-20 bg-muted">
        <TableRow className="hover:bg-muted has-aria-expanded:bg-muted">
          <TableHead className="sticky left-0 z-30 min-w-[12rem] bg-muted text-[11px] font-bold uppercase tracking-wider shadow-[4px_0_8px_-6px_rgba(0,0,0,0.18)] sm:min-w-[18rem] sm:text-sm md:min-w-[22rem]">
            Bancaire
          </TableHead>
          {colonnes.map((colonne, i) => (
            <TableHead
              key={
                colonne.type === "total"
                  ? `t-${colonne.cle}-${i}`
                  : colonne.cle
              }
              className="min-w-[6.5rem] whitespace-nowrap bg-muted text-right text-[11px] font-bold uppercase tracking-wider sm:min-w-[7.5rem] sm:text-sm"
            >
              {colonne.type === "total" ? (
                "TOTAL"
              ) : (
                <span className="flex flex-col items-end leading-tight">
                  <span>{colonne.libelle}</span>
                  {colonne.sous_libelle ? (
                    <span className="text-[11px] font-medium normal-case tracking-normal text-muted-foreground">
                      {colonne.sous_libelle}
                    </span>
                  ) : null}
                </span>
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={colonnes.length + 1}
              className="py-10 text-center text-muted-foreground"
            >
              <span className="inline-flex flex-col items-center gap-1.5">
                <Inbox className="size-5" />
                Aucune ligne.
              </span>
            </TableCell>
          </TableRow>
        ) : (
          lignes.flatMap((ligne) => {
            const fond = fondLigne(ligne);
            const afficherGroupe =
              ligne.est_racine
              && (ligne.type === "recette" || ligne.type === "depense")
              && ligne.id === (ligne.type === "recette"
                ? idPremiereRecette
                : idPremiereDepense)
              && !estConteneurTypeSection(ligne.nom, ligne.type, true);
            const row = (
              <TableRow
                key={ligne.id}
                className={cn("hover:bg-transparent", fond)}
              >
                <TableCell
                  className={cn(
                    "sticky left-0 z-10 font-medium shadow-[4px_0_8px_-6px_rgba(0,0,0,0.12)]",
                    fond ?? "bg-background",
                    ligne.est_racine && "font-bold uppercase",
                    !ligne.est_feuille && !ligne.est_racine && "font-semibold",
                  )}
                >
                  <span
                    className="block truncate"
                    style={styleIndentSection(ligne.niveau)}
                  >
                    {ligne.nom}
                  </span>
                </TableCell>
                {colonnes.map((colonne, i) => {
                  const brut = valeurCellule(ligne, colonne);
                  return (
                    <TableCell
                      key={
                        colonne.type === "total"
                          ? `${ligne.id}-t-${colonne.cle}-${i}`
                          : `${ligne.id}-${colonne.cle}`
                      }
                      className={cn(
                        "text-right tabular-nums",
                        colonne.type === "total" && "bg-muted font-semibold",
                      )}
                    >
                      {brut == null ? "—" : formaterMontantFcfa(brut)}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
            return afficherGroupe
              ? [
                  <LigneGroupeType
                    key={`groupe-${ligne.type}`}
                    type={ligne.type}
                    colSpan={colonnes.length + 1}
                    className="bg-muted"
                  />,
                  row,
                ]
              : [row];
          })
        )}
      </TableBody>
    </Table>
  );
}
