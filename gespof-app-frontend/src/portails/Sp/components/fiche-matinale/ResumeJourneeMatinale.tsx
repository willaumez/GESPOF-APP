import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Banknote, CalendarDays, CreditCard, FileText, Loader2, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { formatMontant } from "@/shared/lib/format";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { TabFicheExecution } from "@/portails/Sp/components/fiche-matinale/TabFicheExecution";
import { PreviewFicheBleueDialog } from "@/portails/Sp/components/fiche-matinale/PreviewFicheBleueDialog";
import { PreviewFicheDepotDialog } from "@/portails/Sp/components/fiche-matinale/PreviewFicheDepotDialog";
import { DialogRecettesOracle } from "@/portails/Sp/components/fiche-matinale/DialogRecettesOracle";
import { listerFichesDepotDeJournee } from "@/portails/Sp/api/fiches-depot";
import type { FicheDepotResumeSp } from "@/portails/Sp/types/fiche-depot.interface";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

const STYLE_ETAT: Record<string, string> = {
  brouillon: "border-transparent bg-muted text-muted-foreground",
  en_cours: "border-transparent bg-primary/10 text-primary",
  cloture: "border-transparent bg-warning/10 text-warning",
};

function formaterDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formaterMontant(valeur: string): string {
  return `${formatMontant(valeur)} FCFA`;
}

interface ResumeJourneeMatinaleProps {
  journee: JourneeTresorerie;
  onJourneeChange: (journee: JourneeTresorerie) => void;
}

/**
 * Accueil fiche matinale lorsqu'une journée du jour existe déjà :
 * cartes compactes + tableau Fiche d'exécution.
 */
