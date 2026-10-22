import { Ban } from "lucide-react";
import { toast } from "sonner";
import { requeteApi } from "@/shared/lib/api";
import { UTILISATEURS_ENDPOINT } from "@/shared/api/utilisateurs";
import type { Utilisateur } from "@/shared/types/utilisateur.interface";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
  AlertDialogMedia,
} from "@/shared/components/ui/alert-dialog";

interface DialogDesactiverUtilisateurProps {
  utilisateur: Utilisateur;
  onClose: () => void;
  onDesactive: () => void;
}

/** Confirmation de désactivation d'un compte — réversible, l'historique est conservé. */
export function DialogDesactiverUtilisateur({ utilisateur, onClose, onDesactive }: DialogDesactiverUtilisateurProps) {
  async function confirmer() {
    try {
      await requeteApi<{ ok: boolean }>(`${UTILISATEURS_ENDPOINT}/${utilisateur.id}/desactiver`, { method: "POST" });
      toast.success(`${utilisateur.prenom} ${utilisateur.nom} a été désactivé(e).`);
      onDesactive();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la désactivation.");
    } finally {
      onClose();
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Ban />
          </AlertDialogMedia>
          <AlertDialogTitle>Désactiver cet utilisateur ?</AlertDialogTitle>
          <AlertDialogDescription>
            Ce compte ({utilisateur.prenom} {utilisateur.nom}) ne pourra plus se connecter.
            Il ne s'agit pas d'une suppression : l'historique de l'utilisateur est conservé
            et le compte peut être réactivé à tout moment.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirmer}>
            Désactiver
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
