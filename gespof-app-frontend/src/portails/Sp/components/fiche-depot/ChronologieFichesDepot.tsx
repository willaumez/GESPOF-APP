import { CheckCheck, Copy, Plus, Sparkles } from "lucide-react";
import { getPortalMenu } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import {
  formaterMontantDepot, STATUT_FICHE_DEPOT,
} from "@/portails/Sp/components/fiche-depot/fiche-depot-affichage";
import type { FicheDepotResumeSp } from "@/portails/Sp/types/fiche-depot.interface";
import type { EtatDepensesJour } from "@/portails/Sp/types/journee-tresorerie.interface";

function heure(dateCreation: string): string {
  return dateCreation.split(" ")[1]?.slice(0, 5) ?? dateCreation;
}

interface ChronologieFichesDepotProps {
  /** Fiches de la journée, la plus récente en premier. */
  fiches: FicheDepotResumeSp[];
  etat: EtatDepensesJour | null;
  selection: string | null;
  onSelection: (reference: string) => void;
}

/**
 * Frise des fiches de dépôt de la journée. Chaque fiche indique ce qu'elle
 * apporte par rapport aux précédentes (une fiche reprend souvent la précédente).
 */
export function ChronologieFichesDepot({
  fiches,
  etat,
  selection,
  onSelection,
}: ChronologieFichesDepotProps) {
  const theme = getPortalMenu("sp").theme;
  const apports = new Map((etat?.fiches_disponibles ?? []).map((f) => [f.reference, f]));
  const nonIntegrees = new Set(etat?.fiches_non_integrees ?? []);
  const validee = etat?.depenses_jour != null;

  return (
    <ol className="relative space-y-2 p-3">
      {fiches.map((fiche, index) => {
        const active = fiche.reference === selection;
        const apport = apports.get(fiche.reference);
        const statut = STATUT_FICHE_DEPOT[fiche.statut] ?? STATUT_FICHE_DEPOT.cree;
        const premiere = index === fiches.length - 1;
        const reprises = apport ? apport.nombre_elements - apport.nouveaux_elements : 0;
        return (
          <li key={fiche.reference} className="relative pl-6">
            {/* Frise : trait vertical + pastille. */}
            {index < fiches.length - 1 ? (
              <span aria-hidden className="absolute top-5 bottom-[-0.75rem] left-[7px] w-px bg-border" />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "absolute top-3.5 left-0 size-[15px] rounded-full border-2 bg-background",
                active && "border-[5px]",
              )}
              style={{ borderColor: active ? theme.topColor : `${theme.topColor}55` }}
            />

            <button
              type="button"
              onClick={() => onSelection(fiche.reference)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                active ? "border-2 bg-card shadow-sm" : "border-transparent hover:bg-muted/60",
              )}
              style={active ? { borderColor: theme.topColor } : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[12.5px] font-semibold tabular-nums">
                  {fiche.reference}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {heure(fiche.date_creation)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold tabular-nums text-foreground">
                  {formaterMontantDepot(fiche.montant_total)} FCFA
                </span>
                <Badge className={cn(statut.badge, "text-[10px]")}>{statut.label}</Badge>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {index === 0 ? (
                  <Badge className="border-transparent bg-primary/10 text-[10px] text-primary">Dernière</Badge>
                ) : null}
                {apport ? (
                  premiere || reprises === 0 ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1.5 py-0.5 text-[10.5px] font-medium text-sky-900">
                      <Plus className="size-3" />
                      {apport.nouveaux_elements} élément{apport.nouveaux_elements > 1 ? "s" : ""}
                    </span>
                  ) : apport.nouveaux_elements > 0 ? (
                    <span
                      className="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1.5 py-0.5 text-[10.5px] font-medium text-sky-900"
                      title={`${reprises} élément(s) déjà présents dans les fiches précédentes`}
                    >
                      <Plus className="size-3" />
                      {apport.nouveaux_elements} nouveau{apport.nouveaux_elements > 1 ? "x" : ""}
                      <span className="font-normal text-sky-800/80"> · reprend {reprises}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-700">
                      <Copy className="size-3" />
                      Aucun nouvel élément
                    </span>
                  )
                ) : null}
                {validee ? (
                  nonIntegrees.has(fiche.reference) ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-950">
                      <Sparkles className="size-2.5" />
                      Non intégrée
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
                      <CheckCheck className="size-2.5" />
                      Intégrée
                    </span>
                  )
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
