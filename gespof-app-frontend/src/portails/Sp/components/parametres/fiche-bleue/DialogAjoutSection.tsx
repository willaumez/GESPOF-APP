import { useState } from "react";
import type { ReactNode } from "react";
import { CornerDownRight, Library, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { creerSectionBibliotheque } from "@/portails/Sp/api/bibliotheque-sections";
import type {
  NouvelleSousSectionPayload, TypeSectionBibliotheque,
} from "@/portails/Sp/types/bibliotheque.interface";
import { TYPES_SECTION_BIBLIOTHEQUE } from "@/portails/Sp/types/bibliotheque.interface";
import { CLASSE_ARBRE_SOUS_SECTION } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";

/**
 * Nœud local d'édition : comme dans le modèle Fiche Bleue, une sous-section
 * peut elle-même contenir des sous-sections, à n'importe quelle profondeur.
 */
interface NoeudSection {
  cle: string;
  libelle: string;
  sousSections: NoeudSection[];
}

let compteurCles = 0;
function nouveauNoeud(): NoeudSection {
  compteurCles += 1;
  return { cle: `n${compteurCles}`, libelle: "", sousSections: [] };
}

/** Applique `fn` au nœud portant `cle`, à n'importe quelle profondeur. */
function majNoeud(
  noeuds: NoeudSection[],
  cle: string,
  fn: (noeud: NoeudSection) => NoeudSection,
): NoeudSection[] {
  return noeuds.map((noeud) => {
    if (noeud.cle === cle) return fn(noeud);
    return { ...noeud, sousSections: majNoeud(noeud.sousSections, cle, fn) };
  });
}

/** Retire le nœud portant `cle` (et toute sa descendance). */
function retirerNoeud(noeuds: NoeudSection[], cle: string): NoeudSection[] {
  return noeuds
    .filter((noeud) => noeud.cle !== cle)
    .map((noeud) => ({ ...noeud, sousSections: retirerNoeud(noeud.sousSections, cle) }));
}

/** Vraie si un nœud (à n'importe quelle profondeur) n'a pas de libellé. */
function libelleManquant(noeuds: NoeudSection[]): boolean {
  return noeuds.some(
    (noeud) => noeud.libelle.trim() === "" || libelleManquant(noeud.sousSections),
  );
}

function versPayload(noeuds: NoeudSection[]): NouvelleSousSectionPayload[] {
  return noeuds.map((noeud) => ({
    libelle: noeud.libelle.trim(),
    sous_sections: versPayload(noeud.sousSections),
  }));
}

interface DialogAjoutSectionProps {
  onClose: () => void;
  /** Recharge la bibliothèque après la création. */
  onCreee: () => Promise<void> | void;
}

/**
 * Création d'une section de la bibliothèque avec son arborescence complète de
 * sous-sections (récursive, comme le modèle Fiche Bleue) : tout est envoyé au
 * backend en une seule requête.
 */
export function DialogAjoutSection({ onClose, onCreee }: DialogAjoutSectionProps) {
  const [libelle, setLibelle] = useState("");
  const [type, setType] = useState<TypeSectionBibliotheque>("recette");
  const [sousSections, setSousSections] = useState<NoeudSection[]>([]);
  const [enregistrement, setEnregistrement] = useState(false);

  async function enregistrer() {
    const nom = libelle.trim();
    if (nom === "") {
      toast.error("Donnez un libellé à la section.");
      return;
    }
    if (libelleManquant(sousSections)) {
      toast.error("Toutes les sous-sections doivent avoir un libellé.");
      return;
    }

    setEnregistrement(true);
    try {
      await creerSectionBibliotheque({
        libelle: nom,
        type,
        sous_sections: versPayload(sousSections),
      });
      toast.success(
        sousSections.length > 0
          ? "Section et sous-sections ajoutées à la bibliothèque."
          : "Section ajoutée à la bibliothèque.",
      );
      await onCreee();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'ajout de la section.");
    } finally {
      setEnregistrement(false);
    }
  }

  /** Ligne éditable d'une sous-section : libellé, ajout d'enfant, retrait. */
  const ligneNoeud = (noeud: NoeudSection, profondeur: number) => (
    <div className="flex items-center gap-2">
      <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
      <Input
        value={noeud.libelle}
        onChange={(e) =>
          setSousSections((prev) =>
            majNoeud(prev, noeud.cle, (n) => ({ ...n, libelle: e.target.value })),
          )
        }
        placeholder={`Sous-section (niveau ${profondeur})`}
        className="h-8 text-[12.5px]"
        disabled={enregistrement}
        autoFocus
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground"
        aria-label="Ajouter une sous-section à ce niveau"
        title="Ajouter une sous-sous-section"
        disabled={enregistrement}
        onClick={() =>
          setSousSections((prev) =>
            majNoeud(prev, noeud.cle, (n) => ({
              ...n,
              sousSections: [...n.sousSections, nouveauNoeud()],
            })),
          )
        }
      >
        <Plus className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label="Retirer cette sous-section"
        title={
          noeud.sousSections.length > 0
            ? "Retirer (et ses sous-sections)"
            : "Retirer"
        }
        disabled={enregistrement}
        onClick={() => setSousSections((prev) => retirerNoeud(prev, noeud.cle))}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );

  /** Arbre récursif des sous-sections en cours de saisie. */
  const arbreNoeud = (noeud: NoeudSection, profondeur: number): ReactNode => (
    <div key={noeud.cle} className="space-y-1.5">
      {ligneNoeud(noeud, profondeur)}
      {noeud.sousSections.length > 0 && (
        <div className={CLASSE_ARBRE_SOUS_SECTION}>
          {noeud.sousSections.map((enfant) => arbreNoeud(enfant, profondeur + 1))}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="pr-10">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Library className="size-4" />
            </span>
            <div>
              <DialogTitle>Nouvelle section</DialogTitle>
              <DialogDescription>
                La section et toute son arborescence de sous-sections seront
                réutilisables dans les Fiches Bleues.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="libelle-nouvelle-section">Libellé de la section</Label>
              <Input
                id="libelle-nouvelle-section"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                placeholder={
                  type === "solde"
                    ? "Ex. SOLDES BANCAIRES D'OUVERTURE"
                    : type === "depense"
                      ? "Ex. DEPENSES EN ATTENTE DE DEBITS"
                      : "Ex. RECETTES EN COURS D'ENCAISSEMENT"
                }
                disabled={enregistrement}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type-nouvelle-section">Type de section</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as TypeSectionBibliotheque)}
                disabled={enregistrement}
              >
                <SelectTrigger id="type-nouvelle-section" className="w-full">
                  <SelectValue placeholder="Choisir un type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_SECTION_BIBLIOTHEQUE.map((t) => (
                    <SelectItem key={t.valeur} value={t.valeur}>
                      {t.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {type === "solde" && (
                <p className="text-[11px] text-muted-foreground">
                  Les sections Solde serviront d'en-tête (une seule par Fiche Bleue).
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Sous-sections liées</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1"
                disabled={enregistrement}
                onClick={() => setSousSections((prev) => [...prev, nouveauNoeud()])}
              >
                <Plus className="size-3.5" />
                Ajouter
              </Button>
            </div>

            {sousSections.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[12px] text-muted-foreground">
                Aucune sous-section : la section sera créée seule. Chaque
                sous-section pourra elle-même contenir des sous-sections
                (bouton « + » sur sa ligne).
              </p>
            ) : (
              <div className="max-h-[50vh] space-y-1.5 overflow-y-auto rounded-lg border p-3 pr-2">
                {sousSections.map((noeud) => arbreNoeud(noeud, 1))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={enregistrement} onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" className="gap-1.5" disabled={enregistrement} onClick={() => void enregistrer()}>
            {enregistrement && <Loader2 className="size-3.5 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
