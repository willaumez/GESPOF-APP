import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive, Download, Eye, FileText, Loader2, MoreVertical, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import { ETAT_JOURNEE } from "@/portails/Sp/components/archives/archives-affichage";
import {
  formaterMontantFcfa, libelleDateFr,
} from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { PreviewFicheBleueDialog } from "@/portails/Sp/components/fiche-matinale/PreviewFicheBleueDialog";
import { PreviewFicheDepotDialog } from "@/portails/Sp/components/fiche-matinale/PreviewFicheDepotDialog";
import { PreviewFicheExecutionDialog } from "@/portails/Sp/components/fiche-matinale/PreviewFicheExecutionDialog";
import { listerFichesDepotDeJournee } from "@/portails/Sp/api/fiches-depot";
import {
  imprimerFicheBleueSp,
  imprimerFicheExecutionSp,
  imprimerFichesDepotSp,
  telechargerFicheBleueSp,
  telechargerFicheExecutionSp,
  telechargerFichesDepotSp,
} from "@/portails/Sp/lib/documents-journee";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import type { FicheDepotResumeSp } from "@/portails/Sp/types/fiche-depot.interface";

/** Journée choisie dans la TopBar (journée du jour par défaut) et ses fiches liées. */
export function VueJourneeDuJour() {
  const theme = getPortalMenu("sp").theme;
  const navigate = useNavigate();
  const {
    journee, chargement, date, dateIso,
  } = useJourneeSelectionnee();
  const dateLibelle = libelleDateFr(date);

  const [depotsCharges, setDepotsCharges] = useState<{
    reference: string;
    fiches: FicheDepotResumeSp[];
  } | null>(null);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [apercuBleueId, setApercuBleueId] = useState<number | null>(null);
  const [apercuDepotRef, setApercuDepotRef] = useState<string | null>(null);
  const [apercuExecutionId, setApercuExecutionId] = useState<number | null>(null);

  const referenceJournee = journee?.reference ?? null;
  const depots =
    depotsCharges && depotsCharges.reference === referenceJournee
      ? depotsCharges.fiches
      : [];

  useEffect(() => {
    if (!referenceJournee) return;
    let annule = false;
    listerFichesDepotDeJournee(referenceJournee)
      .then((page) => {
        if (!annule) setDepotsCharges({ reference: referenceJournee, fiches: page.fiches ?? [] });
      })
      .catch(() => {
        if (!annule) setDepotsCharges({ reference: referenceJournee, fiches: [] });
      });
    return () => {
      annule = true;
    };
  }, [referenceJournee]);

  async function executerAction(
    cle: string,
    action: () => Promise<void>,
    succes: string,
  ) {
    if (actionEnCours) return;
    setActionEnCours(cle);
    try {
      await action();
      toast.success(succes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setActionEnCours(null);
    }
  }

  if (chargement) {
    return (
      <div className="flex min-h-[220px] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!journee) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-4 text-center">
        <div
          className="flex size-12 items-center justify-center rounded-2xl"
          style={{ background: theme.iconBg, color: theme.iconColor }}
        >
          <Archive className="size-6" />
        </div>
        <div className="max-w-md space-y-1.5">
          <p className="text-[15px] font-semibold text-foreground">
            Aucune journée de trésorerie pour le {dateLibelle}
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Ouvrez une journée depuis la fiche matinale pour l&apos;archiver ici
            avec ses fiches liées.
          </p>
        </div>
      </div>
    );
  }

  const etat = ETAT_JOURNEE[journee.etat] ?? ETAT_JOURNEE.brouillon;
  const nombreDepots = journee.nombre_fiches_depot ?? depots.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] text-muted-foreground">
            Journée du {dateLibelle}
            <span className="text-muted-foreground/70"> · {dateIso}</span>
          </p>
          <p className="truncate font-mono text-[16px] font-bold tabular-nums text-foreground">
            {journee.reference}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => void navigate(`/sp/fiche-matinale/journee/${journee.reference}`)}
        >
          <FileText className="size-3.5" />
          Voir la journée
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/40 p-3">
        <div className="min-w-[10rem] flex-1 rounded-lg bg-background px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">État</p>
          <Badge className={`mt-1 ${etat.badge}`}>{etat.label}</Badge>
        </div>
        <div className="min-w-[10rem] flex-1 rounded-lg bg-background px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">Solde d&apos;ouverture</p>
          <p className="mt-0.5 text-[13px] font-bold tabular-nums">
            {formaterMontantFcfa(journee.solde_ouverture)} FCFA
          </p>
        </div>
        <div className="min-w-[10rem] flex-1 rounded-lg bg-background px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">Recettes</p>
          <p className="mt-0.5 text-[13px] font-bold tabular-nums">
            {formaterMontantFcfa(journee.total_recettes)} FCFA
          </p>
        </div>
        <div className="min-w-[10rem] flex-1 rounded-lg bg-background px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">Dépenses</p>
          <p className="mt-0.5 text-[13px] font-bold tabular-nums">
            {formaterMontantFcfa(journee.total_depenses)} FCFA
          </p>
        </div>
        <div className="min-w-[10rem] flex-1 rounded-lg bg-background px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">Solde de clôture</p>
          <p className="mt-0.5 text-[13px] font-bold tabular-nums">
            {formaterMontantFcfa(journee.solde_cloture)} FCFA
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-b-primary/20 bg-muted/60 hover:bg-muted/60">
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">
                Document
              </TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">
                Référence
              </TableHead>
              <TableHead className="h-11 w-[1%] text-right text-[11px] font-bold uppercase tracking-wider">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Fiche Bleue</TableCell>
              <TableCell className="font-mono text-[12.5px]">
                {journee.fiche_bleue_reference ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <MenuActionsDocument
                  disponible={journee.fiche_bleue_id != null}
                  enCours={actionEnCours?.startsWith("bleue-") ?? false}
                  onDetail={() => {
                    if (journee.fiche_bleue_id != null) {
                      setApercuBleueId(journee.fiche_bleue_id);
                    }
                  }}
                  onImprimer={() => {
                    if (journee.fiche_bleue_id == null) return;
                    void executerAction(
                      "bleue-print",
                      () => imprimerFicheBleueSp(journee.fiche_bleue_id!),
                      "Impression lancée.",
                    );
                  }}
                  onTelecharger={() => {
                    if (journee.fiche_bleue_id == null) return;
                    void executerAction(
                      "bleue-dl",
                      () => telechargerFicheBleueSp(journee.fiche_bleue_id!),
                      "Fiche Bleue téléchargée.",
                    );
                  }}
                />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Fiches de dépôt reçues</TableCell>
              <TableCell className="font-mono text-[12.5px]">
                {nombreDepots > 0
                  ? `${nombreDepots} fiche${nombreDepots > 1 ? "s" : ""}`
                  : "—"}
              </TableCell>
              <TableCell className="text-right">
                <MenuActionsDocument
                  disponible={depots.length > 0}
                  enCours={actionEnCours?.startsWith("depot-") ?? false}
                  onDetail={() => {
                    if (depots.length > 0) setApercuDepotRef(depots[0].reference);
                  }}
                  onImprimer={() => {
                    void executerAction(
                      "depot-print",
                      () => imprimerFichesDepotSp(depots),
                      "Impression lancée.",
                    );
                  }}
                  onTelecharger={() => {
                    void executerAction(
                      "depot-dl",
                      () => telechargerFichesDepotSp(depots),
                      depots.length > 1
                        ? "Archive des fiches de dépôt téléchargée."
                        : "Fiche de dépôt téléchargée.",
                    );
                  }}
                />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Fiche d&apos;exécution</TableCell>
              <TableCell className="font-mono text-[12.5px]">
                {journee.fiche_execution_reference ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <MenuActionsDocument
                  disponible={journee.fiche_execution_id != null}
                  enCours={actionEnCours?.startsWith("exec-") ?? false}
                  onDetail={() => {
                    if (journee.fiche_execution_id != null) {
                      setApercuExecutionId(journee.fiche_execution_id);
                    }
                  }}
                  onImprimer={() => {
                    if (journee.fiche_execution_id == null) return;
                    void executerAction(
                      "exec-print",
                      () => imprimerFicheExecutionSp(journee.fiche_execution_id!),
                      "Impression lancée.",
                    );
                  }}
                  onTelecharger={() => {
                    if (journee.fiche_execution_id == null) return;
                    void executerAction(
                      "exec-dl",
                      () => telechargerFicheExecutionSp(journee.fiche_execution_id!),
                      "Fiche d'exécution téléchargée.",
                    );
                  }}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <PreviewFicheBleueDialog
        ficheId={apercuBleueId}
        onClose={() => setApercuBleueId(null)}
      />
      <PreviewFicheDepotDialog
        reference={apercuDepotRef}
        fichesDisponibles={depots}
        onClose={() => setApercuDepotRef(null)}
      />
      <PreviewFicheExecutionDialog
        ficheId={apercuExecutionId}
        onClose={() => setApercuExecutionId(null)}
      />
    </div>
  );
}

function MenuActionsDocument({
  disponible,
  enCours,
  onDetail,
  onImprimer,
  onTelecharger,
}: {
  disponible: boolean;
  enCours: boolean;
  onDetail: () => void;
  onImprimer: () => void;
  onTelecharger: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-primary hover:text-primary"
          disabled={!disponible}
          title={disponible ? "Actions" : "Document indisponible"}
          aria-label="Actions sur le document"
        >
          {enCours ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreVertical className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onDetail}>
          <Eye className="size-4 text-accent" />
          Détail
        </DropdownMenuItem>
        <DropdownMenuItem disabled={enCours} onSelect={onImprimer}>
          <Printer className="size-4 text-warning" />
          Imprimer
        </DropdownMenuItem>
        <DropdownMenuItem disabled={enCours} onSelect={onTelecharger}>
          <Download className="size-4 text-primary" />
          Téléchargement
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
