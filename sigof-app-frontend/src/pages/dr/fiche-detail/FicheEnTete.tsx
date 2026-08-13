import {
  CalendarDays,
  FileDown,
  Loader2,
  Receipt,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import type { FicheDepotDetail } from "@/interfaces/pool-sr";
import { STATUT_CFG } from "./constants";

interface FicheEnTeteProps {
  reference: string;
  detail: FicheDepotDetail | null;
  loading: boolean;
  chargementTelechargement: boolean;
  aDesActions: boolean;
  peutEnvoyerCetteFiche: boolean;
  peutSupprimer: boolean;
  afficheBarreActions: boolean;
  onTelecharger: () => void;
  onDemanderEnvoi: () => void;
  onDemanderSuppression: () => void;
}

export function FicheEnTete({
  reference,
  detail,
  loading,
  chargementTelechargement,
  aDesActions,
  peutEnvoyerCetteFiche,
  peutSupprimer,
  afficheBarreActions,
  onTelecharger,
  onDemanderEnvoi,
  onDemanderSuppression,
}: FicheEnTeteProps) {
  const st = detail ? (STATUT_CFG[detail.statut] ?? STATUT_CFG.cree) : null;

  return (
    <div
      className={cn(
        "rounded-xl border border-l-3 border-r-3 object-contain bg-card shadow-sm animate-in fade-in-0 slide-in-from-top-1",
        st?.accent,
        st?.bg,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-3 py-1.5">
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Receipt className="size-5" />
          </div>
          <div>
            <p className="text-[8.5px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
              FICHE DE DEPOT
            </p>
            <div className="flex items-center gap-2">
              <p className="break-all font-mono text-lg font-bold leading-none text-foreground sm:text-xl">
                {reference}
              </p>
              {loading ? (
                <Skeleton className="h-5 w-16 rounded-full" />
              ) : st ? (
                <Badge className={cn(st.badge, "gap-1.5")}>
                  <span className={cn("size-1.5 rounded-full", st.dot)} />
                  {st.label}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-12 w-px bg-border" />

        <div className="flex items-center gap-6 flex-shrink-0">
          <div className="flex items-start gap-2.5">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-[11px] text-muted-foreground">Règlements du</p>
              {loading ? (
                <Skeleton className="mt-1 h-4 w-24" />
              ) : (
                <p className="text-sm font-medium text-foreground whitespace-nowrap">
                  {detail?.date_presentation ?? "—"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-[11px] text-muted-foreground">Généré par</p>
              {loading ? (
                <Skeleton className="mt-1 h-4 w-24" />
              ) : detail ? (
                <p className="text-sm font-medium text-foreground whitespace-nowrap">
                  {detail.genere_par.nom_complet}
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    · {detail.genere_par.matricule}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-12 w-px bg-border" />

        {afficheBarreActions && (
          <div className="ml-auto flex flex-shrink-0 items-center gap-3">
            {aDesActions && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="default"
                    variant="outline"
                    onClick={onTelecharger}
                    disabled={!detail?.url_telecharger || chargementTelechargement}
                    className="gap-2"
                  >
                    {chargementTelechargement ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FileDown className="size-4" />
                    )}
                    Télécharger
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Télécharger le fichier Excel</TooltipContent>
              </Tooltip>
            )}

            {peutEnvoyerCetteFiche && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="default"
                    variant="outline"
                    onClick={onDemanderEnvoi}
                    className="gap-2 border-[#1e4d8c] text-[#1e4d8c] hover:bg-[#1e4d8c]/10"
                  >
                    <Send className="size-4" />
                    Envoyer
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Envoyer la fiche au Service de Prévision
                </TooltipContent>
              </Tooltip>
            )}

            {peutSupprimer && (
              <>
                <Separator orientation="vertical" className="h-8 w-px bg-border" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="default"
                      variant="outline"
                      onClick={onDemanderSuppression}
                      className="gap-2 border-destructive text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-4" />
                      Supprimer
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Supprimer la fiche</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
