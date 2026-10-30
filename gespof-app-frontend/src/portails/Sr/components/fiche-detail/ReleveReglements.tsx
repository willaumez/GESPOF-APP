import { Fragment, useState, type ReactNode } from "react";
import { Inbox, Search } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/components/ui/empty";
import { cn } from "@/shared/lib/utils";
import { formatMontant } from "@/shared/lib/format";
import {
  BoutonPleinEcran,
  OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import type { FicheDepotDetail } from "@/portails/Sr/types";
import { TYPE_CFG, type SectionMouvement, type TypeMouvement } from "./constants";
import { correspondFiltre, formaterDateSansHeure, libelleObservations } from "./utils";

interface ReleveReglementsProps {
  detail: FicheDepotDetail | null;
  loading: boolean;
  error: boolean;
  sections: SectionMouvement[];
  totalLignesAffichees: number;
  totalLignesTableau: number;
  totalAnime: number;
  totauxSystacCorrespondent: boolean;
  onOuvrirFamille: (type: TypeMouvement) => void;
}

function FiltresFamilles({
  sections,
  detail,
  loading,
  totalAnime,
  totauxSystacCorrespondent,
  onOuvrirFamille,
}: {
  sections: SectionMouvement[];
  detail: FicheDepotDetail | null;
  loading: boolean;
  totalAnime: number;
  totauxSystacCorrespondent: boolean;
  onOuvrirFamille: (type: TypeMouvement) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {sections.map(({ type, montant }, index) => {
        const cfg = TYPE_CFG[type];
        const estSystac = type === "systac";
        const enErreur = estSystac && !totauxSystacCorrespondent;

        const bouton = (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs",
              estSystac &&
                (totauxSystacCorrespondent
                  ? "border-[#2a7f62] bg-[#2a7f62]/5 hover:bg-[#2a7f62]/10"
                  : "border-destructive bg-destructive/5 hover:bg-destructive/10"),
            )}
            onClick={() => onOuvrirFamille(type)}
          >
            <span className="text-muted-foreground">{cfg.label}</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                enErreur ? "text-destructive" : "text-[#0760A8]",
              )}
            >
              {formatMontant(String(montant))} FCFA
            </span>
          </Button>
        );

        return (
          <Fragment key={type}>
            {index > 0 && (
              <span
                className="text-sm font-semibold text-muted-foreground"
                aria-hidden="true"
              >
                +
              </span>
            )}
            {estSystac ? (
              <Tooltip>
                <TooltipTrigger asChild>{bouton}</TooltipTrigger>
                <TooltipContent side="top">
                  {totauxSystacCorrespondent
                    ? "Montant Systac et montant groupé identiques."
                    : `Écart : Systac ${formatMontant(detail?.total_systac ?? "0")} FCFA — Groupé ${formatMontant(detail?.total_groupe ?? "0")} FCFA`}
                </TooltipContent>
              </Tooltip>
            ) : (
              bouton
            )}
          </Fragment>
        );
      })}

      <span className="text-sm font-semibold text-muted-foreground" aria-hidden="true">
        =
      </span>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className="h-8 gap-1.5 text-xs disabled:cursor-default disabled:opacity-100"
      >
        <span className="text-muted-foreground">Total général</span>
        {loading ? (
          <Skeleton className="h-3.5 w-16" />
        ) : (
          <span className="font-semibold tabular-nums text-[#0760A8]">
            {formatMontant(String(totalAnime))} FCFA
          </span>
        )}
      </Button>
    </div>
  );
}

