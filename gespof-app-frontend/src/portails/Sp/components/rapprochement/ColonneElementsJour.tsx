import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  Banknote, ChevronLeft, ChevronRight, FilterX, GripVertical, Link2, Search, Sparkles, Undo2,
} from "lucide-react";
import type { Layout } from "react-resizable-panels";
import { PAGINATION } from "@/shared/config/app";
import { getPortalMenu } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import { formatMontant } from "@/shared/lib/format";
import { optionsTaillePagination } from "@/shared/lib/pagination";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/shared/components/ui/input-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import type { TypeRapprochement } from "@/portails/Sp/types/journee-tresorerie.interface";
import {
  ColgroupResizable,
  EnteteColonnesResizable,
  type ColonneResizable,
} from "./ColonnesResizables";
import {
  CLASSE_LIGNE_RAPPROCHEE,
  LIBELLES_TYPE,
  TYPE_GLISSER_ELEMENTS,
  depuisCentimes,
  paginerLocal,
  totalCentimes,
  type ElementRapprochable,
} from "./rapprochement";

const PAGE_SIZE_OPTIONS = optionsTaillePagination()
  .filter((option) => option.value === "all" || Number(option.value) >= PAGINATION.TAILLE_PAR_DEFAUT)
  .map((option) => (option.value === "all" ? { ...option, label: "Tous" } : option));

type FiltreStatut = "toutes" | "a_rapprocher" | "rapprochees" | "nouvelles";

/** Origine Oracle affichée par défaut sur le rapprochement des recettes. */
const ORIGINE_DEFAUT_RECETTE = "GM";

function formaterMontant(valeur: string): string {
  const formate = formatMontant(valeur);
  return formate === "—" ? valeur : formate;
}

/** Vignette affichée sous le curseur pendant le glisser (n éléments · total). */
function poserImageGlisser(e: DragEvent, elements: ElementRapprochable[], libelle: string) {
  const vignette = document.createElement("div");
  vignette.textContent = `${elements.length} ${libelle}${elements.length > 1 ? "s" : ""} · ${formaterMontant(depuisCentimes(totalCentimes(elements)))} FCFA`;
  Object.assign(vignette.style, {
    position: "fixed",
    top: "-1000px",
    padding: "6px 10px",
    borderRadius: "8px",
    background: "#0f172a",
    color: "#fff",
    font: "600 12px system-ui, sans-serif",
    whiteSpace: "nowrap",
  });
  document.body.appendChild(vignette);
  e.dataTransfer.setDragImage(vignette, 12, 12);
  window.setTimeout(() => vignette.remove(), 0);
}

interface ColonneElementsJourProps {
  type: TypeRapprochement;
  /** Sous-titre (date, validation…). */
  description: ReactNode;
  elements: ElementRapprochable[];
  /** Filtre par catégorie (familles de dépenses) ; absent = pas de filtre. */
  categories?: { value: string; label: string }[];
  selection: Map<string, ElementRapprochable>;
  onSelectionChange: (selection: Map<string, ElementRapprochable>) => void;
  onAnnulerRapprochement: (element: ElementRapprochable) => void;
  onGlisserDebut: (elements: ElementRapprochable[]) => void;
  onGlisserFin: () => void;
  desactive: boolean;
}

/**
 * Colonne gauche du rapprochement : éléments validés de la journée
 * (recettes ou dépenses), filtrables, sélectionnables en lot et glissables
 * vers la fiche d'exécution.
 */
