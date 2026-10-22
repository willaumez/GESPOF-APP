import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Eye, FilterX, GripVertical, Library, Loader2,
  MoreVertical, Pencil, Plus, RefreshCw, Search, SearchX, ShieldAlert, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { ErreurApi } from "@/shared/lib/api";
import { useAuth } from "@/shared/hooks/use-auth";
import { Button } from "@/shared/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/shared/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/shared/components/ui/empty";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  deplacerSectionBibliotheque, listerBibliothequeSections, supprimerSectionBibliotheque,
} from "@/portails/Sp/api/bibliotheque-sections";
import type {
  SectionBibliotheque, TypeSectionBibliotheque,
} from "@/portails/Sp/types/bibliotheque.interface";
import {
  TYPES_SECTION_BIBLIOTHEQUE, libelleTypeSection,
} from "@/portails/Sp/types/bibliotheque.interface";
import { DialogAjoutSection } from "./DialogAjoutSection";
import { DialogDetailSection } from "./DialogDetailSection";
import { DialogModifierSection } from "./DialogModifierSection";

/** Nombre de sections racines par page. */
const LIMITE_PAR_PAGE = 10;

const STYLE_TYPE: Record<TypeSectionBibliotheque, string> = {
  solde: "border-transparent bg-primary/10 text-primary",
  recette: "border-transparent bg-success/10 text-success",
  depense: "border-transparent bg-warning/10 text-warning",
};

/** Date d'ajout à la bibliothèque, ex. "19/08/2026". */
function formaterDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

/**
 * Bibliothèque des sections de Fiche Bleue, présentée en tableau : titre,
 * nombre de sous-sections, date de création et menu d'actions (Détail,
 * Modifier, Supprimer — la suppression étant réservée au chef SP, le backend
 * l'impose avec #[IsGranted('ROLE_CHEF_SP')]). L'arborescence complète se
 * consulte dans « Détail » et s'édite dans « Modifier ». Les lignes se
 * réordonnent par glisser-déposer (poignée à gauche).
 */
