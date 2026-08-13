import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { cn } from "@/shared/lib/utils";
import { formatMontant } from "@/shared/lib/format";
import type { LigneSystacDetail } from "@/portails/Dr/modules/ServiceReglement/types";
import { SYSTAC_COL_WIDTHS } from "./constants";

interface TableSystacProps {
  lignes: LigneSystacDetail[];
}

export function TableSystac({ lignes }: TableSystacProps) {
  const taillesGroupes = lignes.reduce<Record<number, number>>((acc, l) => {
    acc[l.id_groupe] = (acc[l.id_groupe] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Table
      containerClassName="min-h-0 max-h-[60vh] overflow-auto [scrollbar-gutter:stable]"
      className="table-fixed"
    >
      <colgroup>
        {SYSTAC_COL_WIDTHS.map((largeur, i) => (
          <col key={i} style={{ width: largeur }} />
        ))}
      </colgroup>
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow className="bg-muted hover:bg-muted">
          <TableHead className="whitespace-nowrap">C_PCA</TableHead>
          <TableHead className="whitespace-nowrap">C_ORIG</TableHead>
          <TableHead className="min-w-[160px]">L_ORIG</TableHead>
          <TableHead className="whitespace-nowrap">N_BV</TableHead>
          <TableHead className="whitespace-nowrap text-right">NB_REGL</TableHead>
          <TableHead className="whitespace-nowrap text-right">MONTANT</TableHead>
          <TableHead className="whitespace-nowrap text-right">MONTANTS GROUPÉS</TableHead>
          <TableHead className="min-w-[200px]">DÉSIGNATIONS</TableHead>
          <TableHead className="whitespace-nowrap">D_GENERATION_IP</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((l, i) => {
          const premierDuGroupe = i === 0 || lignes[i - 1].id_groupe !== l.id_groupe;
          const dernierDuGroupe =
            i === lignes.length - 1 || lignes[i + 1].id_groupe !== l.id_groupe;

          return (
            <TableRow key={l.id} className={cn(!dernierDuGroupe && "border-b-0")}>
              <TableCell className="whitespace-nowrap text-muted-foreground" />
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {l.c_orig ?? "—"}
              </TableCell>
              <TableCell className="truncate text-muted-foreground" title={l.l_orig ?? undefined}>
                {l.l_orig ?? "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{l.n_bv}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                {l.nb_regl}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums font-medium text-foreground">
                {formatMontant(String(l.montant_systac))}
              </TableCell>
              {premierDuGroupe && (
                <TableCell
                  rowSpan={taillesGroupes[l.id_groupe]}
                  className="whitespace-nowrap border align-middle text-right tabular-nums font-medium text-foreground"
                >
                  {formatMontant(String(l.montant_groupe))}
                </TableCell>
              )}
              {premierDuGroupe && (
                <TableCell
                  rowSpan={taillesGroupes[l.id_groupe]}
                  className="truncate border align-middle text-muted-foreground"
                  title={l.designation}
                >
                  {l.designation}
                </TableCell>
              )}
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {l.d_generation ?? "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
