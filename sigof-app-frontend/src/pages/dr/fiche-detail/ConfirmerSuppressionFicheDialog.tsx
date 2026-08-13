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
} from "@/components/ui/alert-dialog";

interface ConfirmerSuppressionFicheDialogProps {
  ouvert: boolean;
  reference: string;
  suppressionEnCours: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmer: () => void;
}

export function ConfirmerSuppressionFicheDialog({
  ouvert,
  reference,
  suppressionEnCours,
  onOpenChange,
  onConfirmer,
}: ConfirmerSuppressionFicheDialogProps) {
  return (
    <AlertDialog open={ouvert} onOpenChange={onOpenChange}>
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Supprimer cette fiche de dépôt ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est définitive et ne peut pas être annulée. Les mouvements, l'historique
            et le fichier Excel de la fiche{" "}
            <span className="font-mono font-semibold">{reference}</span> seront supprimés.
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
