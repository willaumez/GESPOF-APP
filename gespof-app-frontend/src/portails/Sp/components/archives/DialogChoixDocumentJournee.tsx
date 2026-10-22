import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { listerFichesDepotDeJournee } from "@/portails/Sp/api/fiches-depot";
import type { FicheDepotResumeSp } from "@/portails/Sp/types/fiche-depot.interface";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

export type DocumentJourneeChoix =
  | { type: "bleue"; id: number; label: string }
  | { type: "depot"; references: string[]; label: string }
  | { type: "execution"; id: number; label: string };

interface DialogChoixDocumentJourneeProps {
  journee: JourneeTresorerie | null;
  ouvert: boolean;
  titre?: string;
  description?: string;
  libelleConfirmer?: string;
  onClose: () => void;
  onConfirmer: (choix: DocumentJourneeChoix) => void | Promise<void>;
}

export function DialogChoixDocumentJournee({
  journee,
  ouvert,
  titre = "Imprimer un document",
  description = "Choisissez le fichier de la journée à imprimer.",
  libelleConfirmer = "Imprimer",
  onClose,
  onConfirmer,
}: DialogChoixDocumentJourneeProps) {
  const [depots, setDepots] = useState<FicheDepotResumeSp[]>([]);
  const [chargementDepots, setChargementDepots] = useState(false);
  const [choix, setChoix] = useState<string>("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!ouvert || !journee) {
      setDepots([]);
      setChoix("");
      return;
    }
    let annule = false;
    setChargementDepots(true);
    listerFichesDepotDeJournee(journee.reference)
      .then((page) => {
        if (!annule) setDepots(page.fiches ?? []);
      })
      .catch(() => {
        if (!annule) setDepots([]);
      })
      .finally(() => {
        if (!annule) setChargementDepots(false);
      });
    return () => {
      annule = true;
    };
  }, [ouvert, journee]);

  const options = useMemo(() => {
    const liste: { valeur: string; label: string; detail: string }[] = [];
    if (journee?.fiche_bleue_id != null) {
      liste.push({
        valeur: "bleue",
        label: "Fiche Bleue",
        detail: journee.fiche_bleue_reference ?? `ID ${journee.fiche_bleue_id}`,
      });
    }
    if (depots.length > 0 || (journee?.nombre_fiches_depot ?? 0) > 0) {
      liste.push({
        valeur: "depot",
        label: "Fiches de dépôt",
        detail:
          depots.length > 0
            ? `${depots.length} fiche${depots.length > 1 ? "s" : ""}`
            : `${journee?.nombre_fiches_depot ?? 0} fiche(s)`,
      });
    }
    if (journee?.fiche_execution_id != null) {
      liste.push({
        valeur: "execution",
        label: "Fiche d'exécution",
        detail: journee.fiche_execution_reference ?? `ID ${journee.fiche_execution_id}`,
      });
    }
    return liste;
  }, [journee, depots]);

  useEffect(() => {
    if (!ouvert || options.length === 0) return;
    setChoix((actuel) =>
      options.some((o) => o.valeur === actuel) ? actuel : options[0].valeur,
    );
  }, [ouvert, options]);

  async function confirmer() {
    if (!journee || !choix) return;
    let documentChoisi: DocumentJourneeChoix | null = null;
    if (choix === "bleue" && journee.fiche_bleue_id != null) {
      documentChoisi = {
        type: "bleue",
        id: journee.fiche_bleue_id,
        label: journee.fiche_bleue_reference ?? "Fiche Bleue",
      };
    } else if (choix === "depot") {
      documentChoisi = {
        type: "depot",
        references: depots.map((d) => d.reference),
        label: "Fiches de dépôt",
      };
    } else if (choix === "execution" && journee.fiche_execution_id != null) {
      documentChoisi = {
        type: "execution",
        id: journee.fiche_execution_id,
        label: journee.fiche_execution_reference ?? "Fiche d'exécution",
      };
    }
    if (!documentChoisi) return;
    setEnCours(true);
    try {
      await onConfirmer(documentChoisi);
      onClose();
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Dialog
      open={ouvert}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            {titre}
          </DialogTitle>
          <DialogDescription>
            {journee ? `${description} (${journee.reference})` : description}
          </DialogDescription>
        </DialogHeader>

        {chargementDepots ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Chargement des documents…
          </div>
        ) : options.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            Aucun document disponible pour cette journée.
          </p>
        ) : (
          <RadioGroup value={choix} onValueChange={setChoix} className="gap-2">
            {options.map((o) => (
              <Label
                key={o.valeur}
                htmlFor={`doc-${o.valeur}`}
                className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <RadioGroupItem id={`doc-${o.valeur}`} value={o.valeur} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">{o.label}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {o.detail}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        )}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={enCours}>
            Annuler
          </Button>
          <Button
            type="button"
            className="gap-1.5"
            disabled={enCours || options.length === 0 || !choix}
            onClick={() => void confirmer()}
          >
            {enCours ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Printer className="size-3.5" />
            )}
            {libelleConfirmer}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
