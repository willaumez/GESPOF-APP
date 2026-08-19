import { useState } from "react";
import type { FormEvent } from "react";
import { FileText, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ErreurApi } from "@/shared/lib/api";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { creerMaquette, modifierMaquette } from "@/portails/Sp/api/maquettes";
import type { MaquetteDetail, SectionMaquette } from "@/portails/Sp/types/maquette.interface";
import { EditeurSections } from "./EditeurSections";
import {
  sectionsDepuisApi, validerMaquette, versPayload, type SectionEdition,
} from "./maquette-edition";

interface DialogMaquetteProps {
  /** null = creation, sinon modification de la maquette chargee. */
  maquette: MaquetteDetail | null;
  catalogue: SectionMaquette[];
  onClose: () => void;
  onEnregistre: () => void;
}

/**
 * Creation / modification d'une maquette de Fiche Bleue. Le parent ne monte ce
 * composant que pendant l'edition : l'etat local part donc toujours des valeurs
 * a editer, sans effet de synchronisation.
 */
export function DialogMaquette({
  maquette, catalogue, onClose, onEnregistre,
}: DialogMaquetteProps) {
  const modification = maquette !== null;

  const [nom, setNom] = useState(maquette?.nom ?? "");
  const [description, setDescription] = useState(maquette?.description ?? "");
  const [actif, setActif] = useState(maquette?.actif ?? true);
  // A la creation, la nouvelle maquette est proposee comme maquette par defaut
  // (l'utilisateur peut decocher) ; le backend retire alors le statut a l'ancienne.
  const [estParDefaut, setEstParDefaut] = useState(maquette?.est_par_defaut ?? true);
  const [sections, setSections] = useState<SectionEdition[]>(
    maquette ? sectionsDepuisApi(maquette.sections) : [],
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();

    const probleme = validerMaquette(nom, sections);
    if (probleme !== null) {
      setErreur(probleme);
      return;
    }

    setErreur(null);
    setLoading(true);
    try {
      const payload = versPayload({ nom, description, actif, estParDefaut }, sections);
      if (maquette) {
        await modifierMaquette(maquette.id, payload);
        toast.success("Maquette modifiée.");
      } else {
        await creerMaquette(payload);
        toast.success("Maquette créée.");
      }
      onEnregistre();
      onClose();
    } catch (e) {
      if (e instanceof ErreurApi && (e.status === 400 || e.status === 403 || e.status === 404)) {
        setErreur(e.message);
      } else {
        toast.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="sm:max-w-5xl">
        <form onSubmit={soumettre}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                {modification ? <Pencil className="size-4" /> : <FileText className="size-4" />}
              </span>
              <div>
                <DialogTitle>
                  {modification ? "Modifier la maquette" : "Nouvelle maquette"}
                </DialogTitle>
                <DialogDescription>
                  Structure réutilisée pour rédiger les Fiches Bleues.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[75vh] space-y-4 overflow-y-auto py-3 pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="maquette-nom">Nom</Label>
                <Input
                  id="maquette-nom"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex. Fiche Bleue standard"
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maquette-description">Description</Label>
                <Textarea
                  id="maquette-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="À quoi sert cette maquette ?"
                  rows={2}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-2.5">
                <span>
                  <span className="block text-[12.5px] font-semibold text-foreground">Active</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Proposée lors de la création d'une fiche
                  </span>
                </span>
                <Switch checked={actif} onCheckedChange={setActif} disabled={loading} />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-2.5">
                <span>
                  <span className="block text-[12.5px] font-semibold text-foreground">Par défaut</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Retirée automatiquement à l'ancienne maquette par défaut
                  </span>
                </span>
                <Switch
                  checked={estParDefaut}
                  onCheckedChange={setEstParDefaut}
                  disabled={loading}
                />
              </label>
            </div>

            <EditeurSections
              sections={sections}
              onChange={setSections}
              catalogue={catalogue}
              disabled={loading}
            />

            {erreur && <p className="text-[12px] text-destructive">{erreur}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              {modification ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
