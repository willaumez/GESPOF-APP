import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { requeteApi } from "@/shared/lib/api";
import { UTILISATEURS_ENDPOINT } from "@/shared/api/utilisateurs";
import type { Utilisateur } from "@/shared/types/utilisateur.interface";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
  AlertDialogMedia,
} from "@/shared/components/ui/alert-dialog";

interface DialogSupprimerUtilisateurProps {
  utilisateur: Utilisateur;
  onClose: () => void;
  onSupprime: () => void;
}

/** Confirmation de suppression définitive — le backend la refuse si le compte a de l'activité. */
export function DialogSupprimerUtilisateur({ utilisateur, onClose, onSupprime }: DialogSupprimerUtilisateurProps) {
  const [loading, setLoading] = useState(false);

  async function confirmer() {
    setLoading(true);
    try {
      await requeteApi<{ ok: boolean }>(`${UTILISATEURS_ENDPOINT}/${utilisateur.id}`, { method: "DELETE" });
      toast.success(`${utilisateur.prenom} ${utilisateur.nom} a été supprimé(e) définitivement.`);
      onSupprime();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la suppression.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => { if (!o && !loading) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Supprimer définitivement cet utilisateur ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le compte de {utilisateur.prenom} {utilisateur.nom} sera supprimé définitivement de la base.
            Cette action est irréversible. Si cet utilisateur a des données associées,
            la suppression sera refusée — désactivez-le plutôt dans ce cas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={loading} onClick={confirmer}>
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
