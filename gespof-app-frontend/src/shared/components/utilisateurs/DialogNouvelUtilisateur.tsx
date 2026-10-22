import { useState } from "react";
import type { FormEvent } from "react";
import { Check, Copy, Eye, EyeOff, Loader2, TriangleAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ErreurApi, requeteApi } from "@/shared/lib/api";
import { UTILISATEURS_ENDPOINT } from "@/shared/api/utilisateurs";
import { cn } from "@/shared/lib/utils";
import type { grouperMetiers } from "@/shared/lib/metiers";
import type { RoleUtilisateur } from "@/shared/hooks/auth-context";
import type { Acces } from "@/shared/lib/acces";
import type { UtilisateurCree } from "@/shared/types/utilisateur.interface";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/shared/components/ui/select";
import { ApercuMetier } from "./ApercuMetier";
import { PanneauHabilitations } from "./PanneauHabilitations";
import { accesParDefaut, basculerAcces, metierAHabilitations } from "./habilitations-utils";

type ModeMdp = "auto" | "manuel";
type ErreursCreation = Partial<Record<
  "matricule" | "email" | "nom" | "prenom" | "metier" | "mdp" | "mdpConfirmation" | "general", string
>>;

/** Même format que le backend (`bin2hex(random_bytes(5))`) — 10 caractères hex. */
function genererMotDePasseTemporaire(): string {
  const octets = new Uint8Array(5);
  crypto.getRandomValues(octets);
  return Array.from(octets, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface DialogNouvelUtilisateurProps {
  groupesMetiers: ReturnType<typeof grouperMetiers>;
  metierParDefaut: RoleUtilisateur | "";
  estAdministrateur: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Dialogue "Nouvel utilisateur" — l'admin choisit UN SEUL métier ; le portail
 * et les actions autorisées en découlent automatiquement (ApercuMetier),
 * jamais saisis manuellement.
 *
 * Ce composant n'est monté par le parent que pendant que le dialogue est
 * ouvert (voir GestionUtilisateurs) : son état local part donc toujours d'un
 * formulaire vierge sans avoir besoin d'un effet de réinitialisation.
 */
export function DialogNouvelUtilisateur({
  groupesMetiers, metierParDefaut, estAdministrateur, onClose, onCreated,
}: DialogNouvelUtilisateurProps) {
  const [matricule, setMatricule] = useState("");
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [metier, setMetier] = useState<RoleUtilisateur | "">(metierParDefaut);
  // Accès accordés à ce compte : pré-remplis avec ceux du métier, l'administrateur
  // peut ensuite en décocher (voir la colonne `utilisateur.acces` côté backend).
  const [acces, setAcces] = useState<Acces[]>(() => accesParDefaut(metierParDefaut));
  const [modeMdp, setModeMdp] = useState<ModeMdp>("auto");
  const [mdpAuto] = useState(() => genererMotDePasseTemporaire());
  const [mdp, setMdp] = useState("");
  const [mdpConfirmation, setMdpConfirmation] = useState("");
  const [voirMdp, setVoirMdp] = useState(false);
  const [erreurs, setErreurs] = useState<ErreursCreation>({});
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<UtilisateurCree | null>(null);
  const [copie, setCopie] = useState(false);

  const avecHabilitations = estAdministrateur && metierAHabilitations(metier);
  const mdpAffiche = created?.mot_de_passe_temporaire ?? (modeMdp === "auto" ? mdpAuto : null);

  async function copierMotDePasse() {
    if (!mdpAffiche) return;
    try {
      await navigator.clipboard.writeText(mdpAffiche);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.error("Impossible de copier le mot de passe.");
    }
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    const nouvellesErreurs: ErreursCreation = {};
    if (!matricule.trim()) nouvellesErreurs.matricule = "Le matricule est requis.";
    if (!email.trim())     nouvellesErreurs.email     = "L'email est requis.";
    if (!nom.trim())       nouvellesErreurs.nom        = "Le nom est requis.";
    if (!prenom.trim())    nouvellesErreurs.prenom     = "Le prénom est requis.";
    if (!metier)           nouvellesErreurs.metier     = "Sélectionnez un métier.";
    if (modeMdp === "manuel") {
      if (mdp.length < 8) nouvellesErreurs.mdp = "Le mot de passe doit contenir au moins 8 caractères.";
      else if (mdp !== mdpConfirmation) nouvellesErreurs.mdpConfirmation = "Les mots de passe ne correspondent pas.";
    }
    if (Object.keys(nouvellesErreurs).length > 0) { setErreurs(nouvellesErreurs); return; }

    setErreurs({});
    setLoading(true);
    try {
      const res = await requeteApi<UtilisateurCree>(UTILISATEURS_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          matricule: matricule.trim(), email: email.trim(),
          nom: nom.trim(), prenom: prenom.trim(), metier,
          // En auto, on envoie le MDP déjà affiché dans la carte pour qu'il soit celui réellement créé.
          mot_de_passe: modeMdp === "manuel" ? mdp : mdpAuto,
          ...(estAdministrateur ? { acces } : {}),
        }),
      });
      setCreated({
        ...res,
        mot_de_passe_temporaire:
          res.mot_de_passe_temporaire ?? (modeMdp === "auto" ? mdpAuto : undefined),
      });
      onCreated();
    } catch (e) {
      if (e instanceof ErreurApi && (e.status === 409 || e.status === 400)) {
        const msg = e.message.toLowerCase();
        if (msg.includes("matricule")) setErreurs({ matricule: e.message });
        else if (msg.includes("email")) setErreurs({ email: e.message });
        else if (msg.includes("mot de passe")) setErreurs({ mdp: e.message });
        else if (msg.includes("metier") || msg.includes("métier")) setErreurs({ metier: e.message });
        else setErreurs({ general: e.message });
      } else {
        toast.error(e instanceof Error ? e.message : "Erreur lors de la création.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && created) return; if (!o) onClose(); }}>
      <DialogContent
        showCloseButton={!created}
        className={cn("sm:max-w-xl", !created && avecHabilitations && "sm:max-w-4xl")}
      >
        {created ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/15">
                  <Check className="size-4" />
                </span>
                <div>
                  <DialogTitle>Utilisateur créé</DialogTitle>
                  <DialogDescription>
                    {created.prenom} {created.nom} ({created.matricule})
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            {created.mot_de_passe_temporaire ? (
              <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12.5px] text-destructive">
                  <TriangleAlert className="size-3.5 shrink-0" />
                  <span>Mot de passe par défaut :</span>
                  <span className="select-all font-mono text-[14px] font-bold tracking-wide text-foreground">
                    {created.mot_de_passe_temporaire}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copierMotDePasse}
                    className="h-7 shrink-0 gap-1.5 px-2.5"
                  >
                    {copie ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copie ? "Copié" : "Copier"}
                  </Button>
                </p>
                <p className="text-[11.5px] text-muted-foreground">
                  Il ne sera plus jamais affiché. Communiquez-le à l&apos;utilisateur maintenant.
                </p>
              </div>
            ) : (
              <p className="rounded-lg border bg-muted/40 px-4 py-3 text-[12.5px] text-muted-foreground">
                Le mot de passe que vous avez défini est actif dès maintenant.
              </p>
            )}
            <DialogFooter>
              <Button onClick={onClose}>Terminé</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={soumettre}>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <UserPlus className="size-4" />
                </span>
                <div>
                  <DialogTitle>Nouvel utilisateur</DialogTitle>
                  <DialogDescription>Choisissez un métier : le portail et les autorisations sont attribués automatiquement.</DialogDescription>
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
                    <Label htmlFor="us-matricule">Matricule</Label>
                    <Input id="us-matricule" value={matricule} onChange={(e) => setMatricule(e.target.value)} disabled={loading} />
                    {erreurs.matricule && <p className="text-[12px] text-destructive">{erreurs.matricule}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="us-email">Email</Label>
                    <Input id="us-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
                    {erreurs.email && <p className="text-[12px] text-destructive">{erreurs.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="us-nom">Nom</Label>
                    <Input id="us-nom" value={nom} onChange={(e) => setNom(e.target.value)} disabled={loading} />
                    {erreurs.nom && <p className="text-[12px] text-destructive">{erreurs.nom}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="us-prenom">Prénom</Label>
                    <Input id="us-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} disabled={loading} />
                    {erreurs.prenom && <p className="text-[12px] text-destructive">{erreurs.prenom}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="us-metier">Métier</Label>
                  <Select
                    value={metier}
                    onValueChange={(v) => { setMetier(v as RoleUtilisateur); setAcces(accesParDefaut(v as RoleUtilisateur)); }}
                    disabled={loading}
                  >
                    <SelectTrigger id="us-metier" className="w-full">
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

                <div className="space-y-1.5">
                  <Label>Mot de passe</Label>
                  <RadioGroup
                    value={modeMdp}
                    onValueChange={(v) => setModeMdp(v as ModeMdp)}
                    className="grid-cols-2 gap-2"
                  >
                    <label
                      htmlFor="mdp-auto"
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors",
                        modeMdp === "auto" ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/50"
                      )}
                    >
                      <RadioGroupItem value="auto" id="mdp-auto" className="mt-0.5" disabled={loading} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-semibold text-foreground">Génération automatique</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span>Mot de passe temporaire généré</span>
                          <span className="select-all font-mono text-[12px] font-bold tracking-wide text-foreground">
                            {mdpAuto}
                          </span>
                        </span>
                      </span>
                    </label>
                    <label
                      htmlFor="mdp-manuel"
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors",
                        modeMdp === "manuel" ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/50"
                      )}
                    >
                      <RadioGroupItem value="manuel" id="mdp-manuel" className="mt-0.5" disabled={loading} />
                      <span>
                        <span className="block text-[12.5px] font-semibold text-foreground">Définir moi-même</span>
                        <span className="block text-[11px] text-muted-foreground">Vous choisissez le mot de passe</span>
                      </span>
                    </label>
                  </RadioGroup>
                </div>

                {modeMdp === "manuel" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="us-mdp">Mot de passe</Label>
                      <div className="relative">
                        <Input
                          id="us-mdp"
                          type={voirMdp ? "text" : "password"}
                          value={mdp}
                          onChange={(e) => setMdp(e.target.value)}
                          disabled={loading}
                          className="pr-9"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setVoirMdp((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {voirMdp ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                      </div>
                      {erreurs.mdp && <p className="text-[12px] text-destructive">{erreurs.mdp}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="us-mdp-confirm">Confirmer</Label>
                      <Input
                        id="us-mdp-confirm"
                        type={voirMdp ? "text" : "password"}
                        value={mdpConfirmation}
                        onChange={(e) => setMdpConfirmation(e.target.value)}
                        disabled={loading}
                        autoComplete="new-password"
                      />
                      {erreurs.mdpConfirmation && <p className="text-[12px] text-destructive">{erreurs.mdpConfirmation}</p>}
                    </div>
                  </div>
                )}

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
                Créer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
