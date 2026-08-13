import { Loader2, Send } from "lucide-react";
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

interface ConfirmerEnvoiDialogProps {
  ouvert: boolean;
  reference: string;
  envoiEnCours: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmer: () => void;
}

export function ConfirmerEnvoiDialog({
  ouvert,
  reference,
  envoiEnCours,
  onOpenChange,
  onConfirmer,
}: ConfirmerEnvoiDialogProps) {
  return (
    <AlertDialog open={ouvert} onOpenChange={onOpenChange}>
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-[#1e4d8c]/10 text-[#1e4d8c]">
            <Send />
          </AlertDialogMedia>
          <AlertDialogTitle>Envoyer cette fiche de dépôt ?</AlertDialogTitle>
          <AlertDialogDescription>
            La fiche <span className="font-mono font-semibold">{reference}</span> sera marquée
            comme envoyée au Service de Prévision (SP).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={envoiEnCours}>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmer} disabled={envoiEnCours}>
            {envoiEnCours && <Loader2 className="size-3.5 animate-spin" />}
            Envoyer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
