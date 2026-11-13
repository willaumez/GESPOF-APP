import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { detailFicheExecution } from "@/portails/Sp/api/fiches-execution";
import { TableauFicheExecutionLecture } from "@/portails/Sp/components/fiche-execution/TableauFicheExecutionLecture";
import {
  BoutonPleinEcran,
  OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import type { FicheExecutionDetail } from "@/portails/Sp/types/fiche-execution.interface";

interface PreviewFicheExecutionDialogProps {
  ficheId: number | null;
  onClose: () => void;
}

/**
 * Aperçu lecture seule d'une Fiche d'exécution — même présentation que l'onglet
 * (dialog et plein écran).
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

  const btnSecondaire =
    "flex h-[34px] items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#0f172a] hover:border-[#94a3b8]";

  const actionsDialog = (
    <>
      <BoutonPleinEcran
        actif={pleinEcran}
        onToggle={() => setPleinEcran(true)}
        libelleEnter="Afficher la Fiche d'exécution en plein écran"
      />
      <button type="button" className={btnSecondaire} onClick={onClose}>
        <X size={14} />
        Fermer
      </button>
    </>
  );

  return (
    <TooltipProvider>
      {/*
        Plein écran : on ferme le Dialog (sinon RemoveScroll Radix bloque la molette
        sur l'overlay porté dans <body>).
      */}
      <Dialog
        open={ouvert && !pleinEcran}
        onOpenChange={(o) => {
          if (!o && !pleinEcran) onClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex h-[min(92vh,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] w-[min(96vw,72rem)] flex-col gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-[72rem]"
        >
          <DialogTitle className="sr-only">
            Aperçu Fiche d&apos;exécution {fiche?.reference ?? ""}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Lecture seule de la fiche d&apos;exécution
          </DialogDescription>
          <TableauFicheExecutionLecture
            fiche={fiche}
            chargement={chargement}
            introuvable={introuvable}
            avecEnTete
            actions={actionsDialog}
          />
        </DialogContent>
      </Dialog>

      <OverlayPleinEcran
        ouvert={pleinEcran && ouvert}
        titre="Fiche d'exécution"
        sousTitre={fiche?.reference}
        onClose={() => setPleinEcran(false)}
        ariaLabel="Fiche d'exécution en plein écran"
        masquerEnTete
        sansMarge
      >
        <TableauFicheExecutionLecture
          fiche={fiche}
          chargement={chargement}
          introuvable={introuvable}
          avecEnTete
          sansCadre
        />
      </OverlayPleinEcran>
    </TooltipProvider>
  );
}
