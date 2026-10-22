import { useEffect, useState } from "react";
import { Check, FileText, GitCompareArrows, Inbox, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import type { Portail } from "@/shared/hooks/auth-context";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { detailFicheBleue } from "@/portails/Sp/api/fiches-bleues";
import { LigneGroupeType } from "@/portails/Sp/components/fiche-bleue/LigneGroupeType";
import { estConteneurTypeSection, formaterMontantFcfa, styleIndentSection } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { TableauFicheBleueExcel } from "@/portails/Sp/components/fiche-bleue/TableauFicheBleueExcel";
import {
  BoutonPleinEcran, OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import type {
  FicheBleueDetail, FicheBleueResume, SectionFicheBleue,
} from "@/portails/Sp/types/fiche-bleue.interface";
import type { TypeSectionBibliotheque } from "@/portails/Sp/types/bibliotheque.interface";
import {
  identifierCorrespondances,
  type LigneRapprochement,
} from "./rapprochement-sections";

interface LigneAplat {
  id: number;
  nom: string;
  niveau: number;
  montantProgramme: string;
  estRacine: boolean;
  estFeuille: boolean;
  type: TypeSectionBibliotheque;
}

function aplatirSections(sections: SectionFicheBleue[], niveau = 0): LigneAplat[] {
  const out: LigneAplat[] = [];
  for (const s of sections) {
    out.push({
      id: s.id,
      nom: s.nom,
      niveau,
      montantProgramme: s.montant_programme,
      estRacine: niveau === 0,
      estFeuille: s.sous_sections.length === 0,
      type: s.type,
    });
    if (s.sous_sections.length > 0) {
      out.push(...aplatirSections(s.sous_sections, niveau + 1));
    }
  }
  return out;
}

interface PreviewFicheBleueDialogProps {
  ficheId: number | null;
  detailCache?: FicheBleueDetail | null;
  onClose: () => void;
  /** Mode sélection : liste à gauche + bouton en haut à droite. */
  fichesDisponibles?: FicheBleueResume[];
  ficheSelectionneeId?: number | null;
  onSelectionner?: (ficheId: number) => void;
  selectionEnCours?: boolean;
  /** Charge le détail (défaut : API SP). Utile côté SR. */
  chargerDetail?: (id: number) => Promise<{ fiche: FicheBleueDetail }>;
  portail?: Portail;
  /** Lignes de la fiche de dépôt à rapprocher (coche les postes correspondants). */
  lignesRapprochement?: LigneRapprochement[];
}

/**
 * Aperçu lecture seule d'une Fiche Bleue.
 * En mode sélection, la liste des fiches est affichée à gauche.
 */
export function PreviewFicheBleueDialog({
  ficheId,
  detailCache = null,
  onClose,
  fichesDisponibles,
  ficheSelectionneeId = null,
  onSelectionner,
  selectionEnCours = false,
  chargerDetail = detailFicheBleue,
  portail = "sp",
  lignesRapprochement,
}: PreviewFicheBleueDialogProps) {
  const theme = getPortalMenu(portail).theme;
  const ouvert = ficheId !== null;
  const modeSelection = (fichesDisponibles?.length ?? 0) > 0 && onSelectionner != null;
  const modeRapprochement = lignesRapprochement != null;

  const [ficheApercueId, setFicheApercueId] = useState<number | null>(ficheId);
  const [chargement, setChargement] = useState(false);
  const [fiche, setFiche] = useState<FicheBleueDetail | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [idsCoches, setIdsCoches] = useState<Set<number>>(new Set());
  const [rapprochementFait, setRapprochementFait] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);

  useEffect(() => {
    setFicheApercueId(ficheId);
    setIdsCoches(new Set());
    setRapprochementFait(false);
    setPleinEcran(false);
  }, [ficheId]);

  useEffect(() => {
    if (ficheApercueId === null) {
      setFiche(null);
      setIntrouvable(false);
      return;
    }
    if (ficheApercueId <= 0) {
      setFiche(null);
      setIntrouvable(true);
      setChargement(false);
      return;
    }
    if (detailCache?.id === ficheApercueId) {
      setFiche(detailCache);
      setIntrouvable(false);
      return;
    }

    let annule = false;
    setChargement(true);
    setFiche(null);
    setIntrouvable(false);
    void chargerDetail(ficheApercueId)
      .then(({ fiche: detail }) => {
        if (!annule) setFiche(detail);
      })
      .catch(() => {
        if (!annule) {
          setIntrouvable(true);
        }
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });

    return () => {
      annule = true;
    };
  }, [ficheApercueId, detailCache, chargerDetail]);

  const lignes = fiche ? aplatirSections(fiche.sections) : [];
  let ordreRacine = 0;
  const dejaCetteFiche = ficheApercueId !== null && ficheApercueId === ficheSelectionneeId;
  const nbColonnes = modeRapprochement ? 4 : 3;
  const idPremiereRecette = lignes.find((l) => l.estRacine && l.type === "recette")?.id;
  const idPremiereDepense = lignes.find((l) => l.estRacine && l.type === "depense")?.id;

  const basculerCoche = (id: number, coche: boolean) => {
    setIdsCoches((actuel) => {
      const suivant = new Set(actuel);
      if (coche) suivant.add(id);
      else suivant.delete(id);
      return suivant;
    });
  };

  const lancerRapprochement = () => {
    if (!lignesRapprochement || lignes.length === 0) return;
    const ids = identifierCorrespondances(lignes, lignesRapprochement);
    setIdsCoches(ids);
    setRapprochementFait(true);
    if (ids.size === 0) {
      toast.info("Aucun poste de la Fiche Bleue ne correspond à la fiche de dépôt.");
      return;
    }
    toast.success(
      ids.size === 1
        ? "1 poste correspondant a été coché."
        : `${ids.size} postes correspondants ont été cochés.`,
    );
  };

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
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          modeRapprochement && pleinEcran
            ? "top-0 left-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none sm:max-w-none"
            : cn(
                "h-[min(92vh,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)]",
                modeSelection
                  ? "w-[min(96vw,80rem)] sm:max-w-[80rem]"
                  : "w-[min(96vw,72rem)] sm:max-w-[72rem]",
              ),
        )}
        onEscapeKeyDown={(e) => {
          if (pleinEcran && !modeRapprochement) {
            e.preventDefault();
            setPleinEcran(false);
          }
        }}
      >
        <div className="flex min-h-0 flex-1">
          {modeSelection ? (
            <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30 sm:w-64">
              <p className="shrink-0 border-b px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Fiches disponibles
              </p>
              <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                {fichesDisponibles!.map((item) => {
                  const apercue = item.id === ficheApercueId;
                  const liee = item.id === ficheSelectionneeId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setFicheApercueId(item.id)}
                        className={cn(
                          "mb-1 flex w-full flex-col rounded-lg border px-2.5 py-2 text-left transition-colors",
                          apercue ? "border-2 shadow-sm" : "border-transparent hover:bg-background/80",
                        )}
                        style={apercue ? { borderColor: theme.topColor } : undefined}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[12.5px] font-semibold tabular-nums">
                            {item.reference}
                          </span>
                          {liee ? (
                            <Check className="size-3 shrink-0" style={{ color: theme.ctaColor }} />
                          ) : null}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {item.section_solde ?? "Sans solde"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 pr-12 text-left">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <DialogTitle>
                    {portail === "sr"
                      ? `Aperçu — Dépenses${fiche?.reference ? ` · ${fiche.reference}` : ""}`
                      : `Aperçu — ${fiche?.reference ?? "Fiche Bleue"}`}
                  </DialogTitle>
                  <DialogDescription asChild>
                    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
                      {fiche ? (
                        <>
                          <Badge variant="outline" className="capitalize text-[11px]">
                            {portail === "sr" ? "Dépenses" : fiche.statut.replace("_", " ")}
                          </Badge>
                          {portail === "sr" ? (
                            <span>
                              Montant programmé{" "}
                              <span className="font-semibold tabular-nums text-foreground">
                                {formaterMontantFcfa(fiche.montant_total_programme)}
                              </span>
                            </span>
                          ) : (
                            <span>{fiche.section_solde ?? "Sans solde"}</span>
                          )}
                          <span aria-hidden>·</span>
                          <span>{fiche.createur}</span>
                          {rapprochementFait ? (
                            <Badge variant="secondary" className="font-normal text-[11px]">
                              {idsCoches.size} correspondance{idsCoches.size > 1 ? "s" : ""}
                            </Badge>
                          ) : null}
                        </>
                      ) : introuvable ? (
                        <span>Fiche introuvable.</span>
                      ) : (
                        <span>Chargement de la composition…</span>
                      )}
                    </div>
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <BoutonPleinEcran
                    actif={pleinEcran}
                    onToggle={() => setPleinEcran((v) => !v)}
                    libelleEnter="Agrandir en plein écran"
                  />
                  {modeSelection && ficheApercueId !== null ? (
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 font-semibold text-white"
                      style={{ background: theme.ctaColor }}
                      disabled={selectionEnCours || dejaCetteFiche || introuvable || !fiche}
                      onClick={() => onSelectionner?.(ficheApercueId)}
                    >
                      {dejaCetteFiche ? "Fiche déjà sélectionnée" : "Sélectionner cette fiche"}
                    </Button>
                  ) : null}
                </div>
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
                  <FileText className="size-6 text-muted-foreground" aria-hidden />
                  <p className="text-[13.5px] text-muted-foreground">
                    {portail === "sr"
                      ? "Aucune Fiche Bleue liée à cette fiche de dépôt."
                      : "Fiche Bleue introuvable."}
                  </p>
                </div>
              ) : (
                <Table containerClassName="rounded-xl border">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      {modeRapprochement ? (
                        <TableHead className="w-10">
                          <span className="sr-only">Correspondance</span>
                        </TableHead>
                      ) : null}
                      <TableHead className="w-14">N°</TableHead>
                      <TableHead>{portail === "sr" ? "DÉPENSE" : "BANCAIRE"}</TableHead>
                      <TableHead className="w-44 text-right">PROGRAMME</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lignes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={nbColonnes} className="py-10 text-center text-muted-foreground">
                          <span className="inline-flex flex-col items-center gap-1.5">
                            <Inbox className="size-5" aria-hidden />
                            <span className="text-[13px]">
                              {portail === "sr"
                                ? "Aucune dépense programmée sur cette fiche."
                                : "Aucune section sur cette fiche."}
                            </span>
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      lignes.flatMap((ligne) => {
                        if (ligne.estRacine) ordreRacine += 1;
                        const cochee = idsCoches.has(ligne.id);
                        const afficherGroupe =
                          ligne.estRacine
                          && (ligne.type === "recette" || ligne.type === "depense")
                          && ligne.id === (ligne.type === "recette"
                            ? idPremiereRecette
                            : idPremiereDepense)
                          && !estConteneurTypeSection(ligne.nom, ligne.type, true);
                        const row = (
                          <TableRow
                            key={ligne.id}
                            className={cn(cochee && "bg-primary/5")}
                          >
                            {modeRapprochement ? (
                              <TableCell className="w-10">
                                <Checkbox
                                  checked={cochee}
                                  onCheckedChange={(etat) =>
                                    basculerCoche(ligne.id, etat === true)
                                  }
                                  aria-label={`Correspondance : ${ligne.nom}`}
                                />
                              </TableCell>
                            ) : null}
                            <TableCell className="tabular-nums text-muted-foreground">
                              {ligne.estRacine ? ordreRacine : ""}
                            </TableCell>
                            <TableCell>
                              <div
                                className={cn(
                                  "min-w-0 font-medium",
                                  ligne.niveau > 0 && "border-l-2 border-muted-foreground/25 text-muted-foreground",
                                  cochee && "text-foreground",
                                )}
                                style={styleIndentSection(ligne.niveau)}
                              >
                                {ligne.nom}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {formaterMontantFcfa(ligne.montantProgramme)}
                            </TableCell>
                          </TableRow>
                        );
                        return afficherGroupe
                          ? [
                              <LigneGroupeType
                                key={`groupe-${ligne.type}`}
                                type={ligne.type}
                                colSpan={nbColonnes}
                              />,
                              row,
                            ]
                          : [row];
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </div>

            <DialogFooter
              className={cn(
                "shrink-0 border-t px-6 py-3",
                modeRapprochement && "sm:justify-between",
              )}
            >
              {modeRapprochement ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={!fiche || lignes.length === 0}
                  onClick={lancerRapprochement}
                >
                  <GitCompareArrows className="size-4" />
                  Rapprochement
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={onClose}>
                Fermer
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>

      {!modeRapprochement ? (
        <OverlayPleinEcran
          ouvert={pleinEcran && ouvert}
          titre={portail === "sr" ? "Dépenses" : "Fiche Bleue"}
          sousTitre={fiche?.reference}
          onClose={() => setPleinEcran(false)}
          ariaLabel={
            portail === "sr"
              ? "Dépenses en plein écran"
              : "Fiche Bleue en plein écran"
          }
        >
          <TableauFicheBleueExcel fiche={fiche} chargement={chargement} />
        </OverlayPleinEcran>
      ) : null}
      </TooltipProvider>
    </Dialog>
  );
}
