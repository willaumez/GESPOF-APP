import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown, ArrowUp, Check, CornerDownRight, CornerLeftUp, FolderInput, GripVertical,
  Loader2, MoreVertical, Pencil, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { ErreurApi } from "@/shared/lib/api";
import { useAuth } from "@/shared/hooks/use-auth";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import {
  creerSectionBibliotheque, deplacerSectionBibliotheque, detailSectionBibliotheque,
  modifierSectionBibliotheque, supprimerSectionBibliotheque,
} from "@/portails/Sp/api/bibliotheque-sections";
import type {
  DeplacementSectionPayload, SectionBibliotheque, TypeSectionBibliotheque,
} from "@/portails/Sp/types/bibliotheque.interface";
import { TYPES_SECTION_BIBLIOTHEQUE } from "@/portails/Sp/types/bibliotheque.interface";
import {
  CLASSE_ARBRE_SOUS_SECTION,
  DECALAGE_SOUS_SECTION_PX,
} from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";

/** Date d'ajout à la bibliothèque, ex. "19/08/2026". */
function formaterDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

/** Cible possible du sous-menu "Déplacer dans…". */
interface CibleDeplacement {
  id: number;
  libelle: string;
  profondeur: number;
}

/**
 * Aplati l'arborescence en excluant la section `exclureId` et toute sa
 * descendance (une section ne peut pas être déplacée dans elle-même ni dans
 * l'une de ses sous-sections).
 */
function aplatirSauf(
  liste: SectionBibliotheque[],
  exclureId: number,
  profondeur = 0,
): CibleDeplacement[] {
  const cibles: CibleDeplacement[] = [];
  for (const section of liste) {
    if (section.id === exclureId) continue;
    cibles.push({ id: section.id, libelle: section.libelle, profondeur });
    cibles.push(...aplatirSauf(section.sous_sections, exclureId, profondeur + 1));
  }
  return cibles;
}

interface DialogModifierSectionProps {
  sectionId: number;
  onClose: () => void;
  /** Prévient la liste qu'une donnée a changé (rechargement silencieux). */
  onModifie: () => Promise<void> | void;
}

/**
 * Édition d'une section de la bibliothèque et de toute son arborescence :
 * renommage en ligne, ajout de sous-sections (à toute profondeur),
 * réordonnancement par glisser-déposer ou flèches (au sein du même parent),
 * rattachement à un autre parent et suppression (réservée au chef SP).
 */
