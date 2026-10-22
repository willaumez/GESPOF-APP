import { ListOrdered } from "lucide-react";
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
import { formatMontant } from "@/shared/lib/format";
import type { GroupeLignesCompte } from "@/portails/Sof/types/recettes-douanieres.interface";
import { teinteCompteDouane } from "@/portails/Sof/components/recettes-douanieres/teintes-compte-douane";

function formaterMontant(valeur: string | null | number): string {
  return formatMontant(valeur);
}

function sommeChamp(
  lignes: GroupeLignesCompte["lignes"],
  champ: "m_oper" | "m_regl",
): number {
  return lignes.reduce((total, ligne) => {
    const n = Number(ligne[champ] ?? 0);
    return total + (Number.isNaN(n) ? 0 : n);
  }, 0);
}

interface DialogLignesCompteProps {
  groupe: GroupeLignesCompte | null;
  onClose: () => void;
}

export function DialogLignesCompte({
  groupe,
  onClose,
}: DialogLignesCompteProps) {
  const theme = getPortalMenu("sof").theme;
  const teinte = groupe ? teinteCompteDouane(groupe.type) : null;
  const montantRusid = groupe?.source === "rusid";
  const totalOper = groupe ? sommeChamp(groupe.lignes, "m_oper") : 0;
  const totalRegl = groupe
    ? montantRusid
      ? totalOper
      : sommeChamp(groupe.lignes, "m_regl")
    : 0;
  const suffixeMontant = montantRusid ? " M" : "";

  return (
    <Dialog
      open={groupe !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 shadow-[0_24px_60px_-24px_rgba(20,83,63,0.35)] ring-[#2a7f62]/15 sm:max-w-[min(96vw,1080px)]"
      >
        {groupe && teinte ? (
          <>
            <DialogHeader
              className="border-b px-5 py-4"
              style={{
                background: `linear-gradient(180deg, ${theme.bgColor} 0%, #fff 100%)`,
                borderLeft: `4px solid ${teinte.bande}`,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: teinte.fond, color: teinte.texte }}
                >
                  <ListOrdered size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-[16px] font-semibold tracking-tight">
                    <span className="font-mono">{groupe.compte}</span>
                    <span className="mx-2 font-normal text-foreground/35">
                      —
                    </span>
                    {groupe.libelle_compte}
                  </DialogTitle>
                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <DialogDescription className="text-[12.5px]">
                      {groupe.type_libelle} · {groupe.lignes.length} ligne(s)
                    </DialogDescription>
                    <div
                      className="flex shrink-0 flex-wrap items-baseline gap-x-5 text-[12.5px]"
                      style={{ color: teinte.texte }}
                    >
                      <p>
                        <span className="text-foreground/50">Montant op.</span>
                        <span className="ml-2 font-mono font-semibold tabular-nums">
                          {formaterMontant(totalOper)}
                          {suffixeMontant}
                        </span>
                      </p>
                      <p>
                        <span className="text-foreground/50">Montant règl.</span>
                        <span className="ml-2 font-mono font-semibold tabular-nums">
                          {formaterMontant(totalRegl)}
                          {suffixeMontant}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </DialogHeader>

            {groupe.lignes.length === 0 ? (
              <p className="mx-5 my-6 rounded-xl border border-dashed px-4 py-10 text-center text-[13px] text-foreground/50">
                {groupe.erreur
                  ? groupe.erreur
                  : "Aucune ligne pour ce compte sur la période extraite."}
              </p>
            ) : (
              <Table containerClassName="max-h-[min(68vh,640px)] overflow-auto">
                <TableHeader>
                  <TableRow className="sticky top-0 z-10 hover:bg-transparent">
                    {(
                      [
                        "Date / mois",
                        "PCA",
                        "Libellé",
                        "N° op.",
                        "N° règl.",
                        "Origine",
                        "Montant op.",
                        "Montant règl.",
                      ] as const
                    ).map((colonne) => (
                      <TableHead
                        key={colonne}
                        className="h-9 border-b px-3 text-[11px] font-semibold text-white"
                        style={{
                          background: teinte.bande,
                          textAlign:
                            colonne.startsWith("Montant") ? "right" : undefined,
                        }}
                      >
                        {colonne}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupe.lignes.map((ligne, index) => (
                    <TableRow
                      key={`${ligne.n_regl ?? ligne.c_pca ?? "l"}-${index}`}
                    >
                      <TableCell className="whitespace-nowrap">
                        {ligne.periode ?? "—"}
                      </TableCell>
                      <TableCell>{ligne.c_pca ?? "—"}</TableCell>
                      <TableCell
                        className="max-w-[240px] truncate"
                        title={ligne.libelle ?? undefined}
                      >
                        {ligne.libelle ?? "—"}
                      </TableCell>
                      <TableCell>{ligne.n_op ?? "—"}</TableCell>
                      <TableCell>{ligne.n_regl ?? "—"}</TableCell>
                      <TableCell>{ligne.origine ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formaterMontant(ligne.m_oper)}
                        {montantRusid ? " M" : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {montantRusid
                          ? formaterMontant(ligne.m_oper) + " M"
                          : formaterMontant(ligne.m_regl)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <DialogFooter
              className="mx-0 mb-0 border-t sm:justify-between"
              style={{ background: teinte.fond }}
            >
              <p className="text-[12px] text-foreground/55">
                {montantRusid
                  ? "Montants RUSID exprimés en millions."
                  : `${groupe.lignes.length} opération(s) du compte ${groupe.compte}.`}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-black/10 bg-white"
                style={{ color: teinte.texte }}
              >
                Fermer
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
