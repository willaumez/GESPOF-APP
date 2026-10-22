import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { libelleDateJournee } from "@/portails/Sp/components/archives/archives-affichage";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

interface DialogSupprimerJourneeProps {
  journee: JourneeTresorerie | null;
  chargement: boolean;
  onOpenChange: (ouvert: boolean) => void;
  onConfirmer: () => void;
}

export function DialogSupprimerJournee({
  journee,
  chargement,
  onOpenChange,
  onConfirmer,
}: DialogSupprimerJourneeProps) {
  return (
    <AlertDialog open={!!journee} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Supprimer cette journée de trésorerie ?</AlertDialogTitle>
          <AlertDialogDescription>
            La journée{" "}
            <span className="font-mono font-semibold">{journee?.reference}</span>
            {journee ? ` (${libelleDateJournee(journee.reference)})` : ""} sera
            définitivement effacée, ainsi que la Fiche Bleue, la Fiche d&apos;exécution
            et les fiches de dépôt reçues qui y sont rattachées. Cette action ne
            peut pas être annulée.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={chargement}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={chargement}
            onClick={(e) => {
              e.preventDefault();
              onConfirmer();
            }}
          >
            {chargement && <Loader2 className="size-3.5 animate-spin" />}
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
