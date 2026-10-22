import { TableCell, TableRow } from "@/shared/components/ui/table";
import { cn } from "@/shared/lib/utils";
import { LIBELLE_GROUPE_TYPE } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";

/**
 * En-tête visuel du type (recette / dépense), pas une section.
 * Le libellé est figé à gauche : la cellule fusionnée défile avec le tableau,
 * mais « RECETTES » / « DÉPENSES » reste visible au défilement horizontal.
 */
export function LigneGroupeType({
  type,
  colSpan,
  className,
}: {
  type: "recette" | "depense";
  colSpan: number;
  className?: string;
}) {
  return (
    <TableRow className={cn(
      "hover:bg-transparent",
      type === "recette" ? "bg-emerald-100/90" : "bg-orange-100/90",
      className,
    )}>
      <TableCell
        colSpan={colSpan}
        className="py-1.5 text-[12px] font-bold tracking-wide text-foreground"
      >
        <span className="sticky left-2 inline-block">
          {LIBELLE_GROUPE_TYPE[type]}
        </span>
      </TableCell>
    </TableRow>
  );
}
