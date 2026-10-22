import { useEffect, useState } from "react";
import { FileText, Loader2, Pencil, Plus, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { CreerFicheBleueVue } from "@/portails/Sp/components/fiche-matinale/CreerFicheBleueVue";
import { TableauLectureFicheBleue } from "@/portails/Sp/components/fiche-bleue/TableauLectureFicheBleue";
import { TableauFicheBleueExcel } from "@/portails/Sp/components/fiche-bleue/TableauFicheBleueExcel";
import {
  BoutonPleinEcran, OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import {
  formaterMontantFcfa, libelleDateFr, STATUT_FICHE_BLEUE,
} from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { detailFicheBleue } from "@/portails/Sp/api/fiches-bleues";
import {
  creerJourneeTresorerie,
  lierFicheBleueAJournee,
} from "@/portails/Sp/api/journees-tresorerie";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import type { FicheBleueDetail } from "@/portails/Sp/types/fiche-bleue.interface";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

function sommerParType(
  fiche: FicheBleueDetail,
  type: FicheBleueDetail["sections"][number]["type"],
): string {
  const total = fiche.sections
    .filter((s) => s.type === type)
    .reduce((acc, s) => acc + Number(s.montant_programme.replace(",", ".")), 0);
  return Number.isFinite(total) ? total.toFixed(2) : "0.00";
}

function journeeEstOuverte(journee: JourneeTresorerie | null): journee is JourneeTresorerie {
  return journee != null && journee.etat !== "cloture";
}

/**
 * Fiche Bleue liée à la journée choisie dans la TopBar (journée du jour par défaut).
 * La création n'est possible que pour la journée du jour (contrainte backend).
 */
export function VueFicheBleueDuJour() {
  const theme = getPortalMenu("sp").theme;
  const {
    journee, chargement: chargementJournee, date: dateJour, estDuJour, appliquerJournee,
  } = useJourneeSelectionnee();
  const dateLibelle = libelleDateFr(dateJour);

  const ficheId = journee?.fiche_bleue_id ?? null;
  /** Détail chargé pour une fiche donnée : en cours tant que l'id ne correspond pas. */
  const [ficheChargee, setFicheChargee] = useState<{
    id: number;
    fiche: FicheBleueDetail | null;
  } | null>(null);
  const detail = ficheChargee && ficheChargee.id === ficheId ? ficheChargee.fiche : null;
  const chargementDetail = ficheId != null && ficheChargee?.id !== ficheId;
  const [mode, setMode] = useState<"lecture" | "creation" | "edition">("lecture");
  const [ouvertureEnCours, setOuvertureEnCours] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);

  useEffect(() => {
    if (ficheId === null) return;
    let annule = false;
    void detailFicheBleue(ficheId)
      .then(({ fiche }) => {
        if (!annule) setFicheChargee({ id: ficheId, fiche });
      })
      .catch((e) => {
        if (annule) return;
        setFicheChargee({ id: ficheId, fiche: null });
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger la Fiche Bleue de la journée.",
        );
      });
    return () => {
      annule = true;
    };
  }, [ficheId]);

  async function ouvrirJournee() {
    setOuvertureEnCours(true);
    try {
      const { journee: creee } = await creerJourneeTresorerie();
      appliquerJournee(creee);
      toast.success(`Journée ${creee.reference} ouverte.`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Impossible d'ouvrir la journée de trésorerie.",
      );
    } finally {
      setOuvertureEnCours(false);
    }
  }

  const journeeCloturee = journee?.etat === "cloture";
  const journeeOuverte = journeeEstOuverte(journee);
  const creationPossible = journeeOuverte && estDuJour;

  if (mode === "creation" && creationPossible) {
    return (
      <CreerFicheBleueVue
        dateJour={dateJour}
        ficheExistante={null}
        onAnnuler={() => setMode("lecture")}
        onCreee={async (fiche) => {
          try {
            const { journee: maj } = await lierFicheBleueAJournee(
              journee.reference,
              fiche.id,
            );
            setFicheChargee({ id: fiche.id, fiche });
            appliquerJournee(maj);
          } catch (e) {
            toast.error(
              e instanceof Error
                ? e.message
                : "Fiche créée, mais le lien avec la journée a échoué.",
            );
          }
          setMode("lecture");
        }}
      />
    );
  }

  if (mode === "edition" && detail) {
    return (
      <CreerFicheBleueVue
        dateJour={dateJour}
        ficheExistante={detail}
        onAnnuler={() => setMode("lecture")}
        onCreee={(fiche) => {
          setFicheChargee({ id: fiche.id, fiche });
          setMode("lecture");
        }}
      />
    );
  }

  if (chargementJournee || (chargementDetail && !detail)) {
    return (
      <div className="flex min-h-[220px] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (ficheId === null && !journeeOuverte) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-4 text-center">
        <div
          className="flex size-12 items-center justify-center rounded-2xl"
          style={{ background: theme.iconBg, color: theme.iconColor }}
        >
          <Sunrise className="size-6" />
        </div>
        <div className="max-w-md space-y-1.5">
          <p className="text-[15px] font-semibold text-foreground">
            {journeeCloturee
              ? `Journée de trésorerie clôturée le ${dateLibelle}`
              : "Aucune journée de trésorerie ouverte"}
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {journeeCloturee
              ? "Impossible de créer une Fiche Bleue : cette journée est déjà clôturée."
              : `Une Fiche Bleue ne peut être créée qu'après l'ouverture de la journée de trésorerie du ${dateLibelle}.`}
          </p>
        </div>
        {journeeCloturee || !estDuJour ? null : (
          <Button
            type="button"
            size="lg"
            className="mt-1 gap-2 font-semibold text-white uppercase tracking-wide"
            style={{ background: theme.ctaColor }}
            disabled={ouvertureEnCours}
            onClick={() => void ouvrirJournee()}
          >
            {ouvertureEnCours ? <Loader2 className="size-4 animate-spin" /> : <Sunrise className="size-4" />}
            Ouvrir la journée trésorerie du {dateLibelle}
          </Button>
        )}
      </div>
    );
  }

  if (ficheId === null) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-4 text-center">
        <div
          className="flex size-12 items-center justify-center rounded-2xl"
          style={{ background: theme.iconBg, color: theme.iconColor }}
        >
          <FileText className="size-6" />
        </div>
        <div className="max-w-md space-y-1.5">
          <p className="text-[15px] font-semibold text-foreground">
            Aucune Fiche Bleue pour le {dateLibelle}
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {creationPossible
              ? "Créez la programmation du jour à partir du gabarit par défaut (recettes, dépenses et solde)."
              : "Aucune programmation n'a été enregistrée pour cette journée de trésorerie."}
          </p>
        </div>
        {creationPossible ? (
          <Button
            type="button"
            size="lg"
            className="mt-1 gap-2 font-semibold text-white uppercase tracking-wide"
            style={{ background: theme.ctaColor }}
            onClick={() => setMode("creation")}
          >
            <Plus className="size-4" />
            Créer la Fiche Bleue du {dateLibelle}
          </Button>
        ) : null}
      </div>
    );
  }

  const statut = detail
    ? (STATUT_FICHE_BLEUE[detail.statut] ?? STATUT_FICHE_BLEUE.brouillon)
    : null;

  function rendreBoutonModifier() {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={!detail}
        onClick={() => {
          setPleinEcran(false);
          setMode("edition");
        }}
      >
        <Pencil className="size-3.5" />
        Modifier
      </Button>
    );
  }

  const tableau = (
    <TableauLectureFicheBleue fiche={detail} chargement={chargementDetail} />
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[13px] text-muted-foreground">
              Programmation du {dateLibelle}
            </p>
            <p className="truncate text-[16px] font-bold tabular-nums text-foreground">
              {detail?.reference ?? journee?.fiche_bleue_reference ?? "—"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <BoutonPleinEcran
              actif={pleinEcran}
              onToggle={() => setPleinEcran((v) => !v)}
              libelleEnter="Afficher la Fiche Bleue en plein écran"
            />
            {rendreBoutonModifier()}
          </div>
        </div>

        {detail ? (
          <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/40 p-3">
            <div className="min-w-[12rem] flex-1 rounded-lg bg-background px-3 py-2">
              <p className="text-[11px] font-medium text-muted-foreground">Statut</p>
              {statut ? <Badge className={`mt-1 ${statut.badge}`}>{statut.label}</Badge> : "—"}
            </div>
            <div className="min-w-[12rem] flex-1 rounded-lg bg-background px-3 py-2">
              <p className="text-[11px] font-medium text-muted-foreground">Solde programmé</p>
              <p className="mt-0.5 text-[13px] font-bold tabular-nums">
                {formaterMontantFcfa(sommerParType(detail, "solde"))} FCFA
              </p>
            </div>
            <div className="min-w-[12rem] flex-1 rounded-lg bg-background px-3 py-2">
              <p className="text-[11px] font-medium text-muted-foreground">Recettes prog.</p>
              <p className="mt-0.5 text-[13px] font-bold tabular-nums">
                {formaterMontantFcfa(sommerParType(detail, "recette"))} FCFA
              </p>
            </div>
            <div className="min-w-[12rem] flex-1 rounded-lg bg-background px-3 py-2">
              <p className="text-[11px] font-medium text-muted-foreground">Dépenses prog.</p>
              <p className="mt-0.5 text-[13px] font-bold tabular-nums">
                {formaterMontantFcfa(sommerParType(detail, "depense"))} FCFA
              </p>
            </div>
          </div>
        ) : null}

        {!pleinEcran ? tableau : (
          <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed text-[13px] text-muted-foreground">
            Tableau affiché en plein écran
          </div>
        )}
      </div>

      <OverlayPleinEcran
        ouvert={pleinEcran}
        titre="Fiche Bleue"
        sousTitre={detail?.reference ?? journee?.fiche_bleue_reference ?? undefined}
        onClose={() => setPleinEcran(false)}
        actions={rendreBoutonModifier()}
        ariaLabel="Fiche Bleue en plein écran"
      >
        <TableauFicheBleueExcel fiche={detail} chargement={chargementDetail} />
      </OverlayPleinEcran>
    </TooltipProvider>
  );
}
