import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { Button } from "@/shared/components/ui/button";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import {
  appliquerMontantsProgramme, detailFicheBleue, listerFichesBleues,
} from "@/portails/Sp/api/fiches-bleues";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { lierFicheBleueAJournee } from "@/portails/Sp/api/journees-tresorerie";
import { TableauLectureFicheBleue } from "@/portails/Sp/components/fiche-bleue/TableauLectureFicheBleue";
import { TableauFicheBleueExcel } from "@/portails/Sp/components/fiche-bleue/TableauFicheBleueExcel";
import { CreerFicheBleueVue } from "@/portails/Sp/components/fiche-matinale/CreerFicheBleueVue";
import { PreviewFicheBleueDialog } from "@/portails/Sp/components/fiche-matinale/PreviewFicheBleueDialog";
import {
  BoutonPleinEcran, OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import type {
  FicheBleueDetail, FicheBleueResume, SectionFicheBleue,
} from "@/portails/Sp/types/fiche-bleue.interface";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

function dateIsoJour(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function libelleDateFr(d: Date = new Date()): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function sommerMontantsRacines(
  sections: SectionFicheBleue[],
  type: SectionFicheBleue["type"],
): string {
  const total = sections
    .filter((s) => s.type === type)
    .reduce((acc, s) => acc + Number(s.montant_programme.replace(",", ".")), 0);
  return Number.isFinite(total) ? total.toFixed(2) : "0.00";
}

interface ResumeProgrammationFicheBleue {
  soldeProgramme: string | null;
  totalRecettes: string | null;
  totalDepenses: string | null;
  dateLibelle: string;
  chargement: boolean;
}

interface TabFicheBleueProps {
  journee: JourneeTresorerie;
  onJourneeChange: (journee: JourneeTresorerie) => void;
  onFicheSelectionneeChange: (fiche: FicheBleueResume | null) => void;
  onNombreFichesDisponiblesChange?: (nombre: number) => void;
  onProgrammationChange?: (resume: ResumeProgrammationFicheBleue | null) => void;
  ouvrirSelection?: boolean;
  onFermerSelection?: () => void;
  ouvrirCreation?: boolean;
  onFermerCreation?: () => void;
  ouvrirEdition?: boolean;
  onFermerEdition?: () => void;
  conteneurActionsEdition?: HTMLElement | null;
  /** Contrôle externe du plein écran (bouton dans l'en-tête parent). */
  pleinEcran?: boolean;
  onPleinEcranChange?: (ouvert: boolean) => void;
  actif: boolean;
}

/**
 * Onglet Fiche Bleue : la plus récente est sélectionnée par défaut.
 * Le bouton de sélection et le résumé de la fiche liée sont dans l'en-tête parent.
 */
export function TabFicheBleue({
  journee,
  onJourneeChange,
  onFicheSelectionneeChange,
  onNombreFichesDisponiblesChange,
  onProgrammationChange,
  ouvrirSelection = false,
  onFermerSelection,
  ouvrirCreation = false,
  onFermerCreation,
  ouvrirEdition = false,
  onFermerEdition,
  conteneurActionsEdition = null,
  pleinEcran: pleinEcranControle,
  onPleinEcranChange,
  actif,
}: TabFicheBleueProps) {
  const theme = getPortalMenu("sp").theme;
  const dateJour = new Date();
  const dateIso = dateIsoJour(dateJour);
  const dateLibelle = libelleDateFr(dateJour);

  const [chargement, setChargement] = useState(false);
  const [fiches, setFiches] = useState<FicheBleueResume[]>([]);
  const [liaisonEnCours, setLiaisonEnCours] = useState(false);
  const [modeCreation, setModeCreation] = useState(false);
  const [detailSelectionnee, setDetailSelectionnee] = useState<FicheBleueDetail | null>(null);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [modeSelectionDialog, setModeSelectionDialog] = useState(false);
  const [pleinEcranLocal, setPleinEcranLocal] = useState(false);
  const autoLieRef = useRef(false);

  const pleinEcranControleExterne = onPleinEcranChange != null;
  const pleinEcran = pleinEcranControleExterne
    ? (pleinEcranControle ?? false)
    : pleinEcranLocal;

  function setPleinEcran(ouvert: boolean) {
    if (pleinEcranControleExterne) {
      onPleinEcranChange(ouvert);
      return;
    }
    setPleinEcranLocal(ouvert);
  }

  const fermerPreview = useCallback(() => {
    setPreviewId(null);
    setModeSelectionDialog(false);
    onFermerSelection?.();
  }, [onFermerSelection]);

  useEffect(() => {
    if (!actif) {
      if (onPleinEcranChange) onPleinEcranChange(false);
      else setPleinEcranLocal(false);
    }
  }, [actif, onPleinEcranChange]);

  const ficheLieeId = journee.fiche_bleue_id;
  const dejaLiee = ficheLieeId !== null;

  const fichesDisponibles = [...fiches]
    .filter(
      (f) =>
        f.journee_tresorerie_reference === null
        || f.journee_tresorerie_reference === journee.reference,
    )
    .sort((a, b) => b.date_creation.localeCompare(a.date_creation));

  const ficheSelectionnee = fiches.find((f) => f.id === ficheLieeId) ?? null;
  /** Journée clôturée (non réouverte) : ni liaison, ni création, ni modification. */
  const cloturee = journee.etat === "cloture";
  /** Programmé saisissable tant que la journée n'est pas clôturée. */
  const programmeModifiable = !cloturee
    && detailSelectionnee !== null
    && detailSelectionnee.statut !== "cloture";

  async function modifierProgramme(sectionId: number, montant: string): Promise<boolean> {
    if (!detailSelectionnee) return false;
    try {
      const { fiche } = await appliquerMontantsProgramme(detailSelectionnee.id, [
        { section_id: sectionId, montant_programme: montant },
      ]);
      setDetailSelectionnee(fiche);
      return true;
    } catch (e) {
      toast.error(messageDonneesOuDefaut(
        e instanceof Error ? e.message : null,
        "Impossible d'enregistrer le montant programmé.",
      ));
      return false;
    }
  }

  const soldeProgramme = detailSelectionnee
    ? sommerMontantsRacines(detailSelectionnee.sections, "solde")
    : null;
  const totalRecettes = detailSelectionnee
    ? sommerMontantsRacines(detailSelectionnee.sections, "recette")
    : null;
  const totalDepenses = detailSelectionnee
    ? sommerMontantsRacines(detailSelectionnee.sections, "depense")
    : null;

  async function chargerFiches() {
    setChargement(true);
    try {
      const page = await listerFichesBleues({ date: dateIso, limite: 100 });
      setFiches(page.fiches ?? []);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Impossible de charger les Fiches Bleues du jour.",
      );
    } finally {
      setChargement(false);
    }
  }

  async function lier(ficheId: number, silencieux = false): Promise<boolean> {
    if (journee.fiche_bleue_id === ficheId) return true;
    setLiaisonEnCours(true);
    try {
      const { journee: maj } = await lierFicheBleueAJournee(journee.reference, ficheId);
      onJourneeChange(maj);
      if (!silencieux) {
        toast.success("Fiche Bleue sélectionnée pour cette journée.");
      }
      await chargerFiches();
      return true;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Impossible de lier la Fiche Bleue.",
      );
      return false;
    } finally {
      setLiaisonEnCours(false);
    }
  }

  useEffect(() => {
    onFicheSelectionneeChange(ficheSelectionnee);
  }, [ficheSelectionnee, onFicheSelectionneeChange]);

  useEffect(() => {
    onNombreFichesDisponiblesChange?.(fichesDisponibles.length);
  }, [fichesDisponibles.length, onNombreFichesDisponiblesChange]);

  useEffect(() => {
    if (!ouvrirSelection) return;
    const id = ficheSelectionnee?.id ?? fichesDisponibles[0]?.id ?? null;
    if (id === null) {
      onFermerSelection?.();
      return;
    }
    setModeCreation(false);
    setModeSelectionDialog(true);
    setPreviewId(id);
    // N'ouvrir qu'à la demande du parent, sans réinitialiser le dialog à chaque render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvrirSelection]);

  useEffect(() => {
    if (!ouvrirCreation) return;
    setPreviewId(null);
    setModeSelectionDialog(false);
    setModeCreation(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvrirCreation]);

  useEffect(() => {
    if (!ouvrirEdition) return;
    setPreviewId(null);
    setModeSelectionDialog(false);
    setModeCreation(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvrirEdition]);

  useEffect(() => {
    if (modeCreation || ouvrirEdition || !ficheSelectionnee) {
      onProgrammationChange?.(null);
      return;
    }
    onProgrammationChange?.({
      soldeProgramme,
      totalRecettes,
      totalDepenses,
      dateLibelle,
      chargement: chargementDetail && !detailSelectionnee,
    });
  }, [
    modeCreation,
    ouvrirEdition,
    ficheSelectionnee,
    soldeProgramme,
    totalRecettes,
    totalDepenses,
    dateLibelle,
    chargementDetail,
    detailSelectionnee,
    onProgrammationChange,
  ]);

  useEffect(() => {
    if (!actif) return;
    autoLieRef.current = false;
    setModeCreation(false);
    onFermerCreation?.();
    onFermerEdition?.();
    void chargerFiches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, dateIso, journee.reference]);

  useEffect(() => {
    if (!actif || cloturee || chargement || liaisonEnCours || autoLieRef.current || modeCreation || ouvrirEdition) return;
    if (ficheLieeId !== null) return;
    if (fichesDisponibles.length === 0) return;

    autoLieRef.current = true;
    void lier(fichesDisponibles[0].id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, cloturee, chargement, fichesDisponibles, ficheLieeId, liaisonEnCours, modeCreation, ouvrirEdition]);

  useEffect(() => {
    if (!actif || ficheLieeId === null) {
      setDetailSelectionnee(null);
      return;
    }

    let annule = false;
    setChargementDetail(true);
    void detailFicheBleue(ficheLieeId)
      .then(({ fiche }) => {
        if (!annule) setDetailSelectionnee(fiche);
      })
      .catch(() => {
        if (!annule) {
          setDetailSelectionnee(null);
        }
      })
      .finally(() => {
        if (!annule) setChargementDetail(false);
      });

    return () => {
      annule = true;
    };
  }, [actif, ficheLieeId]);

  const dialogPreview = (
    <PreviewFicheBleueDialog
      ficheId={previewId}
      detailCache={detailSelectionnee}
      onClose={fermerPreview}
      fichesDisponibles={modeSelectionDialog ? fichesDisponibles : undefined}
      ficheSelectionneeId={ficheLieeId}
      selectionEnCours={liaisonEnCours}
      onSelectionner={
        modeSelectionDialog && !cloturee
          ? async (id) => {
            const ok = await lier(id);
            if (ok) fermerPreview();
          }
          : undefined
      }
    />
  );

  if (!cloturee && (modeCreation || (ouvrirEdition && detailSelectionnee))) {
    return (
      <>
        <CreerFicheBleueVue
          dateJour={dateJour}
          ficheExistante={modeCreation ? null : detailSelectionnee}
          masquerEnTete={!modeCreation}
          conteneurActions={!modeCreation ? conteneurActionsEdition : null}
          onAnnuler={() => {
            setModeCreation(false);
            onFermerCreation?.();
            onFermerEdition?.();
          }}
          onCreee={async (fiche) => {
            const edition = !modeCreation;
            await chargerFiches();
            setModeCreation(false);
            onFermerCreation?.();
            onFermerEdition?.();
            if (edition) {
              setDetailSelectionnee(fiche);
              return;
            }
            const ok = await lier(fiche.id, true);
            if (ok) {
              toast.success(`Fiche Bleue ${fiche.reference} créée et sélectionnée.`);
            }
          }}
        />
        {dialogPreview}
      </>
    );
  }

  if (chargement && fiches.length === 0) {
    return (
      <div className="flex min-h-[180px] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!dejaLiee && fichesDisponibles.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 px-4 text-center">
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
            {cloturee
              ? "Cette journée est clôturée : aucune Fiche Bleue ne peut plus y être rattachée."
              : "Créez la programmation du jour pour la rattacher à cette journée de trésorerie."}
          </p>
        </div>
        {cloturee ? null : (
        <Button
          type="button"
          size="lg"
          className="mt-1 gap-2 font-semibold text-white uppercase tracking-wide"
          style={{ background: theme.ctaColor }}
          onClick={() => setModeCreation(true)}
        >
          <Plus className="size-4" />
          Créer la Fiche Bleue du {dateLibelle}
        </Button>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3">
        {programmeModifiable || !pleinEcranControleExterne ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 flex-1 text-[12px] text-muted-foreground">
              {programmeModifiable
                ? "Double-cliquez un montant programmé pour le modifier. Les totaux et la Fiche d'exécution se mettent à jour automatiquement."
                : null}
            </p>
            {!pleinEcranControleExterne ? (
              <BoutonPleinEcran
                actif={pleinEcran}
                onToggle={() => setPleinEcran(!pleinEcran)}
                libelleEnter="Afficher la Fiche Bleue en plein écran"
              />
            ) : null}
          </div>
        ) : null}

        {!pleinEcran ? (
          <TableauLectureFicheBleue
            fiche={detailSelectionnee}
            chargement={chargementDetail}
            onModifierProgramme={programmeModifiable ? modifierProgramme : undefined}
          />
        ) : (
          <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed text-[13px] text-muted-foreground">
            Tableau affiché en plein écran
          </div>
        )}

        {dialogPreview}
      </div>

      <OverlayPleinEcran
        ouvert={pleinEcran}
        titre="Fiche Bleue"
        sousTitre={detailSelectionnee?.reference ?? ficheSelectionnee?.reference}
        onClose={() => setPleinEcran(false)}
        ariaLabel="Fiche Bleue en plein écran"
      >
        <TableauFicheBleueExcel
          fiche={detailSelectionnee}
          chargement={chargementDetail}
        />
      </OverlayPleinEcran>
    </TooltipProvider>
  );
}