export function ResumeJourneeMatinale({
  journee,
  onJourneeChange,
}: ResumeJourneeMatinaleProps) {
  const navigate = useNavigate();
  const theme = getPortalMenu("sp").theme;
  const styleCarte: CSSProperties = { borderColor: `${theme.topColor}28` };
  const [local, setLocal] = useState(journee);
  const [apercuBleueId, setApercuBleueId] = useState<number | null>(null);
  const [depotRef, setDepotRef] = useState<string | null>(null);
  const [fichesDepot, setFichesDepot] = useState<FicheDepotResumeSp[]>([]);
  const [chargementDepot, setChargementDepot] = useState(false);
  const [dialogRecettesOuvert, setDialogRecettesOuvert] = useState(false);

  useEffect(() => {
    setLocal(journee);
  }, [journee]);

  const majJournee = useCallback(
    (maj: JourneeTresorerie) => {
      setLocal(maj);
      onJourneeChange(maj);
    },
    [onJourneeChange],
  );

  function ouvrirFicheBleue() {
    if (local.fiche_bleue_id == null) {
      toast.info("Aucune Fiche Bleue n'est liée à cette journée.");
      return;
    }
    setApercuBleueId(local.fiche_bleue_id);
  }

  async function ouvrirFicheDepot() {
    if (chargementDepot) return;
    setChargementDepot(true);
    try {
      const page = await listerFichesDepotDeJournee(local.reference);
      const fiches = page.fiches ?? [];
      if (fiches.length === 0) {
        toast.info("Aucune Fiche de dépôt envoyée pour cette journée.");
        return;
      }
      setFichesDepot(fiches);
      setDepotRef(fiches[0].reference);
    } catch (e) {
      toast.error(
        messageDonneesOuDefaut(
          e instanceof Error ? e.message : null,
          "Impossible de charger les Fiches de dépôt.",
        ),
      );
    } finally {
      setChargementDepot(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 sm:gap-5">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Card size="sm" className="border bg-card shadow-sm" style={styleCarte}>
          <CardContent className="flex items-center gap-2.5 px-3 py-2.5 sm:px-3.5 sm:py-3">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Référence
              </p>
              <p className="truncate text-[13px] font-bold tabular-nums tracking-tight text-foreground sm:text-[14px]">
                {local.reference}
              </p>
            </div>
            <Badge className={STYLE_ETAT[local.etat] ?? STYLE_ETAT.brouillon}>
              {local.etat_libelle}
            </Badge>
          </CardContent>
        </Card>

        <Card size="sm" className="border bg-card shadow-sm" style={styleCarte}>
          <CardContent className="space-y-0.5 px-3 py-2.5 sm:px-3.5 sm:py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Création
            </p>
            <p className="text-[13px] font-semibold tabular-nums text-foreground sm:text-[14px]">
              {formaterDate(local.date_creation)}
            </p>
            {local.fiche_bleue_reference && (
              <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <FileText className="size-3 shrink-0" />
                {local.fiche_bleue_reference}
              </p>
            )}
          </CardContent>
        </Card>

        <Card size="sm" className="border bg-card shadow-sm" style={styleCarte}>
          <CardContent className="flex items-stretch gap-2.5 px-3 py-2.5 sm:px-3.5 sm:py-3">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Recettes
              </p>
              <p
                className="truncate text-[13px] font-bold tabular-nums sm:text-[14px]"
                style={{ color: theme.iconColor }}
              >
                {formaterMontant(local.total_recettes)}
              </p>
            </div>
            <div className="w-px shrink-0 self-stretch bg-border" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Dépenses
              </p>
              <p
                className="truncate text-[13px] font-bold tabular-nums sm:text-[14px]"
                style={{ color: theme.iconColor }}
              >
                {formaterMontant(local.total_depenses)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card size="sm" className="border bg-card shadow-sm" style={styleCarte}>
          <CardContent className="flex items-stretch gap-2.5 px-3 py-2.5 sm:px-3.5 sm:py-3">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Solde ouv.
              </p>
              <p
                className="truncate text-[13px] font-bold tabular-nums sm:text-[14px]"
                style={{ color: theme.iconColor }}
              >
                {formaterMontant(local.solde_ouverture)}
              </p>
            </div>
            <div className="w-px shrink-0 self-stretch bg-border" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Solde clôt.
              </p>
              <p
                className="truncate text-[13px] font-bold tabular-nums sm:text-[14px]"
                style={{ color: theme.iconColor }}
              >
                {formaterMontant(local.solde_cloture)}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground sm:text-[15px]">
            Fiche d&apos;exécution
          </h2>
          <p className="text-[12px] text-muted-foreground">
            Programme · réalisé · écart pour la journée en cours
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            className="gap-1.5 text-white hover:opacity-90"
            style={{ background: theme.ctaColor }}
          >
            <Sunrise className="size-3.5" />
            Fiche d&apos;exécution
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={ouvrirFicheBleue}
          >
            <FileText className="size-3.5" />
            Fiche Bleue
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={chargementDepot}
            onClick={() => void ouvrirFicheDepot()}
          >
            {chargementDepot ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CreditCard className="size-3.5" />
            )}
            Fiche de dépôt
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setDialogRecettesOuvert(true)}
          >
            <Banknote className="size-3.5" />
            Recette
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              void navigate(
                `/sp/fiche-matinale/journee/${encodeURIComponent(local.reference)}`,
              )
            }
          >
            <CalendarDays className="size-3.5" />
            Journée Trésorerie
          </Button>
        </div>
      </div>

      <TabFicheExecution
        journee={local}
        onJourneeChange={majJournee}
        onCreerFicheBleue={() =>
          void navigate(
            `/sp/fiche-matinale/journee/${encodeURIComponent(local.reference)}?onglet=fiche-bleue&creer=1`,
          )
        }
        actif
      />

      <PreviewFicheBleueDialog
        ficheId={apercuBleueId}
        onClose={() => setApercuBleueId(null)}
      />
      <PreviewFicheDepotDialog
        reference={depotRef}
        fichesDisponibles={fichesDepot}
        onClose={() => {
          setDepotRef(null);
          setFichesDepot([]);
        }}
        referenceJournee={local.reference}
        lectureSeule={local.etat === "cloture"}
      />
      <DialogRecettesOracle
        ouvert={dialogRecettesOuvert}
        onClose={() => setDialogRecettesOuvert(false)}
        referenceJournee={local.reference}
        lectureSeule={local.etat === "cloture"}
      />
    </div>
  );
}
