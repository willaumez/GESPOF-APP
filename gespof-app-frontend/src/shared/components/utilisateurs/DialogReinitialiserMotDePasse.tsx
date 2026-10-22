import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { requeteApi } from "@/shared/lib/api";
import { UTILISATEURS_ENDPOINT } from "@/shared/api/utilisateurs";
import type { Utilisateur } from "@/shared/types/utilisateur.interface";
import { Button } from "@/shared/components/ui/button";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogMedia,
} from "@/shared/components/ui/alert-dialog";

interface DialogReinitialiserMotDePasseProps {
  utilisateur: Utilisateur;
  onClose: () => void;
  onReinitialise: () => void;
}

/**
 * Confirmation puis affichage à usage unique du mot de passe temporaire généré.
 * `mdp` (état local, non un effet) fait basculer le contenu du dialogue de la
 * confirmation vers l'affichage du résultat une fois la réinitialisation faite.
 */
export function DialogReinitialiserMotDePasse({ utilisateur, onClose, onReinitialise }: DialogReinitialiserMotDePasseProps) {
  const [mdp, setMdp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copie, setCopie] = useState(false);

  async function confirmer() {
    setLoading(true);
    try {
      const res = await requeteApi<{ ok: boolean; mot_de_passe_temporaire: string }>(
        `${UTILISATEURS_ENDPOINT}/${utilisateur.id}/reinitialiser-mot-de-passe`,
        { method: "POST" },
      );
      setMdp(res.mot_de_passe_temporaire);
      onReinitialise();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la réinitialisation.");
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function copier() {
    if (!mdp) return;
    try {
      await navigator.clipboard.writeText(mdp);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.error("Impossible de copier le mot de passe.");
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => { if (!o && !mdp) onClose(); }}>
      <AlertDialogContent>
        {mdp ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-accent/10 text-accent">
                <Check />
              </AlertDialogMedia>
              <AlertDialogTitle>Nouveau mot de passe généré</AlertDialogTitle>
              <AlertDialogDescription>
                Pour {utilisateur.prenom} {utilisateur.nom}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                <span className="select-all break-all font-mono text-lg font-bold tracking-wide text-foreground">
                  {mdp}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={copier} className="shrink-0 gap-1.5">
                  {copie ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copie ? "Copié" : "Copier"}
                </Button>
              </div>
              <p className="flex items-start gap-1.5 text-[12px] text-destructive">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                Ce mot de passe ne sera plus jamais affiché. Communiquez-le à l'utilisateur maintenant.
              </p>
            </div>
            <AlertDialogFooter>
              <Button onClick={onClose}>Terminé</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-primary/10 text-primary">
                <KeyRound />
              </AlertDialogMedia>
              <AlertDialogTitle>Réinitialiser le mot de passe ?</AlertDialogTitle>
              <AlertDialogDescription>
                Un nouveau mot de passe temporaire sera généré pour {utilisateur.prenom} {utilisateur.nom}.
                L'ancien mot de passe ne fonctionnera plus.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
              <Button onClick={confirmer} disabled={loading} className="gap-1.5">
                {loading && <Loader2 className="size-3.5 animate-spin" />}
                Réinitialiser
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
