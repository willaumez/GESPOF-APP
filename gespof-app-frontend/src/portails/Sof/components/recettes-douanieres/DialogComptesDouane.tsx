import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { getPortalMenu } from "@/shared/config/menu";
import type { GroupeCompteDouane } from "@/portails/Sof/types/recettes-douanieres.interface";
import { teinteCompteDouane } from "@/portails/Sof/components/recettes-douanieres/teintes-compte-douane";

interface DialogComptesDouaneProps {
  ouvert: boolean;
  onClose: () => void;
  groupes: GroupeCompteDouane[];
  chargement: boolean;
}

export function DialogComptesDouane({
  ouvert,
  onClose,
  groupes,
  chargement,
}: DialogComptesDouaneProps) {
  const theme = getPortalMenu("sof").theme;
  const nombreComptes = groupes.reduce(
    (n, groupe) => n + groupe.comptes.length,
    0,
  );

  return (
    <Dialog
      open={ouvert}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 shadow-[0_24px_60px_-24px_rgba(20,83,63,0.35)] ring-[#2a7f62]/15 sm:max-w-2xl"
      >
        <DialogHeader
          className="border-b px-5 py-4"
          style={{
            background: `linear-gradient(180deg, ${theme.bgColor} 0%, #fff 100%)`,
            borderLeft: `4px solid ${theme.topColor}`,
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: theme.iconBg, color: theme.iconColor }}
            >
              <BookOpen size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[16px] font-semibold tracking-tight">
                Comptes douane
              </DialogTitle>
              <DialogDescription className="mt-1 text-[12.5px]">
                {chargement
                  ? "Chargement du référentiel d’extraction…"
                  : groupes.length === 0
                    ? "Référentiel d’extraction (hors lignes de total)."
                    : `Référentiel d’extraction · ${nombreComptes} comptes · ${groupes.length} types`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {chargement ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-foreground/50">
            <Loader2 size={16} className="animate-spin" />
            Chargement des comptes…
          </div>
        ) : groupes.length === 0 ? (
          <p className="mx-5 my-6 rounded-xl border border-dashed px-4 py-10 text-center text-[13px] text-foreground/50">
            Aucun compte douane. Chargez le référentiel
            (`sof:referentiel:charger`).
          </p>
        ) : (
          <Table
            className="border-separate border-spacing-0"
            containerClassName="max-h-[min(78vh,780px)] overflow-y-auto"
          >
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 w-12 border-b bg-[#14533f] px-0 text-center text-[11px] font-semibold text-white">
                  Type
                </TableHead>
                <TableHead className="h-9 w-[128px] border-b bg-[#14533f] px-3 text-[11px] font-semibold text-white">
                  Compte
                </TableHead>
                <TableHead className="h-9 border-b bg-[#14533f] px-3 text-[11px] font-semibold text-white">
                  Libellé
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupes.map((groupe) => {
                const teinte = teinteCompteDouane(groupe.type);
                return groupe.comptes.map((compte, index) => (
                  <TableRow
                    key={`${groupe.type}-${compte.compte}`}
                    className="border-0 hover:bg-transparent"
                  >
                    {index === 0 && (
                      <TableCell
                        rowSpan={groupe.comptes.length}
                        className="w-12 max-w-12 border-b px-0 py-1.5 text-center align-middle"
                        style={{ background: teinte.bande }}
                      >
                        <span className="inline-block text-[10px] font-semibold tracking-wide text-white [writing-mode:vertical-rl] rotate-180">
                          {groupe.type_libelle}
                        </span>
                      </TableCell>
                    )}
                    <TableCell
                      className="h-8 border-b px-3 py-1.5 font-mono text-[12.5px] font-semibold tabular-nums"
                      style={{ background: teinte.fond, color: teinte.texte }}
                    >
                      {compte.compte}
                    </TableCell>
                    <TableCell
                      className="h-8 border-b px-3 py-1.5 text-[13px] text-foreground/85"
                      style={{ background: teinte.fond }}
                    >
                      {compte.libelle_compte}
                    </TableCell>
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>
        )}

        <DialogFooter className="mx-0 mb-0 border-t bg-[#f0f7f4] sm:justify-between">
          <p className="hidden text-[12px] text-foreground/50 sm:block">
            Hors lignes de total du modèle automatisé.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-[#2a7f62]/25 bg-white hover:bg-[#e8f5ef] hover:text-[#14533f]"
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
