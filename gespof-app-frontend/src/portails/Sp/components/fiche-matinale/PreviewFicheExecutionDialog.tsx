import { useEffect, useState } from "react";
import { Inbox, Loader2, Sunrise } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
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
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { detailFicheExecution } from "@/portails/Sp/api/fiches-execution";
import { formaterMontantFcfa, styleIndentSection } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { TableauFicheExecutionExcel } from "@/portails/Sp/components/fiche-execution/TableauFicheExecutionExcel";
import {
  BoutonPleinEcran, OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import type {
  FicheExecutionDetail,
  SectionFicheExecution,
} from "@/portails/Sp/types/fiche-execution.interface";
import type { TypeSectionBibliotheque } from "@/portails/Sp/types/bibliotheque.interface";

function estZero(valeur: string): boolean {
  const n = Number(valeur.replace(",", "."));
  return Number.isFinite(n) && n === 0;
}

function estNegatif(valeur: string): boolean {
  const n = Number(valeur.replace(",", "."));
  return Number.isFinite(n) && n < 0;
}

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

function fondLigne(
  type: TypeSectionBibliotheque,
  nonProgramme: boolean,
): string | undefined {
  if (nonProgramme) {
    if (type === "recette") return "bg-amber-50";
    if (type === "depense") return "bg-orange-50";
  }
  if (type === "recette") return "bg-emerald-50/80";
  if (type === "depense") return "bg-rose-50/80";
  return undefined;
}

function CelluleNomSection({ ligne }: { ligne: LigneAplat }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 font-medium",
        ligne.niveau > 0 &&
          "border-l-2 border-muted-foreground/25 text-muted-foreground",
        !ligne.estFeuille && "font-semibold",
      )}
      style={styleIndentSection(ligne.niveau)}
    >
      <span className="truncate">{ligne.nom}</span>
      {ligne.estRacine && ligne.type === "solde" ? (
        <Badge className="shrink-0 border-transparent bg-[#c9960a]/15 text-[10px] font-semibold uppercase tracking-wide text-[#8a6508]">
          Solde d&apos;ouverture
        </Badge>
      ) : null}
      {ligne.nonProgramme ? (
        <Badge className="shrink-0 border-transparent bg-amber-200/90 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
          Non programmé
        </Badge>
      ) : null}
    </div>
  );
}

interface PreviewFicheExecutionDialogProps {
  ficheId: number | null;
  onClose: () => void;
}

/**
 * Aperçu lecture seule d'une Fiche d'exécution (Archives).
 */
