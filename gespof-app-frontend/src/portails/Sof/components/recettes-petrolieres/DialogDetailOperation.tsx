import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { cn } from "@/shared/lib/utils";
import { extraireDetailEtax, peekDetailEtax } from "@/portails/Sof/api/recettes-petrolieres";
import type {
  ExtractionDetailEtax,
  LigneDetailEtax,
  LigneRecettePetroliereEtatParCompte,
} from "@/portails/Sof/types/recettes-petrolieres.interface";

interface DialogDetailOperationProps {
  ligne: LigneRecettePetroliereEtatParCompte | null;
  onClose: () => void;
}

function ChampLecture({
  label,
  valeur,
  className,
  mono,
}: {
  label: string;
  valeur: string | null | undefined;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div
        className={cn(
          "rounded-md border border-border/70 bg-white px-2.5 py-1.5 text-[13px] text-foreground",
          mono && "font-mono tabular-nums",
        )}
      >
        {valeur?.trim() ? valeur : "—"}
      </div>
    </div>
  );
}

export function DialogDetailOperation({
  ligne,
  onClose,
}: DialogDetailOperationProps) {
  const theme = getPortalMenu("sof").theme;
  const [chargement, setChargement] = useState(false);
  const [detail, setDetail] = useState<ExtractionDetailEtax | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    if (!ligne) {
      setDetail(null);
      setChargement(false);
      return;
    }

    const ref = ligne.ref_etax?.trim() ?? "";
    if (!ref) {
      setDetail({
        ref_etax: "",
        lignes: [],
        nombre: 0,
        total: "0.00",
        message: "Aucune référence E-TAX pour cette opération.",
      });
      setChargement(false);
      return;
    }

    const dejaEnCache = peekDetailEtax(ref);
    if (dejaEnCache) {
      setDetail(dejaEnCache);
      setChargement(false);
      return;
    }

    // Repli rare : référence absente du préchargement période.
    const gen = generation.current + 1;
    generation.current = gen;
    setChargement(true);
    setDetail({
      ref_etax: ref,
      lignes: [],
      nombre: 0,
      total: "0.00",
      message: null,
    });

    void extraireDetailEtax(ref)
      .then((resultat) => {
        if (generation.current !== gen) return;
        setDetail(resultat);
      })
      .catch((e: unknown) => {
        if (generation.current !== gen) return;
        setDetail({
          ref_etax: ref,
          lignes: [],
          nombre: 0,
          total: "0.00",
          message: e instanceof Error
            ? e.message
            : "Impossible de charger le détail E-TAX.",
        });
        toast.error(
          e instanceof Error
            ? e.message
            : "Impossible de charger le détail E-TAX.",
        );
      })
      .finally(() => {
        if (generation.current === gen) setChargement(false);
      });
  }, [ligne]);

  const lignesDetail: LigneDetailEtax[] = detail?.lignes ?? [];

  return (
    <Dialog
      open={ligne !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 shadow-[0_24px_60px_-24px_rgba(20,83,63,0.35)] ring-[#2a7f62]/15 sm:max-w-[min(96vw,720px)]"
      >
        {ligne ? (
          <>
            <DialogHeader
              className="border-b px-5 py-4"
              style={{
                background: `linear-gradient(180deg, ${theme.bgColor} 0%, #fff 100%)`,
                borderLeft: `4px solid ${theme.topColor}`,
              }}
            >
              <DialogTitle className="text-center text-[16px] font-semibold tracking-tight underline decoration-[#2a7f62]/40 underline-offset-4">
                Détail de l’opération
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ChampLecture label="Tiers" valeur={ligne.l_tiers} />
                <ChampLecture label="Objet" valeur={ligne.l_obj} />
              </div>
              <ChampLecture label="Libellé" valeur={ligne.l_com} mono />

              <section
                className="rounded-xl border px-3.5 py-3"
                style={{ borderColor: `${theme.topColor}35` }}
              >
                <h3
                  className="mb-3 text-center text-[13px] font-semibold underline underline-offset-4"
                  style={{ color: theme.topColor }}
                >
                  Informations comptables
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <ChampLecture label="PC" valeur={ligne.c_pc} mono />
                  <ChampLecture label="Date" valeur={ligne.d_cpta ?? ligne.d_oper} mono />
                  <ChampLecture label="Matricule" valeur={ligne.n_mattir} mono />
                  <ChampLecture label="Quittance" valeur={ligne.n_regl} mono />
                  <ChampLecture label="Compte" valeur={ligne.compte} mono />
                </div>
                <div className="mt-3">
                  <ChampLecture label="Libellé compte" valeur={ligne.libelle_compte} />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <p
                    className="pb-1.5 text-[14px] font-bold tracking-wide underline underline-offset-4"
                    style={{ color: "#1d4ed8" }}
                  >
                    E-TAX
                  </p>
                  <ChampLecture
                    label="Référence"
                    valeur={ligne.ref_etax}
                    className="min-w-[10rem] flex-1"
                    mono
                  />
                  <ChampLecture
                    label="Motif"
                    valeur={ligne.motif_etax}
                    className="min-w-[14rem] flex-[2]"
                  />
                </div>

                <div className="overflow-hidden rounded-xl border">
                  {chargement ? (
                    <div className="flex min-h-[140px] items-center justify-center gap-2 text-[13px] text-muted-foreground">
                      <Loader2
                        className="size-4 animate-spin"
                        style={{ color: theme.topColor }}
                      />
                      Chargement des lignes E-TAX…
                    </div>
                  ) : lignesDetail.length === 0 ? (
                    <div className="flex min-h-[120px] items-center justify-center px-4 text-center text-[13px] text-muted-foreground">
                      {detail?.message ?? "Aucune ligne de détail."}
                    </div>
                  ) : (
                    <Table className="border-separate border-spacing-0">
                      <TableHeader className="bg-muted">
                        <TableRow className="hover:bg-muted">
                          <TableHead className="w-28 bg-muted font-bold uppercase tracking-wider">
                            Nature
                          </TableHead>
                          <TableHead className="bg-muted font-bold uppercase tracking-wider">
                            Libellé nature
                          </TableHead>
                          <TableHead className="w-36 bg-muted text-right font-bold uppercase tracking-wider">
                            Montant
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lignesDetail.map((l, i) => (
                          <TableRow key={`${l.nature}-${i}`}>
                            <TableCell className="font-mono text-[13px] tabular-nums">
                              {l.nature ?? "—"}
                            </TableCell>
                            <TableCell className="font-medium">
                              {l.libelle_nature ?? "—"}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {formatMontant(l.montant)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/60 hover:bg-muted/60">
                          <TableCell colSpan={2} className="font-bold uppercase tracking-wider">
                            Total
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums">
                            {formatMontant(detail?.total)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </div>
              </section>
            </div>

            <DialogFooter className="border-t bg-muted/30 px-5 py-3 sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Fermer
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
