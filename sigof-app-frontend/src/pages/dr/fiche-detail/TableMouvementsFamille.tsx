import { Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatMontant } from "@/lib/format";
import type { LigneMouvement } from "@/interfaces/pool-sr";
import { regrouperParObservations } from "./utils";

interface TableMouvementsFamilleProps {
  lignes: LigneMouvement[];
  peutGererLignes: boolean;
  onModifierLigne: (ligne: LigneMouvement) => void;
  onSupprimerLigne: (ligne: LigneMouvement) => void;
}

export function TableMouvementsFamille({
  lignes,
  peutGererLignes,
  onModifierLigne,
  onSupprimerLigne,
}: TableMouvementsFamilleProps) {
  return (
    <Table containerClassName="min-h-0 max-h-[60vh] overflow-auto [scrollbar-gutter:stable]">
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow className="bg-muted hover:bg-muted">
          <TableHead className="whitespace-nowrap">Date du virement</TableHead>
          <TableHead className="min-w-[200px]">Bénéficiaires</TableHead>
          <TableHead className="whitespace-nowrap">N° O.V.</TableHead>
          <TableHead className="whitespace-nowrap">Banques</TableHead>
          <TableHead className="whitespace-nowrap text-right">Dépenses</TableHead>
          <TableHead className="min-w-[160px]">Observations</TableHead>
          {peutGererLignes && (
            <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {regrouperParObservations(lignes).map(
          ({ ligne: l, premierDuGroupe, dernierDuGroupe, tailleGroupe }) => (
            <TableRow key={l.id} className={cn(!dernierDuGroupe && "border-b-0")}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {l.date_virement ?? "—"}
              </TableCell>
              <TableCell
                className="max-w-[260px] truncate font-medium text-foreground"
                title={l.beneficiaire}
              >
                {l.beneficiaire}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {l.numero_ov ?? "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {l.banque ?? "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums font-medium text-foreground">
                {formatMontant(String(l.depenses))}
              </TableCell>
              {premierDuGroupe && (
                <TableCell
                  rowSpan={tailleGroupe}
                  className="max-w-[220px] truncate border align-middle text-muted-foreground"
                  title={l.observations.map((o) => o.contenu).join(" · ")}
                >
                  {l.observations.length > 0
                    ? l.observations.map((o) => o.contenu).join(" · ")
                    : "—"}
                </TableCell>
              )}
              {peutGererLignes && (
                <TableCell className="whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onModifierLigne(l)}
                          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Modifier</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onSupprimerLigne(l)}
                          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Supprimer</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ),
        )}
      </TableBody>
    </Table>
  );
}
