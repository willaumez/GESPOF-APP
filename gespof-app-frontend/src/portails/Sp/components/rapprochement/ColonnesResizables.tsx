import { Fragment, useId, type ReactNode } from "react";
import type { Layout } from "react-resizable-panels";
import { cn } from "@/shared/lib/utils";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";

export interface ColonneResizable {
  id: string;
  label: ReactNode;
  /** Taille CSS acceptée par react-resizable-panels (« 40% », « 40px »). */
  defaultSize: string;
  minSize: string;
  maxSize?: string;
  align?: "left" | "right";
  /** Pas de poignée à droite de la colonne (ex. case à cocher). */
  fixe?: boolean;
}

/**
 * En-tête redimensionnable : ses largeurs (en %) sont appliquées au <colgroup>
 * du tableau. Les lignes restent de vrais <tr>, ce qui garde le clic et le
 * glisser-déposer par ligne.
 */
export function EnteteColonnesResizable({
  colonnes,
  onLayoutChange,
}: {
  colonnes: ColonneResizable[];
  onLayoutChange: (layout: Layout) => void;
}) {
  const idGroupe = useId().replace(/:/g, "");
  return (
    <div className="sticky top-0 z-[2] border-b bg-muted/90 backdrop-blur">
      <ResizablePanelGroup
        id={`entete-${idGroupe}`}
        orientation="horizontal"
        className="h-auto"
        onLayoutChange={onLayoutChange}
      >
        {colonnes.map((colonne, index) => (
          <Fragment key={colonne.id}>
            <ResizablePanel
              id={colonne.id}
              defaultSize={colonne.defaultSize}
              minSize={colonne.minSize}
              maxSize={colonne.maxSize}
              className="min-w-0"
            >
              <div
                className={cn(
                  "flex h-9 min-w-0 items-center px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
                  colonne.align === "right" && "justify-end text-right",
                )}
              >
                {typeof colonne.label === "string" ? (
                  <span className="truncate">{colonne.label}</span>
                ) : colonne.label}
              </div>
            </ResizablePanel>
            {index < colonnes.length - 1 && !colonne.fixe ? (
              <ResizableHandle withHandle className="bg-border" />
            ) : null}
          </Fragment>
        ))}
      </ResizablePanelGroup>
    </div>
  );
}

export function ColgroupResizable({
  colonnes,
  layout,
}: {
  colonnes: ColonneResizable[];
  layout: Layout | null;
}) {
  return (
    <colgroup>
      {colonnes.map((colonne) => {
        const pourcentage = layout?.[colonne.id];
        return (
          <col
            key={colonne.id}
            style={{ width: pourcentage != null ? `${pourcentage}%` : colonne.defaultSize }}
          />
        );
      })}
    </colgroup>
  );
}
