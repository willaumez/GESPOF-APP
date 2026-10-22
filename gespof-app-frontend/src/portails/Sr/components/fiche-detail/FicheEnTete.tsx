import {
  CalendarDays,
  Eye,
  FileText,
  Loader2,
  Receipt,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { BoutonAcces } from "@/shared/components/ui/bouton-acces";
import { Separator } from "@/shared/components/ui/separator";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import type { FicheDepotDetail } from "@/portails/Sr/types";
import { STATUT_CFG } from "./constants";
import { formaterDateSansHeure } from "./utils";

interface FicheEnTeteProps {
  reference: string;
  detail: FicheDepotDetail | null;
  loading: boolean;
  aDesActions: boolean;
  peutEnvoyerCetteFiche: boolean;
  /** false si écart Systac / montant groupé : l'envoi SP est bloqué. */
  pretPourEnvoiSp?: boolean;
  peutSupprimer: boolean;
  afficheBarreActions: boolean;
  onOuvrirApercuExcel: () => void;
  onDemanderEnvoi: () => void;
  onDemanderSuppression: () => void;
  onOuvrirFicheBleue?: () => void;
  chargementFicheBleue?: boolean;
}

export function FicheEnTete({
  reference,
  detail,
  loading,
  aDesActions,
  peutEnvoyerCetteFiche,
  pretPourEnvoiSp = true,
  peutSupprimer,
  afficheBarreActions,
  onOuvrirApercuExcel,
  onDemanderEnvoi,
  onDemanderSuppression,
  onOuvrirFicheBleue,
  chargementFicheBleue = false,
}: FicheEnTeteProps) {
  const st = detail ? (STATUT_CFG[detail.statut] ?? STATUT_CFG.cree) : null;
  const envoiBloque = peutEnvoyerCetteFiche && !pretPourEnvoiSp;

  return (
    <div
      className={cn(
        "rounded-xl border border-l-3 border-r-3 bg-card shadow-sm animate-in fade-in-0 slide-in-from-top-1",
        st?.accent,
        st?.bg,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Receipt className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[8.5px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
              FICHE DE DEPOT
            </p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-lg font-bold leading-none text-foreground sm:text-xl">
                {reference}
              </p>
              {loading ? (
                <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
              ) : st ? (
                <Badge className={cn(st.badge, "shrink-0 gap-1.5")}>
                  <span className={cn("size-1.5 rounded-full", st.dot)} />
                  {st.label}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <Separator orientation="vertical" className="hidden h-10 w-px bg-border md:block" />

        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-[11px] leading-none text-muted-foreground">Règlements du</p>
              {loading ? (
                <Skeleton className="mt-1 h-4 w-24" />
              ) : (
                <p className="mt-0.5 text-sm font-medium leading-tight text-foreground">
                  {formaterDateSansHeure(detail?.date_presentation)}
                </p>
              )}
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <UserRound className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[11px] leading-none text-muted-foreground">Généré par</p>
              {loading ? (
                <Skeleton className="mt-1 h-4 w-24" />
              ) : detail ? (
                <p
                  className="mt-0.5 truncate text-sm font-medium leading-tight text-foreground"
                  title={`${detail.genere_par.nom_complet} · ${detail.genere_par.matricule}`}
                >
                  {detail.genere_par.nom_complet}
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    · {detail.genere_par.matricule}
                  </span>
                </p>
              ) : (
                <p className="mt-0.5 text-sm leading-tight text-muted-foreground">—</p>
              )}
            </div>
          </div>
          {detail?.fiche_recue ? (
            <div className="flex min-w-0 items-center gap-2">
              <Receipt className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[11px] leading-none text-muted-foreground">
                  Dépenses reçues du SP
                </p>
                <p
                  className="mt-0.5 truncate font-mono text-sm font-medium leading-tight text-foreground"
                  title={detail.fiche_recue.reference}
                >
                  {detail.fiche_recue.reference}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {afficheBarreActions && (
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            {onOuvrirFicheBleue ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onOuvrirFicheBleue}
                    disabled={chargementFicheBleue}
                    className="h-8 gap-2"
                  >
                    {chargementFicheBleue ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                    Fiche Bleue
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Afficher les dépenses de la Fiche Bleue
                </TooltipContent>
              </Tooltip>
            ) : null}

            {aDesActions && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onOuvrirApercuExcel}
                    disabled={!detail}
                    className="h-8 gap-2"
                  >
                    <Eye className="size-4" />
                    Aperçu
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Prévisualiser, télécharger ou imprimer la fiche Excel
                </TooltipContent>
              </Tooltip>
            )}

            {peutEnvoyerCetteFiche && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <BoutonAcces
                      acces="VALIDER_FICHE_DEPOT"
                      size="sm"
                      variant="outline"
                      onClick={onDemanderEnvoi}
                      disabled={envoiBloque}
                      className="h-8 gap-2 border-[#1e4d8c] text-[#1e4d8c] hover:bg-[#1e4d8c]/10"
                    >
                      <Send className="size-4" />
                      Envoyer
                    </BoutonAcces>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {envoiBloque
                    ? "Corrigez l'écart Systac / montant groupé avant l'envoi au SP"
                    : "Envoyer la fiche au Service de Prévision"}
                </TooltipContent>
              </Tooltip>
            )}

            {peutSupprimer ? (
              <>
                {(aDesActions || peutEnvoyerCetteFiche || Boolean(onOuvrirFicheBleue)) && (
                  <Separator orientation="vertical" className="hidden h-7 w-px bg-border sm:block" />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <BoutonAcces
                        acces="SUPPRIMER_FICHE_DEPOT"
                        size="sm"
                        variant="outline"
                        onClick={onDemanderSuppression}
                        className="h-8 gap-2 border-destructive text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4" />
                        Supprimer
                      </BoutonAcces>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">Supprimer la fiche</TooltipContent>
                </Tooltip>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