function TableauReleve({
  detail,
  sections,
  filtre,
}: {
  detail: FicheDepotDetail;
  sections: SectionMouvement[];
  filtre: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
      <Table containerClassName="min-h-0 flex-1 overflow-auto">
        <TableHeader className="sticky top-0 z-20 bg-muted">
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className="whitespace-nowrap">Date du virement</TableHead>
            <TableHead className="min-w-[200px]">Bénéficiaires</TableHead>
            <TableHead className="whitespace-nowrap">N° O.V.</TableHead>
            <TableHead className="whitespace-nowrap">Banques</TableHead>
            <TableHead className="whitespace-nowrap text-right">Dépenses</TableHead>
            <TableHead className="min-w-[160px]">Observations</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sections.map(({ type, lignes, total, totalGroupe }) => {
            const cfg = TYPE_CFG[type];
            const lignesFiltrees = lignes.filter((l) =>
              correspondFiltre({ ...l, type }, filtre),
            );

            return (
              <Fragment key={type}>
                <TableRow className={cn("hover:bg-inherit", cfg.bar)}>
                  <TableCell
                    colSpan={4}
                    className="text-[11px] font-bold uppercase tracking-wide"
                  >
                    {cfg.label}
                  </TableCell>
                  <TableCell className="text-right text-[13px] font-bold tabular-nums" />
                  <TableCell />
                </TableRow>
                {lignesFiltrees.map((l) => (
                  <TableRow key={`${type}-${l.id}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formaterDateSansHeure(l.date_virement)}
                    </TableCell>
                    <TableCell
                      className="max-w-[260px] truncate font-medium text-foreground"
                      title={l.beneficiaire}
                    >
                      {l.beneficiaire}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {l.numero_ov ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {l.banque ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-medium tabular-nums text-foreground">
                      {formatMontant(
                        String(type === "systac" ? (l.montant_groupe ?? l.depenses) : l.depenses),
                      )}
                    </TableCell>
                    <TableCell
                      className="max-w-[220px] truncate text-muted-foreground"
                      title={libelleObservations(l) || undefined}
                    >
                      {libelleObservations(l) || "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className={cn("hover:bg-inherit", cfg.subtotal)}>
                  <TableCell
                    colSpan={4}
                    className="text-[11px] font-bold uppercase tracking-wide"
                  >
                    {`Total règlements ${cfg.label.toLowerCase()}`}
                  </TableCell>
                  <TableCell className="text-right text-[13px] font-bold tabular-nums">
                    {(() => {
                      const valeur = type === "systac" ? (totalGroupe ?? total) : total;
                      return valeur !== undefined ? formatMontant(valeur) : "";
                    })()}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </Fragment>
            );
          })}
          <TableRow className="bg-primary/15 text-foreground hover:bg-primary/15">
            <TableCell colSpan={4} className="text-[11px] font-bold uppercase tracking-wide">
              Total général
            </TableCell>
            <TableCell className="text-right text-sm font-bold tabular-nums">
              {formatMontant(detail.montant_total)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export function ReleveReglements({
  detail,
  loading,
  error,
  sections,
  totalLignesAffichees,
  totalLignesTableau,
  totalAnime,
  totauxSystacCorrespondent,
  onOuvrirFamille,
}: ReleveReglementsProps) {
  const [recherche, setRecherche] = useState("");
  const [pleinEcran, setPleinEcran] = useState(false);
  const filtre = recherche.trim().toLowerCase();
  const peutPleinEcran = Boolean(detail && totalLignesTableau > 0);

  const champRecherche = (
    <div className="relative min-w-0 w-full sm:min-w-[14rem] sm:flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Rechercher par bénéficiaire, banque ou n° O.V…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        className="h-8 w-full pl-8 text-xs"
      />
    </div>
  );

  const filtres: ReactNode = (
    <FiltresFamilles
      sections={sections}
      detail={detail}
      loading={loading}
      totalAnime={totalAnime}
      totauxSystacCorrespondent={totauxSystacCorrespondent}
      onOuvrirFamille={onOuvrirFamille}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Relevé des règlements</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {detail && totalLignesAffichees > 0 ? (
            <Badge variant="secondary" className="font-normal">
              {totalLignesAffichees} ligne
              {totalLignesAffichees > 1 ? "s" : ""}
            </Badge>
          ) : null}
          {peutPleinEcran ? (
            <BoutonPleinEcran
              actif={pleinEcran}
              onToggle={() => setPleinEcran((v) => !v)}
              libelleEnter="Afficher le relevé en plein écran"
            />
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : error ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>Erreur de chargement</EmptyTitle>
            <EmptyDescription>
              Impossible de récupérer les lignes de cette fiche.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : !detail || totalLignesTableau === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>Aucune ligne</EmptyTitle>
            <EmptyDescription>
              Cette fiche ne contient aucune ligne de règlement.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            {champRecherche}
            {filtres}
          </div>
          <TableauReleve detail={detail} sections={sections} filtre={filtre} />
        </div>
      )}

      {detail && peutPleinEcran ? (
        <OverlayPleinEcran
          ouvert={pleinEcran}
          portail="sr"
          titre="Relevé des règlements"
          sousTitre={`${totalLignesAffichees} ligne${totalLignesAffichees > 1 ? "s" : ""}`}
          onClose={() => setPleinEcran(false)}
          ariaLabel="Relevé des règlements en plein écran"
        >
          <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              {champRecherche}
              {filtres}
            </div>
            <TableauReleve detail={detail} sections={sections} filtre={filtre} />
          </div>
        </OverlayPleinEcran>
      ) : null}
    </div>
  );
}
