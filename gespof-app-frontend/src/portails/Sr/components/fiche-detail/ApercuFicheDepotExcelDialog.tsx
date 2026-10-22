import { Fragment, useEffect, useState } from "react";
import { FileDown, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { portalThemeVars } from "@/shared/lib/color";
import { formatMontant } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
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
import { requeteApiBlob } from "@/shared/lib/api";
import {
  BoutonPleinEcran,
  OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import { SERVICE_REGLEMENT_ENDPOINTS } from "@/portails/Sr/api/endpoints";
import { nomFichierFicheDepot } from "@/portails/Sr/lib/exporter-fiche-depot-xlsx";
import { imprimerFicheDepot } from "@/portails/Sr/lib/imprimer-fiche-depot";
import type { FicheDepotDetail, LigneMouvement } from "@/portails/Sr/types";
import { TYPE_CFG, type TypeMouvement } from "./constants";

interface ApercuFicheDepotExcelDialogProps {
  ouvert: boolean;
  detail: FicheDepotDetail | null;
  onClose: () => void;
}

type SectionApercu = {
  type: TypeMouvement;
  label: string;
  lignes: LigneMouvement[];
  total: string;
  modeSystac?: boolean;
};

function formaterMontantAffiche(valeur: string | number): string {
  const formate = formatMontant(valeur);
  return formate === "—" ? String(valeur) : formate;
}

function sectionsDepuisDetail(detail: FicheDepotDetail): SectionApercu[] {
  return [
    {
      type: "numeraire",
      label: "Numéraire",
      lignes: detail.mouvements_numeraire,
      total: detail.total_numeraire,
    },
    {
      type: "sigma",
      label: "SYGMA",
      lignes: detail.mouvements_sygma,
      total: detail.total_sigma,
    },
    {
      type: "systac",
      label: "SYSTAC",
      lignes: detail.mouvements_systac,
      total: detail.total_systac,
      modeSystac: true,
    },
  ];
}

function montantLigne(l: LigneMouvement, modeSystac?: boolean): number {
  return modeSystac ? (l.montant_groupe ?? l.depenses) : l.depenses;
}

function beneficiaireLigne(l: LigneMouvement, modeSystac?: boolean): string {
  if (modeSystac) return l.designation || l.beneficiaire || "—";
  return l.beneficiaire || "—";
}

function BandeauEquation({ detail }: { detail: FicheDepotDetail }) {
  const parts: { type: TypeMouvement; label: string; valeur: string }[] = [
    { type: "numeraire", label: "Numéraire", valeur: detail.total_numeraire },
    { type: "sigma", label: "SYGMA", valeur: detail.total_sigma },
    { type: "systac", label: "SYSTAC", valeur: detail.total_systac },
  ];

  return (
    <div
      className="flex w-full shrink-0 items-stretch gap-1.5 rounded-xl border px-2 py-1.5 sm:gap-2 sm:px-3"
      style={{
        borderColor: "color-mix(in oklab, var(--primary) 28%, transparent)",
        background: "color-mix(in oklab, var(--primary) 8%, transparent)",
      }}
    >
      {parts.map((p, i) => {
        const cfg = TYPE_CFG[p.type];
        return (
          <Fragment key={p.type}>
            {i > 0 ? (
              <span
                className="flex shrink-0 items-center self-center text-sm font-bold text-muted-foreground"
                aria-hidden
              >
                +
              </span>
            ) : null}
            <div
              className={cn(
                "flex min-w-0 flex-1 flex-col justify-center rounded-lg px-2.5 py-1.5",
                cfg.bar,
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                {p.label}
              </span>
              <span className="truncate text-[13px] font-bold tabular-nums">
                {formaterMontantAffiche(p.valeur)}
              </span>
            </div>
          </Fragment>
        );
      })}
      <span
        className="flex shrink-0 items-center self-center text-sm font-bold text-muted-foreground"
        aria-hidden
      >
        =
      </span>
      <div
        className="flex min-w-0 flex-1 flex-col justify-center rounded-lg px-2.5 py-1.5 text-primary"
        style={{ background: "color-mix(in oklab, var(--primary) 14%, transparent)" }}
      >
        <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
          Total
        </span>
        <span className="truncate text-[13px] font-bold tabular-nums">
          {formaterMontantAffiche(detail.montant_total)} FCFA
        </span>
      </div>
    </div>
  );
}

function TableauApercu({
  detail,
  headerBg,
}: {
  detail: FicheDepotDetail;
  headerBg: string;
}) {
  const sections = sectionsDepuisDetail(detail);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-primary/25 bg-background shadow-sm">
      <Table containerClassName="h-full min-h-0 flex-1 overflow-y-auto overflow-x-auto">
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b-primary/20">
            <TableHead
              className="sticky top-0 z-20 min-w-[220px] text-primary shadow-[inset_0_-1px_0_0] shadow-primary/20"
              style={{ backgroundColor: headerBg }}
            >
              Bénéficiaire / Désignation
            </TableHead>
            <TableHead
              className="sticky top-0 z-20 whitespace-nowrap text-center text-primary shadow-[inset_0_-1px_0_0] shadow-primary/20"
              style={{ backgroundColor: headerBg }}
            >
              N° OV
            </TableHead>
            <TableHead
              className="sticky top-0 z-20 whitespace-nowrap text-primary shadow-[inset_0_-1px_0_0] shadow-primary/20"
              style={{ backgroundColor: headerBg }}
            >
              Banque
            </TableHead>
            <TableHead
              className="sticky top-0 z-20 whitespace-nowrap text-right text-primary shadow-[inset_0_-1px_0_0] shadow-primary/20"
              style={{ backgroundColor: headerBg }}
            >
              Dépenses (FCFA)
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sections.map((s) => {
            const cfg = TYPE_CFG[s.type];
            return (
              <Fragment key={s.type}>
                <TableRow className={cn("hover:bg-inherit", cfg.bar)}>
                  <TableCell colSpan={4} className="p-0">
                    <div className="flex items-center justify-between gap-3 px-2.5 py-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide">
                        {s.label}
                      </span>
                      <span className="shrink-0 text-[13px] font-bold tabular-nums">
                        {formaterMontantAffiche(s.total)} FCFA
                      </span>
                    </div>
                  </TableCell>
                </TableRow>

                {s.lignes.length === 0 ? (
                  <TableRow className="hover:bg-inherit">
                    <TableCell
                      colSpan={4}
                      className="py-2.5 text-[12px] italic text-muted-foreground"
                    >
                      Aucune ligne {s.label.toLowerCase()}
                    </TableCell>
                  </TableRow>
                ) : (
                  s.lignes.map((l) => (
                    <TableRow key={`${s.type}-${l.id}`}>
                      <TableCell
                        className="max-w-[320px] truncate font-medium"
                        title={beneficiaireLigne(l, s.modeSystac)}
                      >
                        {beneficiaireLigne(l, s.modeSystac)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center text-muted-foreground">
                        {s.modeSystac ? "—" : (l.numero_ov ?? "—")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {s.modeSystac ? "—" : (l.banque ?? "—")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                        {formaterMontantAffiche(montantLigne(l, s.modeSystac))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </Fragment>
            );
          })}

          <TableRow className="bg-primary/15 text-primary hover:bg-primary/15">
            <TableCell colSpan={3} className="text-[11px] font-bold uppercase tracking-wide">
              Total général
            </TableCell>
            <TableCell className="text-right text-sm font-bold tabular-nums">
              {formaterMontantAffiche(detail.montant_total)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export function ApercuFicheDepotExcelDialog({
  ouvert,
  detail,
  onClose,
}: ApercuFicheDepotExcelDialogProps) {
  const theme = getPortalMenu("sr").theme;
  const [exportEnCours, setExportEnCours] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);

  useEffect(() => {
    if (!ouvert) setPleinEcran(false);
  }, [ouvert]);

  const handleImprimer = () => {
    if (!detail) return;
    try {
      imprimerFicheDepot(detail);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d'imprimer la fiche.",
      );
    }
  };

  const handleTelecharger = async () => {
    if (!detail || exportEnCours) return;
    setExportEnCours(true);
    try {
      // Toujours via le serveur : modèle + couleurs + fusions de cellules.
      // URL construite côté front (préfixe /sr/) pour éviter une URL API obsolète.
      const chemin =
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(detail.reference)}/telecharger`;
      const blob = await requeteApiBlob(chemin, {
        timeoutMs: 180_000,
      });
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = nomFichierFicheDepot(detail);
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      URL.revokeObjectURL(url);
      toast.success("Fichier Excel téléchargé.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Impossible de télécharger le fichier Excel.",
      );
    } finally {
      setExportEnCours(false);
    }
  };

  function fermer() {
    setPleinEcran(false);
    onClose();
  }

  const titre = `Aperçu — ${detail?.reference ?? "Fiche de dépôt"}`;
  const sousTitre = detail
    ? `Règlements du ${detail.date_presentation} · ${detail.genere_par.nom_complet}`
    : "Prévisualisation, impression et téléchargement de la fiche.";

  const actionsExport = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={!detail}
        onClick={handleImprimer}
      >
        <Printer className="size-4" />
        Imprimer
      </Button>
      <Button
        type="button"
        size="sm"
        className="gap-2 text-white hover:opacity-90"
        style={{ background: theme.ctaColor }}
        disabled={!detail || exportEnCours}
        title="Télécharger le fichier Excel (modèle officiel)"
        onClick={() => void handleTelecharger()}
      >
        {exportEnCours ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileDown className="size-4" />
        )}
        Télécharger .xlsx
      </Button>
    </div>
  );

  const corps = detail ? (
    <>
      <div className="shrink-0">
        <BandeauEquation detail={detail} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TableauApercu detail={detail} headerBg={theme.iconBg} />
      </div>
    </>
  ) : null;

  return (
    <Dialog
      open={ouvert}
      // En plein écran, désactiver le mode modal : RemoveScroll du Dialog
      // bloquerait sinon la molette sur l'overlay (portail hors DialogContent).
      modal={!pleinEcran}
      onOpenChange={(o) => {
        if (!o) fermer();
      }}
    >
      <DialogContent
        className="flex h-[min(92vh,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] w-[min(96vw,72rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[72rem]"
        style={portalThemeVars(theme.topColor)}
        onEscapeKeyDown={(e) => {
          if (pleinEcran) {
            e.preventDefault();
            setPleinEcran(false);
          }
        }}
      >
        <DialogHeader
          className="gap-0.5 space-y-0 border-b px-6 py-2.5 pr-12 text-left"
          style={{
            borderBottomColor: `${theme.topColor}33`,
            background: `linear-gradient(135deg, ${theme.bgColor} 0%, #fff 85%)`,
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <DialogTitle className="text-[15px] leading-tight text-primary">
                {titre}
              </DialogTitle>
              <DialogDescription className="text-[12px] leading-snug">
                {sousTitre}
              </DialogDescription>
            </div>
            <BoutonPleinEcran
              actif={pleinEcran}
              onToggle={() => setPleinEcran((v) => !v)}
              libelleEnter="Afficher l'aperçu en plein écran"
            />
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-6 py-3">
          {corps}
        </div>

        <DialogFooter
          className="gap-2 border-t !p-3 px-6 py-3 sm:justify-between sm:!px-6 sm:!py-3"
          style={{ borderTopColor: `${theme.topColor}22`, background: theme.bgColor }}
        >
          <Button type="button" variant="outline" size="sm" onClick={fermer}>
            Fermer
          </Button>
          {actionsExport}
        </DialogFooter>
      </DialogContent>

      <OverlayPleinEcran
        ouvert={pleinEcran && ouvert}
        portail="sr"
        titre={titre}
        sousTitre={sousTitre}
        onClose={() => setPleinEcran(false)}
        ariaLabel="Aperçu de la fiche de dépôt en plein écran"
        actions={actionsExport}
      >
        <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden overscroll-contain">
          {corps}
        </div>
      </OverlayPleinEcran>
    </Dialog>
  );
}
