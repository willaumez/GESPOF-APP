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
import type { LigneMouvement } from "@/portails/Sr/types";

interface ConfirmerSuppressionLigneDialogProps {
  ligne: { famille: "numeraire" | "sigma"; ligne: LigneMouvement } | null;
  suppressionEnCours: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmer: () => void;
}

export function ConfirmerSuppressionLigneDialog({
  ligne,
  suppressionEnCours,
  onOpenChange,
  onConfirmer,
}: ConfirmerSuppressionLigneDialogProps) {
  return (
    <AlertDialog open={ligne !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Supprimer cette ligne ?</AlertDialogTitle>
          <AlertDialogDescription>
            La ligne <span className="font-semibold">{ligne?.ligne.beneficiaire}</span> sera
            définitivement supprimée.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={suppressionEnCours}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirmer}
            disabled={suppressionEnCours}
          >
            {suppressionEnCours && <Loader2 className="size-3.5 animate-spin" />}
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
