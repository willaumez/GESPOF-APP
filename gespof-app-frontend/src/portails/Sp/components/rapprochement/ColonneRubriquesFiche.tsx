import { useState, type DragEvent } from "react";
import { ArrowDownToLine, CheckCheck, Inbox, Loader2, Plus } from "lucide-react";
import type { Layout } from "react-resizable-panels";
import { getPortalMenu } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  formaterMontantFcfa,
  styleIndentSection,
} from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import type {
  FicheExecutionDetail,
  SectionFicheExecution,
} from "@/portails/Sp/types/fiche-execution.interface";
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
  totalCentimes,
  versCentimes,
  type ElementRapprochable,
} from "./rapprochement";

const COLONNES: ColonneResizable[] = [
  { id: "fiche-rubrique", label: "Rubrique", defaultSize: "40%", minSize: "20%" },
  { id: "fiche-programme", label: "Programmé", defaultSize: "20%", minSize: "12%", align: "right" },
  { id: "fiche-realise", label: "Réalisé", defaultSize: "22%", minSize: "12%", align: "right" },
  { id: "fiche-ecart", label: "Écart", defaultSize: "18%", minSize: "10%", align: "right" },
];

interface LigneRubrique {
  section: SectionFicheExecution;
  niveau: number;
  estFeuille: boolean;
}

function aplatirRubriques(
  sections: SectionFicheExecution[],
  type: TypeRapprochement,
  niveau = 0,
): LigneRubrique[] {
  const out: LigneRubrique[] = [];
  for (const s of sections) {
    if (niveau === 0 && s.type !== type) continue;
    out.push({ section: s, niveau, estFeuille: s.sous_sections.length === 0 });
    out.push(...aplatirRubriques(s.sous_sections, type, niveau + 1));
  }
  return out;
}

function estGlisserElements(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(TYPE_GLISSER_ELEMENTS);
}

export interface ResumeRapprochementSection {
  nombre: number;
  centimes: number;
}

interface ColonneRubriquesFicheProps {
  type: TypeRapprochement;
  fiche: FicheExecutionDetail;
  /** Éléments en cours de glisser (null hors glisser). */
  glissees: ElementRapprochable[] | null;
  /** Sélection courante : permet l'affectation au clic (sans glisser). */
  selection: ElementRapprochable[];
  /** Éléments déjà rapprochés, par rubrique. */
  rapprochementsParSection: Map<number, ResumeRapprochementSection>;
  onAffecter: (section: SectionFicheExecution, elements: ElementRapprochable[]) => void;
  sectionEnCours: number | null;
  sectionRecente: number | null;
  desactive: boolean;
}

/**
 * Colonne droite du rapprochement : rubriques (recettes ou dépenses) de la
 * fiche d'exécution. Seules les feuilles reçoivent un dépôt (le backend
 * recalcule les totaux des sections parentes).
 */