export function DialogModifierSection({ sectionId, onClose, onModifie }: DialogModifierSectionProps) {
  const { hasRole } = useAuth();
  const peutSupprimer = hasRole("CHEF_SP");

  const [section, setSection] = useState<SectionBibliotheque | null>(null);
  const [erreur, setErreur] = useState(false);

  /** Libellés en cours d'édition, indexés par id de section. */
  const [brouillons, setBrouillons] = useState<Record<number, string>>({});
  const [enCours, setEnCours] = useState<number | null>(null);
  const [deplacementId, setDeplacementId] = useState<number | null>(null);
  const [typeEnCours, setTypeEnCours] = useState(false);

  const [parentAjout, setParentAjout] = useState<number | null>(null);
  const [nouvelleEnfant, setNouvelleEnfant] = useState("");
  const [creationEnCours, setCreationEnCours] = useState(false);

  const [aSupprimer, setASupprimer] = useState<SectionBibliotheque | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  /** Glisser-déposer, limité aux voisines de même parent. */
  const [enDrag, setEnDrag] = useState<{ id: number; parentId: number } | null>(null);
  const [survolDragId, setSurvolDragId] = useState<number | null>(null);

  const recharger = useCallback(() => {
    return detailSectionBibliotheque(sectionId)
      .then((data) => setSection(data.section))
      .catch(() => setErreur(true));
  }, [sectionId]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  /** Rechargement du détail + rafraîchissement silencieux de la liste. */
  async function synchroniser() {
    await recharger();
    await onModifie();
  }

  const valeur = (s: SectionBibliotheque): string => brouillons[s.id] ?? s.libelle;

  const estModifiee = (s: SectionBibliotheque): boolean =>
    brouillons[s.id] !== undefined && brouillons[s.id] !== s.libelle;

  async function enregistrer(s: SectionBibliotheque) {
    const libelle = valeur(s).trim();
    if (libelle === "") {
      toast.error("Le libellé ne peut pas être vide.");
      return;
    }
    setEnCours(s.id);
    try {
      await modifierSectionBibliotheque(s.id, { libelle });
      toast.success("Libellé mis à jour.");
      setBrouillons((prev) => {
        const { [s.id]: _retire, ...reste } = prev;
        return reste;
      });
      await synchroniser();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la mise à jour.");
    } finally {
      setEnCours(null);
    }
  }

  async function changerType(nouveauType: TypeSectionBibliotheque) {
    if (!section || section.type === nouveauType) return;
    setTypeEnCours(true);
    try {
      await modifierSectionBibliotheque(section.id, { type: nouveauType });
      toast.success("Type de section mis à jour.");
      await synchroniser();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la mise à jour du type.");
    } finally {
      setTypeEnCours(false);
    }
  }

  async function ajouterSousSection(parent: SectionBibliotheque) {
    if (nouvelleEnfant.trim() === "") {
      toast.error("Donnez un libellé à la nouvelle sous-section.");
      return;
    }
    setCreationEnCours(true);
    try {
      await creerSectionBibliotheque({ libelle: nouvelleEnfant.trim(), parent_id: parent.id });
      toast.success("Sous-section ajoutée.");
      setNouvelleEnfant("");
      setParentAjout(null);
      await synchroniser();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'ajout de la sous-section.");
    } finally {
      setCreationEnCours(false);
    }
  }

  async function deplacer(id: number, payload: DeplacementSectionPayload) {
    setDeplacementId(id);
    try {
      await deplacerSectionBibliotheque(id, payload);
      await synchroniser();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors du déplacement.");
    } finally {
      setDeplacementId(null);
    }
  }

  /**
   * Dépôt de la sous-section glissée sur `cible` (même parent garanti par le
   * garde-fou du survol) : elle prend le rang de la cible.
   */
  async function deposerSur(cible: SectionBibliotheque) {
    const drag = enDrag;
    setEnDrag(null);
    setSurvolDragId(null);
    if (!drag || drag.id === cible.id) return;

    await deplacer(drag.id, { position: cible.ordre });
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await supprimerSectionBibliotheque(aSupprimer.id);
      toast.success("Sous-section supprimée.");
      setASupprimer(null);
      await synchroniser();
    } catch (e) {
      toast.error(
        e instanceof ErreurApi ? e.message : "Erreur lors de la suppression.",
      );
    } finally {
      setSuppressionEnCours(false);
    }
  }

  /** Ligne éditable d'une sous-section, avec toutes ses actions. */
  const ligne = (
    s: SectionBibliotheque,
    index: number,
    taille: number,
    parent: SectionBibliotheque,
  ) => {
    const occupee = enCours === s.id || deplacementId === s.id;
    // Cibles de rattachement : toute l'arborescence de la section éditée,
    // sauf la sous-section elle-même, sa descendance et son parent actuel.
    const cibles = section
      ? aplatirSauf([section], s.id).filter((c) => c.id !== parent.id)
      : [];
    const deposable = enDrag !== null && enDrag.parentId === parent.id && enDrag.id !== s.id;

    return (
      <div className="space-y-0.5">
        <div
          className={cn(
            "flex items-center gap-2 rounded-md",
            deposable && survolDragId === s.id && "bg-primary/5 ring-2 ring-primary/40",
            enDrag?.id === s.id && "opacity-50",
          )}
          onDragOver={(e) => {
            if (deposable) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setSurvolDragId(s.id);
            }
          }}
          onDragLeave={() => {
            if (survolDragId === s.id) setSurvolDragId(null);
          }}
          onDrop={(e) => {
            if (deposable) {
              e.preventDefault();
              void deposerSur(s);
            }
          }}
        >
          <span
            draggable={!occupee}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(s.id));
              setEnDrag({ id: s.id, parentId: parent.id });
            }}
            onDragEnd={() => {
              setEnDrag(null);
              setSurvolDragId(null);
            }}
            className="shrink-0 cursor-grab text-muted-foreground/70 hover:text-foreground active:cursor-grabbing"
            title="Glisser pour réordonner (au sein du même parent)"
            aria-label="Réordonner par glisser-déposer"
          >
            <GripVertical className="size-3.5" />
          </span>
          <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={valeur(s)}
            onChange={(e) => setBrouillons((prev) => ({ ...prev, [s.id]: e.target.value }))}
            placeholder="Libellé de la sous-section"
            className="h-8 text-[12.5px]"
            disabled={occupee}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-success disabled:text-muted-foreground"
            aria-label="Enregistrer le libellé"
            title="Enregistrer"
            disabled={occupee || !estModifiee(s)}
            onClick={() => void enregistrer(s)}
          >
            {enCours === s.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="Monter la sous-section"
            title="Monter"
            disabled={occupee || index === 0}
            onClick={() => void deplacer(s.id, { direction: "haut" })}
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="Descendre la sous-section"
            title="Descendre"
            disabled={occupee || index === taille - 1}
            onClick={() => void deplacer(s.id, { direction: "bas" })}
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground"
                aria-label="Autres actions sur la sous-section"
                disabled={occupee}
              >
                {deplacementId === s.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <MoreVertical className="size-3.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                disabled={creationEnCours}
                onSelect={() => {
                  setNouvelleEnfant("");
                  setParentAjout(s.id);
                }}
              >
                <Plus className="size-4" />
                Ajouter une sous-section
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void deplacer(s.id, { parent_id: null })}>
                <CornerLeftUp className="size-4" />
                Déplacer à la racine de la bibliothèque
              </DropdownMenuItem>
              {cibles.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderInput className="mr-2 size-4 text-muted-foreground" />
                    Déplacer dans…
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-72 w-64 overflow-y-auto">
                    {cibles.map((cible) => (
                      <DropdownMenuItem
                        key={cible.id}
                        onSelect={() => void deplacer(s.id, { parent_id: cible.id })}
                      >
                        <span className="truncate" style={{ paddingLeft: cible.profondeur * DECALAGE_SOUS_SECTION_PX }}>
                          {cible.libelle}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={!peutSupprimer}
                title={!peutSupprimer ? "Réservé au chef SP" : undefined}
                onSelect={() => setASupprimer(s)}
              >
                <Trash2 className="size-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="pl-[44px] text-[11px] text-muted-foreground">
          Ajoutée le {formaterDate(s.date_creation)} par {s.createur}
        </p>
      </div>
    );
  };

  /** Formulaire inline d'ajout d'une sous-section sous `parent`. */
  const formulaireSousSection = (parent: SectionBibliotheque) => (
    <div className="flex items-center gap-2">
      <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
      <Input
        value={nouvelleEnfant}
        onChange={(e) => setNouvelleEnfant(e.target.value)}
        placeholder="Nouvelle sous-section"
        className="h-8 text-[12.5px]"
        disabled={creationEnCours}
        autoFocus
      />
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1"
        disabled={creationEnCours}
        onClick={() => void ajouterSousSection(parent)}
      >
        {creationEnCours && <Loader2 className="size-3 animate-spin" />}
        Ajouter
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8"
        disabled={creationEnCours}
        onClick={() => setParentAjout(null)}
      >
        Annuler
      </Button>
    </div>
  );

  /** Arbre récursif des sous-sections. */
  const arbre = (s: SectionBibliotheque, index: number, taille: number, parent: SectionBibliotheque): ReactNode => (
    <div key={s.id} className="space-y-1.5">
      {ligne(s, index, taille, parent)}
      {(s.sous_sections.length > 0 || parentAjout === s.id) && (
        <div className={CLASSE_ARBRE_SOUS_SECTION}>
          {s.sous_sections.map((enfant, i) => arbre(enfant, i, s.sous_sections.length, s))}
          {parentAjout === s.id && formulaireSousSection(s)}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader className="pr-10">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Pencil className="size-4" />
            </span>
            <div>
              <DialogTitle>Modifier la section</DialogTitle>
              <DialogDescription>
                Renommage, ajout, réordonnancement (glisser-déposer ou flèches)
                et déplacement des sous-sections, au sein du même parent.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {erreur ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            Impossible de charger la section.
          </p>
        ) : section === null ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="libelle-section-editee">Libellé de la section</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="libelle-section-editee"
                    value={valeur(section)}
                    onChange={(e) =>
                      setBrouillons((prev) => ({ ...prev, [section.id]: e.target.value }))
                    }
                    className="font-medium"
                    disabled={enCours === section.id}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-success disabled:text-muted-foreground"
                    aria-label="Enregistrer le libellé de la section"
                    title="Enregistrer"
                    disabled={enCours === section.id || !estModifiee(section)}
                    onClick={() => void enregistrer(section)}
                  >
                    {enCours === section.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Ajoutée le {formaterDate(section.date_creation)} par {section.createur}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type-section-editee">Type de section</Label>
                <Select
                  value={section.type}
                  onValueChange={(v) => void changerType(v as TypeSectionBibliotheque)}
                  disabled={typeEnCours}
                >
                  <SelectTrigger id="type-section-editee" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_SECTION_BIBLIOTHEQUE.map((t) => (
                      <SelectItem key={t.valeur} value={t.valeur}>
                        {t.libelle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {section.type === "solde" && (
                  <p className="text-[11px] text-muted-foreground">
                    En-tête de Fiche Bleue (une seule section Solde par fiche).
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Sous-sections</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1"
                  disabled={creationEnCours}
                  onClick={() => {
                    setNouvelleEnfant("");
                    setParentAjout(section.id);
                  }}
                >
                  <Plus className="size-3.5" />
                  Ajouter
                </Button>
              </div>

              {section.sous_sections.length === 0 && parentAjout !== section.id ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[12px] text-muted-foreground">
                  Aucune sous-section pour l'instant.
                </p>
              ) : (
                <div className="max-h-[45vh] space-y-1.5 overflow-y-auto rounded-lg border p-3 pr-2">
                  {section.sous_sections.map((enfant, i) =>
                    arbre(enfant, i, section.sous_sections.length, section),
                  )}
                  {parentAjout === section.id && formulaireSousSection(section)}
                </div>
              )}
            </div>
          </div>
        )}

        <AlertDialog
          open={aSupprimer !== null}
          onOpenChange={(ouvert) => { if (!ouvert) setASupprimer(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette sous-section ?</AlertDialogTitle>
              <AlertDialogDescription>
                « {aSupprimer?.libelle} » sera définitivement supprimée
                {aSupprimer && aSupprimer.sous_sections.length > 0
                  ? ", ainsi que toutes ses sous-sections"
                  : ""}
                .
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={suppressionEnCours}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); void confirmerSuppression(); }}
                disabled={suppressionEnCours}
              >
                {suppressionEnCours && <Loader2 className="size-3.5 animate-spin" />}
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
