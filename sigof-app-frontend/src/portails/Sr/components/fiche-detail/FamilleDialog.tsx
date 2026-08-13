import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import { formatMontant } from "@/shared/lib/format";
import type { FicheDepotDetail, LigneMouvement, LigneSystacDetail } from "@/portails/Sr/types";
import { SYSTAC_COL_WIDTHS, TYPE_CFG, type SectionMouvement, type TypeMouvement } from "./constants";
import { TableSystac } from "./TableSystac";
import { TableMouvementsFamille } from "./TableMouvementsFamille";

interface FamilleDialogProps {
  familleDialog: TypeMouvement | null;
  onFermer: () => void;
  sectionDialog: SectionMouvement | undefined;
  lignesSystacDialog: LigneSystacDetail[];
  detail: FicheDepotDetail | null;
  totauxSystacCorrespondent: boolean;
  peutGererLignes: boolean;
  dialogEnfantOuvert: boolean;
  onAjouterLigne: () => void;
  onModifierLigne: (ligne: LigneMouvement) => void;
  onSupprimerLigne: (ligne: LigneMouvement) => void;
}

export function FamilleDialog({
  familleDialog,
  onFermer,
  sectionDialog,
  lignesSystacDialog,
  detail,
  totauxSystacCorrespondent,
  peutGererLignes,
  dialogEnfantOuvert,
  onAjouterLigne,
  onModifierLigne,
  onSupprimerLigne,
}: FamilleDialogProps) {
  const cfgDialog = familleDialog ? TYPE_CFG[familleDialog] : null;
  const estSystac = familleDialog === "systac";
  const lignesDialog = estSystac ? lignesSystacDialog : (sectionDialog?.lignes ?? []);

  return (
    <Dialog
      open={familleDialog !== null}
      onOpenChange={(open) => {
        if (open || dialogEnfantOuvert) return;
        onFermer();
      }}
    >
      <DialogContent
        className={cn(
          "flex max-h-[85vh] w-full max-w-[95vw] flex-col overflow-hidden",
          estSystac ? "sm:max-w-[92rem]" : "sm:max-w-6xl",
        )}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>Règlements {cfgDialog?.label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            {lignesDialog.length} ligne{lignesDialog.length > 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        {peutGererLignes && (familleDialog === "numeraire" || familleDialog === "sigma") && (
          <div className="flex shrink-0 justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 border-[#1e4d8c] text-[#1e4d8c] hover:bg-[#1e4d8c]/10"
              onClick={onAjouterLigne}
            >
              <Plus className="size-4" />
              Ajouter une ligne
            </Button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
          {estSystac ? (
            <TableSystac lignes={lignesSystacDialog} />
          ) : (
            <TableMouvementsFamille
              lignes={sectionDialog?.lignes ?? []}
              peutGererLignes={peutGererLignes}
              onModifierLigne={onModifierLigne}
              onSupprimerLigne={onSupprimerLigne}
            />
          )}
        </div>

        <DialogFooter className={cn("shrink-0", estSystac && "relative bg-muted")}>
          {estSystac ? (
            <>
              <div className="overflow-y-auto [scrollbar-gutter:stable]">
                <table className="w-full table-fixed">
                  <colgroup>
                    {SYSTAC_COL_WIDTHS.map((largeur, i) => (
                      <col key={i} style={{ width: largeur }} />
                    ))}
                  </colgroup>
                  <tbody>
                    <tr>
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td
                        className={cn(
                          "text-right align-middle pr-2",
                          totauxSystacCorrespondent ? "bg-[#2a7f62]/10" : "bg-destructive/10",
                        )}
                      >
                        <p
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            totauxSystacCorrespondent ? "text-[#2a7f62]" : "text-destructive",
                          )}
                        >
                          {formatMontant(detail?.total_systac ?? "0")}
                        </p>
                      </td>
                      <td
                        className={cn(
                          "text-right align-middle pr-2",
                          totauxSystacCorrespondent ? "bg-[#2a7f62]/10" : "bg-destructive/10",
                        )}
                      >
                        <p
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            totauxSystacCorrespondent ? "text-[#2a7f62]" : "text-destructive",
                          )}
                        >
                          {formatMontant(detail?.total_groupe ?? "0")}
                        </p>
                      </td>
                      <td />
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
              <Button
                variant="outline"
                onClick={onFermer}
                className="absolute top-1/2 right-4 -translate-y-1/2"
              >
                Fermer
              </Button>
            </>
          ) : (
            <>
              <div className="mr-auto text-sm font-semibold tabular-nums text-foreground">
                Total : {formatMontant(sectionDialog?.total ?? "0")} FCFA
              </div>
              <Button variant="outline" onClick={onFermer}>
                Fermer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