export function ColonneRubriquesFiche({
  type,
  fiche,
  glissees,
  selection,
  rapprochementsParSection,
  onAffecter,
  sectionEnCours,
  sectionRecente,
  desactive,
}: ColonneRubriquesFicheProps) {
  const theme = getPortalMenu("sp").theme;
  const libelles = LIBELLES_TYPE[type];
  const [survol, setSurvol] = useState<number | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const lignes = aplatirRubriques(fiche.sections, type);
  const racines = lignes.filter((l) => l.niveau === 0);
  const totalProgramme = racines.reduce((s, l) => s + versCentimes(l.section.montant_programme), 0);
  const totalRealise = racines.reduce((s, l) => s + versCentimes(l.section.montant_realise), 0);
  const enGlisser = glissees != null && glissees.length > 0;
  const ajoutGlisser = enGlisser ? totalCentimes(glissees) : 0;

  function deposer(e: DragEvent, section: SectionFicheExecution) {
    e.preventDefault();
    setSurvol(null);
    if (!glissees || glissees.length === 0) return;
    onAffecter(section, glissees);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-green-600/55 bg-card">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-foreground">
            {type === "recette" ? "Recettes" : "Dépenses"} de la fiche d&apos;exécution
          </h2>
          <p className="truncate text-[12px] text-muted-foreground">
            {fiche.reference} · déposez sur une rubrique pour l&apos;ajouter au réalisé.
          </p>
        </div>
        <div className="flex shrink-0 gap-4 text-right">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Programmé
            </p>
            <p className="text-[13px] font-semibold tabular-nums">
              {formaterMontantFcfa(depuisCentimes(totalProgramme))}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Réalisé
            </p>
            <p className="text-[13px] font-bold tabular-nums" style={{ color: theme.iconColor }}>
              {formaterMontantFcfa(depuisCentimes(totalRealise))}
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {lignes.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <Inbox className="size-6" />
            <p className="text-[13px]">Aucune rubrique de {libelles.singulier} dans cette fiche.</p>
          </div>
        ) : (
          <>
            <EnteteColonnesResizable colonnes={COLONNES} onLayoutChange={setLayout} />
            <table className="w-full table-fixed text-[13px]">
              <ColgroupResizable colonnes={COLONNES} layout={layout} />
              <tbody>
                {lignes.map(({ section, niveau, estFeuille }) => {
                  const cible = estFeuille && !desactive;
                  const survolee = cible && enGlisser && survol === section.id;
                  const enCours = sectionEnCours === section.id;
                  const rapprochee = rapprochementsParSection.get(section.id);
                  const realiseCentimes = versCentimes(section.montant_realise);
                  const ecartNegatif = versCentimes(section.montant_ecart) < 0;
                  return (
                    <tr
                      key={section.id}
                      onDragOver={(e) => {
                        if (!cible || !estGlisserElements(e)) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                        if (survol !== section.id) setSurvol(section.id);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                          setSurvol((s) => (s === section.id ? null : s));
                        }
                      }}
                      onDrop={(e) => {
                        if (cible) deposer(e, section);
                      }}
                      className={cn(
                        "group border-b transition-colors last:border-b-0 [&>td]:border-r [&>td]:border-border/40 [&>td:last-child]:border-r-0",
                        niveau === 0 ? "bg-muted/50" : "bg-background",
                        section.non_programme && "bg-amber-50",
                        rapprochee && CLASSE_LIGNE_RAPPROCHEE,
                        cible && enGlisser && "outline-1 -outline-offset-1 outline-dashed outline-emerald-500/50",
                        survolee && "bg-emerald-100 outline-2 outline-solid outline-emerald-600",
                        sectionRecente === section.id && "animate-pulse bg-emerald-100",
                      )}
                    >
                      <td className="px-3 py-2">
                        <div
                          className={cn(
                            "flex min-w-0 items-center gap-2",
                            niveau > 0 && "border-l-2 border-muted-foreground/25 text-muted-foreground",
                            estFeuille ? "font-medium text-foreground" : "font-semibold",
                            rapprochee && "text-emerald-950",
                          )}
                          style={styleIndentSection(Math.min(niveau, 3))}
                        >
                          <span className="truncate" title={section.nom}>{section.nom}</span>
                          {section.non_programme ? (
                            <Badge className="shrink-0 border-transparent bg-amber-200/90 text-[9px] font-semibold uppercase text-amber-950">
                              Non prog.
                            </Badge>
                          ) : null}
                          {rapprochee ? (
                            <Badge
                              className="shrink-0 gap-1 border-transparent bg-emerald-600 text-[10px] font-medium text-white"
                              title={`+${formaterMontantFcfa(depuisCentimes(rapprochee.centimes))} rapprochés`}
                            >
                              <CheckCheck className="size-3" />
                              {rapprochee.nombre}
                            </Badge>
                          ) : null}
                          {cible && !enGlisser && selection.length > 0 ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="ml-auto h-6 shrink-0 gap-1 px-2 text-[11px] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                              disabled={sectionEnCours != null}
                              onClick={() => onAffecter(section, selection)}
                              title={`Ajouter les ${selection.length} ${libelles.singulier}(s) sélectionnée(s) au réalisé`}
                            >
                              <Plus className="size-3" />
                              Affecter ({selection.length})
                            </Button>
                          ) : null}
                        </div>
                      </td>
                      <td className="truncate px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formaterMontantFcfa(section.montant_programme)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {enCours ? (
                          <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />
                        ) : survolee ? (
                          <div className="leading-tight">
                            <p className="flex items-center justify-end gap-1 truncate text-[11px] font-medium text-emerald-700">
                              <ArrowDownToLine className="size-3 shrink-0" />
                              +{formaterMontantFcfa(depuisCentimes(ajoutGlisser))}
                            </p>
                            <p className="truncate font-bold tabular-nums text-emerald-900">
                              {formaterMontantFcfa(depuisCentimes(realiseCentimes + ajoutGlisser))}
                            </p>
                          </div>
                        ) : (
                          <span
                            className={cn(
                              "block truncate font-semibold tabular-nums",
                              rapprochee && "text-emerald-800",
                            )}
                          >
                            {formaterMontantFcfa(section.montant_realise)}
                          </span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "truncate px-3 py-2 text-right tabular-nums",
                          realiseCentimes !== 0 && ecartNegatif ? "font-medium text-red-600" : "text-muted-foreground",
                        )}
                      >
                        {realiseCentimes !== 0 ? formaterMontantFcfa(section.montant_ecart) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