export function ColonneElementsJour({
  type,
  description,
  elements,
  categories,
  selection,
  onSelectionChange,
  onAnnulerRapprochement,
  onGlisserDebut,
  onGlisserFin,
  desactive,
}: ColonneElementsJourProps) {
  const theme = getPortalMenu("sp").theme;
  const libelles = LIBELLES_TYPE[type];
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statut, setStatut] = useState<FiltreStatut>("toutes");
  const [categorie, setCategorie] = useState("");
  const [origine, setOrigine] = useState(
    () => (type === "recette" ? ORIGINE_DEFAUT_RECETTE : ""),
  );
  const [page, setPage] = useState<number>(PAGINATION.PAGE_PAR_DEFAUT);
  const [pageSize, setPageSize] = useState(String(PAGINATION.TAILLE_PAR_DEFAUT));
  const dernierIndexClique = useRef<number | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const originesListe = useMemo(() => {
    if (type !== "recette") return [] as string[];
    return [...new Set(
      elements.map((e) => e.origine).filter((v): v is string => Boolean(v)),
    )].sort((a, b) => a.localeCompare(b, "fr"));
  }, [elements, type]);

  const originesSelect = origine && !originesListe.includes(origine)
    ? [...originesListe, origine]
    : originesListe;

  const aDesNouvelles = elements.some((e) => e.nouvelle);
  const filtrees = elements.filter((e) => {
    if (debouncedSearch && !e.recherche.includes(debouncedSearch)) return false;
    if (categorie && e.categorie !== categorie) return false;
    if (origine && e.origine !== origine) return false;
    if (statut === "a_rapprocher") return e.rapprochement == null;
    if (statut === "rapprochees") return e.rapprochement != null;
    if (statut === "nouvelles") return e.nouvelle;
    return true;
  });
  const { lignes: visibles, page: pageCourante, pages } = paginerLocal(filtrees, page, pageSize);

  useEffect(() => {
    dernierIndexClique.current = null;
  }, [pageCourante, pageSize, debouncedSearch, statut, categorie, origine]);

  const filtreOrigineActif = type === "recette" && origine !== ORIGINE_DEFAUT_RECETTE;
  const filtresActifs = Boolean(
    search.trim() || statut !== "toutes" || categorie || filtreOrigineActif,
  );
  const selectionnables = visibles.filter((e) => e.rapprochement == null);
  const toutesCochees = selectionnables.length > 0
    && selectionnables.every((e) => selection.has(e.cle));
  const quelquesCochees = selectionnables.some((e) => selection.has(e.cle));
  const elementsSelection = [...selection.values()];

  function reinitialiserFiltres() {
    setSearch("");
    setDebouncedSearch("");
    setStatut("toutes");
    setCategorie("");
    setOrigine(type === "recette" ? ORIGINE_DEFAUT_RECETTE : "");
    setPage(PAGINATION.PAGE_PAR_DEFAUT);
  }

  function basculer(index: number, etendre: boolean) {
    const element = visibles[index];
    if (!element || element.rapprochement) return;
    const suivante = new Map(selection);
    const cocher = !selection.has(element.cle);
    const plage = etendre && dernierIndexClique.current != null
      ? visibles.slice(
        Math.min(dernierIndexClique.current, index),
        Math.max(dernierIndexClique.current, index) + 1,
      )
      : [element];
    for (const e of plage) {
      if (e.rapprochement) continue;
      if (cocher) suivante.set(e.cle, e);
      else suivante.delete(e.cle);
    }
    dernierIndexClique.current = index;
    onSelectionChange(suivante);
  }

  function basculerTout(cocher: boolean) {
    const suivante = new Map(selection);
    for (const e of selectionnables) {
      if (cocher) suivante.set(e.cle, e);
      else suivante.delete(e.cle);
    }
    onSelectionChange(suivante);
  }

  function demarrerGlisser(e: DragEvent, element: ElementRapprochable) {
    // Glisser une ligne cochée emporte toute la sélection ; sinon la ligne seule.
    const glisses = selection.has(element.cle) ? elementsSelection : [element];
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(TYPE_GLISSER_ELEMENTS, String(glisses.length));
    poserImageGlisser(e, glisses, libelles.singulier);
    onGlisserDebut(glisses);
  }

  const colonnes: ColonneResizable[] = [
    {
      id: "jour-selection",
      label: (
        <Checkbox
          checked={toutesCochees ? true : quelquesCochees ? "indeterminate" : false}
          onCheckedChange={(v) => basculerTout(v === true)}
          disabled={selectionnables.length === 0 || desactive}
          aria-label="Tout sélectionner"
        />
      ),
      defaultSize: "40px",
      minSize: "40px",
      maxSize: "40px",
      fixe: true,
    },
    { id: "jour-libelle", label: libelles.colonneLibelle, defaultSize: "65%", minSize: "25%" },
    { id: "jour-montant", label: "Montant", defaultSize: "30%", minSize: "15%", align: "right" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="shrink-0 space-y-3 border-b px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-foreground">{libelles.colonneJour}</h2>
            <div className="text-[12px] text-muted-foreground">{description}</div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Total
            </p>
            <p className="text-[14px] font-bold tabular-nums" style={{ color: theme.iconColor }}>
              {formaterMontant(depuisCentimes(totalCentimes(filtrees)))} FCFA
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 [&>*]:min-w-[10rem] [&>*]:flex-1">
          <InputGroup className="h-8 bg-background">
            <InputGroupAddon>
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={type === "recette" ? "Référence, tiers…" : "Bénéficiaire, OV, banque…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={`Rechercher une ${libelles.singulier}`}
            />
          </InputGroup>
          {categories && categories.length > 0 ? (
            <Select
              value={categorie || "all"}
              onValueChange={(v) => {
                setCategorie(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-full" aria-label="Famille">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes familles</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <div className="flex gap-2">
            <Select
              value={statut}
              onValueChange={(v) => {
                setStatut(v as FiltreStatut);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 min-w-0 flex-1" aria-label="Statut de rapprochement">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes</SelectItem>
                <SelectItem value="a_rapprocher">À rapprocher</SelectItem>
                <SelectItem value="rapprochees">Rapprochées</SelectItem>
                {aDesNouvelles ? <SelectItem value="nouvelles">Nouvelles</SelectItem> : null}
              </SelectContent>
            </Select>
            {type === "recette" ? (
              <Select
                value={origine || "all"}
                onValueChange={(v) => {
                  setOrigine(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 min-w-0 flex-1" aria-label="Origine">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {originesSelect.map((valeur) => (
                    <SelectItem key={valeur} value={valeur}>{valeur}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={reinitialiserFiltres}
              disabled={!filtresActifs}
              title="Réinitialiser les filtres"
              aria-label="Réinitialiser les filtres"
            >
              <FilterX className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2 text-[12px] transition-colors",
          selection.size > 0 ? "bg-primary/5" : "bg-muted/30",
        )}
      >
        {selection.size > 0 ? (
          <>
            <span className="font-medium text-foreground">
              {selection.size} sélectionnée{selection.size > 1 ? "s" : ""} ·{" "}
              <span className="tabular-nums">
                {formaterMontant(depuisCentimes(totalCentimes(elementsSelection)))} FCFA
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[12px]"
              onClick={() => onSelectionChange(new Map())}
            >
              Désélectionner
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">
            Astuce : Maj + clic pour sélectionner une plage.
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visibles.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-4 text-center">
            <Banknote className="size-6 text-muted-foreground" />
            <p className="text-[13px] text-muted-foreground">
              {elements.length > 0 ? `Aucune ${libelles.singulier} pour ce filtre.` : "La liste validée est vide."}
            </p>
          </div>
        ) : (
          <>
            <EnteteColonnesResizable colonnes={colonnes} onLayoutChange={setLayout} />
            <table className="w-full table-fixed text-[13px]">
              <ColgroupResizable colonnes={colonnes} layout={layout} />
              <tbody>
                {visibles.map((element, index) => {
                  const { rapprochement } = element;
                  const coche = selection.has(element.cle);
                  const glissable = !rapprochement && !desactive;
                  return (
                    <tr
                      key={element.cle}
                      draggable={glissable}
                      onDragStart={(e) => demarrerGlisser(e, element)}
                      onDragEnd={onGlisserFin}
                      onClick={(e) => {
                        if (glissable) basculer(index, e.shiftKey);
                      }}
                      className={cn(
                        "group border-b last:border-b-0 select-none [&>td]:border-r [&>td]:border-border/40 [&>td:last-child]:border-r-0",
                        glissable && "cursor-grab active:cursor-grabbing hover:bg-muted/50",
                        coche && "bg-primary/10 hover:bg-primary/15",
                        rapprochement && CLASSE_LIGNE_RAPPROCHEE,
                      )}
                    >
                      <td className="px-3 py-2 align-top">
                        <Checkbox
                          checked={coche}
                          disabled={!glissable}
                          onClick={(e) => {
                            e.stopPropagation();
                            basculer(index, e.shiftKey);
                          }}
                          aria-label={`Sélectionner ${element.libelle}`}
                        />
                      </td>
                      <td className="min-w-0 px-2 py-2">
                        <div className="flex items-start gap-1.5">
                          {glissable ? (
                            <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
                          ) : null}
                          <div className="min-w-0">
                            <p className={cn("break-words", rapprochement ? "text-emerald-950" : "text-foreground")}>
                              {element.libelle}
                              {element.nouvelle ? (
                                <Badge className="ml-1.5 gap-0.5 border-transparent bg-amber-200 px-1.5 align-middle text-[9.5px] font-semibold uppercase text-amber-950">
                                  <Sparkles className="size-2.5" />
                                  Nouvelle
                                </Badge>
                              ) : null}
                            </p>
                            {element.detail ? (
                              <p className="truncate text-[11px] text-muted-foreground" title={element.detail}>
                                {element.detail}
                              </p>
                            ) : null}
                            {rapprochement ? (
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <Badge
                                  className="max-w-full gap-1 border-transparent bg-emerald-600 text-[10px] font-medium text-white"
                                  title={rapprochement.par ? `Rapprochée par ${rapprochement.par}` : undefined}
                                >
                                  <Link2 className="size-3 shrink-0" />
                                  <span className="truncate">{rapprochement.section_nom}</span>
                                </Badge>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-0.5 rounded px-1 text-[11px] text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950 disabled:opacity-50"
                                  disabled={desactive}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAnnulerRapprochement(element);
                                  }}
                                  title="Annule ce rapprochement (et ceux déposés en même temps)"
                                >
                                  <Undo2 className="size-3" />
                                  Annuler
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td
                        className={cn(
                          "truncate px-3 py-2 text-right align-top font-semibold tabular-nums",
                          rapprochement && "text-emerald-800",
                        )}
                      >
                        {formaterMontant(element.montant)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <Select
            value={pageSize}
            onValueChange={(valeur) => {
              setPageSize(valeur);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-7 w-[76px]" aria-label="Lignes par page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {filtrees.length} {libelles.singulier}{filtrees.length !== 1 ? "s" : ""}
          </p>
        </div>
        {pages > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={pageCourante === 1}
              onClick={() => setPage(Math.max(1, pageCourante - 1))}
              aria-label="Page précédente"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {pageCourante} / {pages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={pageCourante === pages}
              onClick={() => setPage(Math.min(pages, pageCourante + 1))}
              aria-label="Page suivante"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
