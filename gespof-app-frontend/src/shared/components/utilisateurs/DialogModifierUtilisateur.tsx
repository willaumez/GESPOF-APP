import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ErreurApi, requeteApi } from "@/shared/lib/api";
import { UTILISATEURS_ENDPOINT } from "@/shared/api/utilisateurs";
import { cn } from "@/shared/lib/utils";
import type { grouperMetiers } from "@/shared/lib/metiers";
import type { RoleUtilisateur } from "@/shared/hooks/auth-context";
import type { Acces } from "@/shared/lib/acces";
import type { Utilisateur } from "@/shared/types/utilisateur.interface";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/shared/components/ui/select";
import { ApercuMetier } from "./ApercuMetier";
import { PanneauHabilitations } from "./PanneauHabilitations";
import { accesParDefaut, basculerAcces, metierAHabilitations } from "./habilitations-utils";

type ErreursModification = Partial<Record<
  "matricule" | "email" | "nom" | "prenom" | "metier" | "general", string
>>;

interface DialogModifierUtilisateurProps {
  utilisateur: Utilisateur;
  groupesMetiers: ReturnType<typeof grouperMetiers>;
  estAdministrateur: boolean;
  onClose: () => void;
  onModifie: () => void;
}

/**
 * Dialogue "Modifier l'utilisateur". Le parent monte ce composant avec
 * `key={utilisateur.id}` uniquement pendant l'édition (voir
 * GestionUtilisateurs) : l'état local part donc toujours des valeurs actuelles
 * de `utilisateur`, sans avoir besoin d'un effet de synchronisation.
 */
export function DialogModifierUtilisateur({
  utilisateur, groupesMetiers, estAdministrateur, onClose, onModifie,
}: DialogModifierUtilisateurProps) {
  const [matricule, setMatricule] = useState(utilisateur.matricule);
  const [email, setEmail] = useState(utilisateur.email);
  const [nom, setNom] = useState(utilisateur.nom);
  const [prenom, setPrenom] = useState(utilisateur.prenom);
  const [genre, setGenre] = useState<"homme" | "femme" | "">(
    utilisateur.genre ?? "",
  );
  const [metier, setMetier] = useState<RoleUtilisateur | "">(
    (utilisateur.roles[0]?.valeur as RoleUtilisateur) ?? "",
  );
  // Accès actuellement accordés à ce compte (colonne `utilisateur.acces`) : les cases
  // cochées du panneau d'habilitations.
  const [acces, setAcces] = useState<Acces[]>(
    utilisateur.acces.map((a) => a.valeur) as Acces[],
  );
  const [erreurs, setErreurs] = useState<ErreursModification>({});
  const [loading, setLoading] = useState(false);

  const avecHabilitations = estAdministrateur && metierAHabilitations(metier);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    const nouvellesErreurs: ErreursModification = {};
    if (!matricule.trim()) nouvellesErreurs.matricule = "Le matricule est requis.";
    if (!email.trim())     nouvellesErreurs.email     = "L'email est requis.";
    if (!nom.trim())       nouvellesErreurs.nom        = "Le nom est requis.";
    if (!prenom.trim())    nouvellesErreurs.prenom     = "Le prénom est requis.";
    if (!metier)           nouvellesErreurs.metier     = "Sélectionnez un métier.";
    if (Object.keys(nouvellesErreurs).length > 0) { setErreurs(nouvellesErreurs); return; }

    setErreurs({});
    setLoading(true);
    try {
      await requeteApi(`${UTILISATEURS_ENDPOINT}/${utilisateur.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          matricule: matricule.trim(),
          email: email.trim(),
          nom: nom.trim(),
          prenom: prenom.trim(),
          genre: genre || null,
          metier,
          ...(estAdministrateur ? { acces } : {}),
        }),
      });
      toast.success("Utilisateur modifié avec succès.");
      onModifie();
      onClose();
    } catch (e) {
      if (e instanceof ErreurApi && (e.status === 409 || e.status === 400 || e.status === 403)) {
        const msg = e.message.toLowerCase();
        if (msg.includes("matricule")) setErreurs({ matricule: e.message });
        else if (msg.includes("email")) setErreurs({ email: e.message });
        else if (msg.includes("metier") || msg.includes("métier")) setErreurs({ metier: e.message });
        else setErreurs({ general: e.message });
      } else {
        toast.error(e instanceof Error ? e.message : "Erreur lors de la modification.");
        onClose();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("sm:max-w-lg", avecHabilitations && "sm:max-w-3xl")}>
        <form onSubmit={soumettre}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <Pencil className="size-4" />
              </span>
              <div>
                <DialogTitle>Modifier l'utilisateur</DialogTitle>
                <DialogDescription>
                  {utilisateur.prenom} {utilisateur.nom}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div
            className={cn(
              "grid gap-x-6 gap-y-4 py-3",
              avecHabilitations && "sm:grid-cols-[minmax(0,1fr)_18rem]",
            )}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="us-edit-matricule">Matricule</Label>
                  <Input
                    id="us-edit-matricule"
                    value={matricule}
                    onChange={(e) => setMatricule(e.target.value)}
                    disabled={loading}
                  />
                  {erreurs.matricule && <p className="text-[12px] text-destructive">{erreurs.matricule}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="us-edit-email">Email</Label>
                  <Input
                    id="us-edit-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                  {erreurs.email && <p className="text-[12px] text-destructive">{erreurs.email}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="us-edit-nom">Nom</Label>
                  <Input id="us-edit-nom" value={nom} onChange={(e) => setNom(e.target.value)} disabled={loading} />
                  {erreurs.nom && <p className="text-[12px] text-destructive">{erreurs.nom}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="us-edit-prenom">Prénom</Label>
                  <Input id="us-edit-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} disabled={loading} />
                  {erreurs.prenom && <p className="text-[12px] text-destructive">{erreurs.prenom}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="us-edit-genre">Genre</Label>
                <Select
                  value={genre || "__none__"}
                  onValueChange={(v) => setGenre(v === "__none__" ? "" : (v as "homme" | "femme"))}
                  disabled={loading}
                >
                  <SelectTrigger id="us-edit-genre" className="w-full">
                    <SelectValue placeholder="Non renseigné" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Non renseigné</SelectItem>
                    <SelectItem value="homme">Homme</SelectItem>
                    <SelectItem value="femme">Femme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="us-edit-metier">Métier</Label>
                <Select
                  value={metier}
                  onValueChange={(v) => { setMetier(v as RoleUtilisateur); setAcces(accesParDefaut(v as RoleUtilisateur)); }}
                  disabled={loading}
                >
                  <SelectTrigger id="us-edit-metier" className="w-full">
                    <SelectValue placeholder="Sélectionner un métier" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupesMetiers.map((g) => (
                      <SelectGroup key={g.groupe}>
                        <SelectLabel>{g.groupe}</SelectLabel>
                        {g.metiers.map((m) => (
                          <SelectItem key={m.metier} value={m.metier}>{m.libelle}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {erreurs.metier && <p className="text-[12px] text-destructive">{erreurs.metier}</p>}
                <ApercuMetier metier={metier} />
              </div>
              {erreurs.general && <p className="text-[12px] text-destructive">{erreurs.general}</p>}
            </div>

            {avecHabilitations && (
              <PanneauHabilitations
                key={metier}
                metier={metier}
                acces={acces}
                onBasculer={(code) => setAcces((prev) => basculerAcces(prev, code))}
                disabled={loading}
              />
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