export function PreviewFicheExecutionDialog({
  ficheId,
  onClose,
}: PreviewFicheExecutionDialogProps) {
  const ouvert = ficheId !== null;
  const [chargement, setChargement] = useState(false);
  const [fiche, setFiche] = useState<FicheExecutionDetail | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);

  useEffect(() => {
    if (ficheId === null) {
      setFiche(null);
      setIntrouvable(false);
      setPleinEcran(false);
      return;
    }
    let annule = false;
    setChargement(true);
    setFiche(null);
    setIntrouvable(false);
    void detailFicheExecution(ficheId)
      .then(({ fiche: detail }) => {
        if (!annule) setFiche(detail);
      })
      .catch(() => {
        if (!annule) setIntrouvable(true);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [ficheId]);

  const lignes = fiche ? aplatirSections(fiche.sections) : [];
  const lignesSolde = lignes.filter((l) => l.type === "solde");
  const lignesMouvements = lignes.filter((l) => l.type !== "solde");
  let ordreSolde = 0;
  let ordreMouvement = 0;

  return (
    <Dialog
      open={ouvert}
      onOpenChange={(o) => {
        if (!o) {
          setPleinEcran(false);
          onClose();
        }
      }}
    >
      <TooltipProvider>
      <DialogContent
        className="flex h-[min(92vh,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] w-[min(96vw,72rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[72rem]"
        onEscapeKeyDown={(e) => {
          if (pleinEcran) {
            e.preventDefault();
            setPleinEcran(false);
          }
        }}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 pr-12 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <DialogTitle>
                Aperçu — {fiche?.reference ?? "Fiche d'exécution"}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
                  {fiche ? (
                    <>
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {fiche.statut.replace("_", " ")}
                      </Badge>
                      <span>{fiche.section_solde ?? "Sans solde"}</span>
                      <span aria-hidden>·</span>
                      <span>{fiche.createur}</span>
                      <span aria-hidden>·</span>
                      <span>
                        Réalisé{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {formaterMontantFcfa(fiche.montant_total_realise)}
                        </span>
                      </span>
                    </>
                  ) : introuvable ? (
                    <span>Fiche introuvable.</span>
                  ) : (
                    <span>Chargement de la composition…</span>
                  )}
                </div>
              </DialogDescription>
            </div>
            <BoutonPleinEcran
              actif={pleinEcran}
              onToggle={() => setPleinEcran((v) => !v)}
              libelleEnter="Afficher la Fiche d'exécution en plein écran"
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {chargement ? (
            <div className="flex min-h-[160px] items-center justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : introuvable || !fiche ? (
            <div
              className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center"
              role="status"
            >
              <Sunrise className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-[13.5px] text-muted-foreground">
                Fiche d&apos;exécution introuvable.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border-2 border-green-600/55">
              {lignesSolde.length > 0 ? (
                <Table containerClassName="overflow-visible">
                  <TableBody className="[&_tr:last-child]:border-b">
                    {lignesSolde.map((ligne) => {
                      if (ligne.estRacine) ordreSolde += 1;
                      return (
                        <TableRow
                          key={ligne.id}
                          className={cn(
                            "hover:bg-transparent",
                            ligne.estRacine ? "bg-[#fdf6e3]" : "bg-sky-50/40",
                          )}
                        >
                          <TableCell className="w-12 tabular-nums text-muted-foreground">
                            {ligne.estRacine ? ordreSolde : ""}
                          </TableCell>
                          <TableCell>
                            <CelluleNomSection ligne={ligne} />
                          </TableCell>
                          <TableCell
                            className={cn(
                              "w-44 text-right tabular-nums",
                              ligne.estRacine
                                ? "text-[15px] font-bold tracking-tight text-[#8a6508]"
                                : "font-semibold text-sky-950",
                            )}
                          >
                            {formaterMontantFcfa(ligne.programme)}
                          </TableCell>
                          <TableCell className="w-56 bg-background" aria-hidden />
                          <TableCell className="w-44 bg-background" aria-hidden />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : null}

              <Table
                containerClassName={cn(
                  "overflow-visible",
                  lignesSolde.length > 0 && "border-t",
                )}
              >
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-12">N°</TableHead>
                    <TableHead>BANCAIRE</TableHead>
                    <TableHead className="w-44 text-right">
                      PROGRAMME (FCFA)
                    </TableHead>
                    <TableHead className="w-56 text-right">
                      RÉALISÉ (FCFA)
                    </TableHead>
                    <TableHead className="w-44 text-right">
                      ÉCART (FCFA)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignesMouvements.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-muted-foreground"
                      >
                        <span className="inline-flex flex-col items-center gap-1.5">
                          <Inbox className="size-5" aria-hidden />
                          <span className="text-[13px]">
                            Aucune recette ni dépense.
                          </span>
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    lignesMouvements.map((ligne) => {
                      if (ligne.estRacine) ordreMouvement += 1;
                      const afficherEcart = !estZero(ligne.realise);
                      return (
                        <TableRow
                          key={ligne.id}
                          className={cn(
                            fondLigne(ligne.type, ligne.nonProgramme),
                            ligne.nonProgramme &&
                              ligne.type === "depense" &&
                              "border-l-4 border-l-orange-500",
                            ligne.nonProgramme &&
                              ligne.type === "recette" &&
                              "border-l-4 border-l-amber-500",
                          )}
                        >
                          <TableCell className="tabular-nums text-muted-foreground">
                            {ligne.estRacine ? ordreMouvement : ""}
                          </TableCell>
                          <TableCell>
                            <CelluleNomSection ligne={ligne} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formaterMontantFcfa(ligne.programme)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formaterMontantFcfa(ligne.realise)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right tabular-nums",
                              afficherEcart && estNegatif(ligne.ecart)
                                ? "font-medium text-red-600"
                                : "text-muted-foreground",
                            )}
                          >
                            {afficherEcart ? formaterMontantFcfa(ligne.ecart) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>

      <OverlayPleinEcran
        ouvert={pleinEcran && ouvert}
        titre="Fiche d'exécution"
        sousTitre={fiche?.reference}
        onClose={() => setPleinEcran(false)}
        ariaLabel="Fiche d'exécution en plein écran"
      >
        <TableauFicheExecutionExcel fiche={fiche} chargement={chargement} />
      </OverlayPleinEcran>
      </TooltipProvider>
    </Dialog>
  );
}