export function BibliothequeSections() {
  const { hasRole } = useAuth();
  const peutSupprimer = hasRole("CHEF_SP");

  const [sections, setSections] = useState<SectionBibliotheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);

  /** Filtre par libellé / type + pagination des racines. */
  const [recherche, setRecherche] = useState("");
  const [filtreType, setFiltreType] = useState<TypeSectionBibliotheque | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [dialogAjoutOuvert, setDialogAjoutOuvert] = useState(false);
  const [enDetailId, setEnDetailId] = useState<number | null>(null);
  const [enEditionId, setEnEditionId] = useState<number | null>(null);

  const [aSupprimer, setASupprimer] = useState<SectionBibliotheque | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  /** Glisser-déposer des lignes du tableau (réordonnancement des racines). */
  const [deplacementId, setDeplacementId] = useState<number | null>(null);
  const [enDragId, setEnDragId] = useState<number | null>(null);
  const [survolDragId, setSurvolDragId] = useState<number | null>(null);

  const charger = useCallback((terme: string, pageDemandee: number, type: TypeSectionBibliotheque | "") => {
    return listerBibliothequeSections({
      q: terme.trim() || undefined,
      type: type || undefined,
      page: pageDemandee,
      limite: LIMITE_PAR_PAGE,
    })
      .then((data) => {
        setSections(data.sections ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
        // Le backend borne la page demandée (ex. après suppression de la
        // dernière section d'une page) : on suit sa correction.
        if (data.page && data.page !== pageDemandee) setPage(data.page);
        setErreur(false);
      })
      .catch(() => setErreur(true))
      .finally(() => setLoading(false));
  }, []);

  // Premier chargement immédiat, puis rechargement avec un debounce de 300 ms
  // à chaque changement de recherche, de type ou de page.
  const premierChargement = useRef(true);
  useEffect(() => {
    if (premierChargement.current) {
      premierChargement.current = false;
      void charger(recherche, page, filtreType);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => void charger(recherche, page, filtreType), 300);
    return () => clearTimeout(timer);
  }, [recherche, page, filtreType, charger]);

  /** Rechargement silencieux en conservant la recherche, le type et la page. */
  const rechargerCourant = useCallback(() => {
    return charger(recherche, page, filtreType);
  }, [charger, recherche, page, filtreType]);

  const rafraichir = useCallback(() => {
    setLoading(true);
    return rechargerCourant();
  }, [rechargerCourant]);

  /** Réinitialise les filtres et revient à la première page. */
  const reinitialiser = useCallback(() => {
    setRecherche("");
    setFiltreType("");
    setPage(1);
  }, []);

  const filtreActif = recherche.trim() !== "" || filtreType !== "" || page !== 1;
  const filtreSansPage = recherche.trim() !== "" || filtreType !== "";

  /** Dépôt de la section glissée sur `cible` : elle prend son rang absolu. */
  async function deposerSur(cible: SectionBibliotheque) {
    const dragId = enDragId;
    setEnDragId(null);
    setSurvolDragId(null);
    if (dragId === null || dragId === cible.id) return;

    setDeplacementId(dragId);
    try {
      // `ordre` est le rang absolu dans la liste complète des racines :
      // indispensable, la liste affichée étant paginée / filtrée.
      await deplacerSectionBibliotheque(dragId, { position: cible.ordre });
      await rechargerCourant();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors du déplacement de la section.");
    } finally {
      setDeplacementId(null);
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await supprimerSectionBibliotheque(aSupprimer.id);
      toast.success("Section supprimée de la bibliothèque.");
      setASupprimer(null);
      await rechargerCourant();
    } catch (e) {
      toast.error(
        e instanceof ErreurApi ? e.message : "Erreur lors de la suppression de la section.",
      );
    } finally {
      setSuppressionEnCours(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-[15px]">Bibliothèque des sections</CardTitle>
            <CardDescription>
              Sections et sous-sections réutilisables à la composition
              <br />
              des Fiches Bleues.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={recherche}
                onChange={(e) => {
                  setRecherche(e.target.value);
                  setPage(1);
                }}
                placeholder="Rechercher une section…"
                aria-label="Rechercher une section ou une sous-section"
                className="h-8 w-56 pl-8"
              />
            </div>
            <Select
              value={filtreType || "tous"}
              onValueChange={(v) => {
                setFiltreType(v === "tous" ? "" : (v as TypeSectionBibliotheque));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-40" aria-label="Filtrer par type de section">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les types</SelectItem>
                {TYPES_SECTION_BIBLIOTHEQUE.map((t) => (
                  <SelectItem key={t.valeur} value={t.valeur}>
                    {t.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={reinitialiser}
              disabled={!filtreActif}
              title="Réinitialiser les filtres et revenir à la première page"
            >
              <FilterX className="size-3.5" />
              Réinitialiser
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void rafraichir()}
              disabled={loading}
            >
              <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />
              Actualiser
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => setDialogAjoutOuvert(true)}
            >
              <Plus className="size-3.5" />
              Ajouter
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : erreur ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShieldAlert />
              </EmptyMedia>
              <EmptyTitle>Chargement impossible</EmptyTitle>
              <EmptyDescription>
                La bibliothèque des sections n'a pas pu être récupérée.
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" onClick={() => void rafraichir()}>
              Réessayer
            </Button>
          </Empty>
        ) : sections.length === 0 && filtreSansPage ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>Aucun résultat</EmptyTitle>
              <EmptyDescription>
                {recherche.trim() !== "" && filtreType !== ""
                  ? `Aucune section de type « ${libelleTypeSection(filtreType)} » ne correspond à « ${recherche.trim()} ».`
                  : recherche.trim() !== ""
                    ? `Aucune section ne correspond à « ${recherche.trim()} ».`
                    : `Aucune section de type « ${libelleTypeSection(filtreType as TypeSectionBibliotheque)} ».`}
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" onClick={reinitialiser}>
              Effacer les filtres
            </Button>
          </Empty>
        ) : sections.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Library />
              </EmptyMedia>
              <EmptyTitle>Bibliothèque vide</EmptyTitle>
              <EmptyDescription>
                Ajoutez une première section : elle sera réutilisable dans
                toutes les Fiches Bleues.
              </EmptyDescription>
            </EmptyHeader>
            <Button size="sm" className="gap-1.5" onClick={() => setDialogAjoutOuvert(true)}>
              <Plus className="size-3.5" />
              Ajouter une section
            </Button>
          </Empty>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead className="w-28">Type</TableHead>
                  <TableHead className="w-32 text-center">Sous-sections</TableHead>
                  <TableHead className="w-40">Date de création</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => {
                  const deposable = enDragId !== null && enDragId !== section.id;
                  return (
                    <TableRow
                      key={section.id}
                      className={cn(
                        "cursor-pointer",
                        deposable && survolDragId === section.id && "bg-primary/5 ring-2 ring-inset ring-primary/40",
                        enDragId === section.id && "opacity-50",
                      )}
                      onClick={() => setEnDetailId(section.id)}
                      onDragOver={(e) => {
                        if (deposable) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setSurvolDragId(section.id);
                        }
                      }}
                      onDragLeave={() => {
                        if (survolDragId === section.id) setSurvolDragId(null);
                      }}
                      onDrop={(e) => {
                        if (deposable) {
                          e.preventDefault();
                          void deposerSur(section);
                        }
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            draggable={deplacementId === null}
                            onClick={(e) => e.stopPropagation()}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", String(section.id));
                              setEnDragId(section.id);
                            }}
                            onDragEnd={() => {
                              setEnDragId(null);
                              setSurvolDragId(null);
                            }}
                            className="shrink-0 cursor-grab text-muted-foreground/70 hover:text-foreground active:cursor-grabbing"
                            title="Glisser pour réordonner"
                            aria-label="Réordonner par glisser-déposer"
                          >
                            {deplacementId === section.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <GripVertical className="size-3.5" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {section.libelle}
                            </span>
                            <span className="block text-[11.5px] text-muted-foreground">
                              par {section.createur}
                            </span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STYLE_TYPE[section.type]}>
                          {libelleTypeSection(section.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {section.sous_sections.length}
                      </TableCell>
                      <TableCell className="text-[12px] tabular-nums text-muted-foreground">
                        {formaterDate(section.date_creation)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label="Actions sur la section"
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onSelect={() => setEnDetailId(section.id)}>
                                <Eye className="size-4 text-accent" />
                                Détail
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setEnEditionId(section.id)}>
                                <Pencil className="size-4 text-warning" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={!peutSupprimer}
                                title={!peutSupprimer ? "Réservé au chef SP" : undefined}
                                onSelect={() => setASupprimer(section)}
                              >
                                <Trash2 className="size-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-[12px] text-muted-foreground">
                {total} section{total > 1 ? "s" : ""}
                {filtreSansPage ? " trouvée" + (total > 1 ? "s" : "") : ""}
              </p>
              {pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={loading || page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="size-3.5" />
                    Précédent
                  </Button>
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    Page {page} / {pages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={loading || page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  >
                    Suivant
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>

      {dialogAjoutOuvert && (
        <DialogAjoutSection
          onClose={() => setDialogAjoutOuvert(false)}
          onCreee={rechargerCourant}
        />
      )}

      {enDetailId !== null && (
        <DialogDetailSection
          sectionId={enDetailId}
          onClose={() => setEnDetailId(null)}
        />
      )}

      {enEditionId !== null && (
        <DialogModifierSection
          sectionId={enEditionId}
          onClose={() => setEnEditionId(null)}
          onModifie={rechargerCourant}
        />
      )}

      <AlertDialog
        open={aSupprimer !== null}
        onOpenChange={(ouvert) => { if (!ouvert) setASupprimer(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette section de la bibliothèque ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {aSupprimer?.libelle} » sera définitivement supprimée de la bibliothèque
              {aSupprimer && aSupprimer.sous_sections.length > 0
                ? ", ainsi que toutes ses sous-sections"
                : ""}
              . Les Fiches Bleues déjà rédigées ne sont pas affectées.
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
    </Card>
  );
}
