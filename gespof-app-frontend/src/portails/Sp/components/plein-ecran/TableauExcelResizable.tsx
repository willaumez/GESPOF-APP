import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  Fragment,
  type ReactNode,
} from "react";
import {
  type GroupImperativeHandle,
  type Layout,
} from "react-resizable-panels";
import { Inbox, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";

export type AlignExcel = "left" | "right" | "center";

export interface ColonneExcelDef {
  id: string;
  label: ReactNode;
  defaultSize: string;
  minSize: string;
  maxSize?: string;
  align?: AlignExcel;
  headerClassName?: string;
}

export interface LigneExcelDef {
  key: string;
  /** Ligne de regroupement (ex. RECETTES) — fond coloré. */
  groupe?: boolean;
  groupeClassName?: string;
  rowClassName?: string;
  cells: Record<string, ReactNode>;
}

export function CelluleExcel({
  children,
  className,
  align = "left",
}: {
  children: ReactNode;
  className?: string;
  align?: AlignExcel;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 items-center overflow-hidden px-2.5 text-[13px]",
        align === "right" && "justify-end text-right",
        align === "center" && "justify-center text-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Hauteurs naturelles (px) quand les lignes ne tiennent pas : la grille défile. */
const HAUTEUR_ENTETE_PX = 40;
const HAUTEUR_LIGNE_PX = 36;
/** minSize d'une ligne : en dessous, les lignes ne tiennent plus dans la zone. */
const HAUTEUR_LIGNE_MIN_PX = 28;

function layoutLignesDefaut(lignes: LigneExcelDef[]): Layout {
  const layout: Layout = { entete: 5 };
  const reste = Math.max(lignes.length, 1);
  const part = 95 / reste;
  for (const l of lignes) layout[l.key] = part;
  return layout;
}

function appliquerLayoutSafe(
  handle: GroupImperativeHandle,
  layout: Layout,
): void {
  try {
    handle.setLayout(layout);
  } catch {
    // Groupe pas encore enregistré / déjà démonté (course au montage plein écran).
  }
}

function ColonneExcel({
  idGroupe,
  layoutLignes,
  onLayoutLignesChange,
  enregistrerGroupe,
  lignes,
  colonne,
}: {
  idGroupe: string;
  layoutLignes: Layout;
  onLayoutLignesChange: (layout: Layout) => void;
  enregistrerGroupe: (id: string, handle: GroupImperativeHandle | null) => void;
  lignes: LigneExcelDef[];
  colonne: ColonneExcelDef;
}) {
  return (
    <ResizablePanelGroup
      id={idGroupe}
      orientation="vertical"
      className="h-full w-full"
      defaultLayout={layoutLignes}
      onLayoutChange={onLayoutLignesChange}
      groupRef={(handle) => enregistrerGroupe(idGroupe, handle)}
    >
      <ResizablePanel
        id="entete"
        defaultSize="40px"
        minSize="36px"
        maxSize="72px"
        groupResizeBehavior="preserve-pixel-size"
        className="bg-muted"
      >
        <CelluleExcel
          align={colonne.align ?? "left"}
          className={cn(
            "bg-muted text-[11px] font-bold tracking-wider text-muted-foreground uppercase",
            colonne.headerClassName,
          )}
        >
          <span className="truncate">{colonne.label}</span>
        </CelluleExcel>
      </ResizablePanel>
      <ResizableHandle withHandle className="bg-border/80" />

      {lignes.map((ligne, index) => (
        <Fragment key={ligne.key}>
          <ResizablePanel
            id={ligne.key}
            minSize="28px"
            className={cn(
              "border-t border-border/40",
              ligne.groupe && ligne.groupeClassName,
              ligne.rowClassName,
            )}
          >
            <CelluleExcel align={colonne.align ?? "left"}>
              {ligne.cells[colonne.id] ?? null}
            </CelluleExcel>
          </ResizablePanel>
          {index < lignes.length - 1 ? (
            <ResizableHandle withHandle={index === 0} className="bg-border/60" />
          ) : null}
        </Fragment>
      ))}
    </ResizablePanelGroup>
  );
}

/**
 * Colonne en mode défilement : lignes à hauteur fixe, rendues comme de simples
 * blocs. Une fiche de 100+ lignes en panneaux redimensionnables (≈ 460 panneaux)
 * bloquait l'affichage une dizaine de secondes.
 */
function ColonneExcelFixe({
  lignes,
  colonne,
}: {
  lignes: LigneExcelDef[];
  colonne: ColonneExcelDef;
}) {
  return (
    <div className="flex h-full w-full flex-col">
      <div
        className="shrink-0 border-b border-border/80 bg-muted"
        style={{ height: HAUTEUR_ENTETE_PX }}
      >
        <CelluleExcel
          align={colonne.align ?? "left"}
          className={cn(
            "bg-muted text-[11px] font-bold tracking-wider text-muted-foreground uppercase",
            colonne.headerClassName,
          )}
        >
          <span className="truncate">{colonne.label}</span>
        </CelluleExcel>
      </div>
      {lignes.map((ligne) => (
        <div
          key={ligne.key}
          className={cn(
            "shrink-0 border-t border-border/40",
            ligne.groupe && ligne.groupeClassName,
            ligne.rowClassName,
          )}
          style={{ height: HAUTEUR_LIGNE_PX }}
        >
          <CelluleExcel align={colonne.align ?? "left"}>
            {ligne.cells[colonne.id] ?? null}
          </CelluleExcel>
        </div>
      ))}
    </div>
  );
}

interface TableauExcelResizableProps {
  colonnes: ColonneExcelDef[];
  lignes: LigneExcelDef[];
  /** Message si aucune ligne. */
  videMessage?: string;
  classNameBordure?: string;
}

/**
 * Grille type Excel : colonnes + lignes redimensionnables, largeur du tableau
 * ajustable via la bordure droite. Sync live des hauteurs entre colonnes.
 */
export function TableauExcelResizable({
  colonnes,
  lignes,
  videMessage = "Aucune donnée à afficher.",
  classNameBordure = "border-2 border-green-600/55",
}: TableauExcelResizableProps) {
  // Ids de Group uniques par instance — évite les collisions au plein écran (portail body).
  const instanceId = useId().replace(/:/g, "");
  const groupesLignesRef = useRef(new Map<string, GroupImperativeHandle>());
  const syncLignesEnCours = useRef(false);
  const pretPourSync = useRef(false);

  useEffect(() => {
    // Laisse tous les Group s’enregistrer avant la 1re sync.
    const t = window.setTimeout(() => {
      pretPourSync.current = true;
    }, 0);
    return () => {
      window.clearTimeout(t);
      pretPourSync.current = false;
      groupesLignesRef.current.clear();
    };
  }, []);

  const enregistrerGroupeLignes = useCallback(
    (id: string, handle: GroupImperativeHandle | null) => {
      if (handle) groupesLignesRef.current.set(id, handle);
      else groupesLignesRef.current.delete(id);
    },
    [],
  );

  const onLayoutLignesChangePour = useCallback(
    (idGroupe: string) => (layout: Layout) => {
      if (!pretPourSync.current || syncLignesEnCours.current) return;
      syncLignesEnCours.current = true;
      try {
        for (const [id, handle] of groupesLignesRef.current) {
          if (id === idGroupe) continue;
          appliquerLayoutSafe(handle, layout);
        }
      } finally {
        syncLignesEnCours.current = false;
      }
    },
    [],
  );

  // Beaucoup de lignes (ex. fiche de dépôt) : au lieu de toutes les écraser dans
  // la hauteur visible, elles gardent une hauteur fixe et la grille défile.
  const zoneRef = useRef<HTMLDivElement>(null);
  const [hauteurZone, setHauteurZone] = useState<number | null>(null);
  const vide = lignes.length === 0;

  // En défilement, l'en-tête de la grille part avec les lignes (le Group impose
  // overflow: hidden, donc pas de sticky) : on superpose un en-tête fixe, calé
  // sur la position mesurée de chaque colonne.
  const [positionsEntete, setPositionsEntete] = useState<{ left: number; width: number }[] | null>(null);
  const mesurerEntete = useCallback(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const origine = zone.getBoundingClientRect().left;
    setPositionsEntete(colonnes.map((colonne) => {
      const rect = document.getElementById(`col-${instanceId}-${colonne.id}`)?.getBoundingClientRect();
      return rect ? { left: rect.left - origine, width: rect.width } : { left: 0, width: 0 };
    }));
  }, [colonnes, instanceId]);
  const mesurerEnteteRef = useRef(mesurerEntete);
  useEffect(() => {
    mesurerEnteteRef.current = mesurerEntete;
  }, [mesurerEntete]);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const observateur = new ResizeObserver(([entree]) => {
      setHauteurZone(Math.round(entree.contentRect.height));
      requestAnimationFrame(() => mesurerEnteteRef.current());
    });
    observateur.observe(zone);

    // Ouvert depuis un Dialog Radix, le verrou de défilement (react-remove-scroll)
    // annule la molette hors du dialogue : la zone défile donc elle-même.
    function defilerMolette(e: WheelEvent) {
      if (!zone || zone.scrollHeight <= zone.clientHeight) return;
      const pas = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 36 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? zone.clientHeight : 1;
      zone.scrollTop += e.deltaY * pas;
      e.preventDefault();
    }
    zone.addEventListener("wheel", defilerMolette, { passive: false });

    return () => {
      observateur.disconnect();
      zone.removeEventListener("wheel", defilerMolette);
    };
  }, [vide]);

  const hauteurNaturelle = HAUTEUR_ENTETE_PX + HAUTEUR_LIGNE_PX * lignes.length;
  // Tant que les lignes tiennent à leur hauteur minimale, elles s'étirent pour
  // remplir la zone (comportement d'origine) ; sinon, défilement.
  const defilement = hauteurZone !== null
    && HAUTEUR_ENTETE_PX + HAUTEUR_LIGNE_MIN_PX * lignes.length > hauteurZone;

  const layoutLignesInitial = useMemo(
    () => layoutLignesDefaut(lignes),
    [lignes],
  );

  useEffect(() => {
    if (!defilement) return;
    const frame = requestAnimationFrame(() => mesurerEnteteRef.current());
    return () => cancelAnimationFrame(frame);
  }, [defilement]);

  if (lignes.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full min-h-44 flex-col items-center justify-center gap-2 rounded-xl px-4 text-center",
          classNameBordure,
        )}
      >
        <Inbox className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-[13px] text-muted-foreground">{videMessage}</p>
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      id={`tableau-wrap-${instanceId}`}
      orientation="horizontal"
      className="h-full min-h-0 w-full"
    >
      <ResizablePanel
        id={`tableau-${instanceId}`}
        defaultSize="100%"
        minSize="40%"
        className="min-w-0"
      >
        <div
          className={cn(
            "relative h-full min-h-0 overflow-hidden rounded-xl bg-background",
            classNameBordure,
          )}
        >
          {defilement && positionsEntete ? (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10">
              {colonnes.map((colonne, index) => {
                const position = positionsEntete[index];
                if (!position || position.width === 0) return null;
                return (
                  <div
                    key={colonne.id}
                    className="absolute top-0 h-10 border-b border-border/80 bg-muted"
                    style={{ left: position.left, width: position.width }}
                  >
                    <CelluleExcel
                      align={colonne.align ?? "left"}
                      className={cn(
                        "bg-muted text-[11px] font-bold tracking-wider text-muted-foreground uppercase",
                        colonne.headerClassName,
                      )}
                    >
                      <span className="truncate">{colonne.label}</span>
                    </CelluleExcel>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div ref={zoneRef} className="h-full overflow-x-hidden overflow-y-auto">
          {hauteurZone !== null ? (
          <div style={{ height: defilement ? hauteurNaturelle : "100%" }}>
          <ResizablePanelGroup
            // Re-monté au changement de mode pour appliquer le nouveau layout des lignes.
            key={defilement ? "defilement" : "ajuste"}
            id={`colonnes-${instanceId}`}
            orientation="horizontal"
            className="h-full w-full"
            onLayoutChange={() => {
              requestAnimationFrame(() => mesurerEnteteRef.current());
            }}
          >
            {colonnes.map((colonne, index) => {
              const idGroupe = `lignes-${instanceId}-${colonne.id}`;
              return (
                <Fragment key={colonne.id}>
                  <ResizablePanel
                    id={`col-${instanceId}-${colonne.id}`}
                    defaultSize={colonne.defaultSize}
                    minSize={colonne.minSize}
                    maxSize={colonne.maxSize}
                  >
                    {defilement ? (
                      <ColonneExcelFixe lignes={lignes} colonne={colonne} />
                    ) : (
                      <ColonneExcel
                        idGroupe={idGroupe}
                        layoutLignes={layoutLignesInitial}
                        onLayoutLignesChange={onLayoutLignesChangePour(idGroupe)}
                        enregistrerGroupe={enregistrerGroupeLignes}
                        lignes={lignes}
                        colonne={colonne}
                      />
                    )}
                  </ResizablePanel>
                  {index < colonnes.length - 1 ? (
                    <ResizableHandle withHandle className="bg-border" />
                  ) : null}
                </Fragment>
              );
            })}
          </ResizablePanelGroup>
          </div>
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Préparation du tableau…
            </div>
          )}
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle className="bg-border" />

      <ResizablePanel
        id={`marge-${instanceId}`}
        defaultSize="0%"
        minSize="0%"
        className="min-w-0 bg-muted/15"
      />
    </ResizablePanelGroup>
  );
}
