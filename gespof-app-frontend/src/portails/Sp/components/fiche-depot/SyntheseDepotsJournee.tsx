import type { CSSProperties, ReactNode } from "react";
import { ArrowRightLeft, CheckCheck, Layers, Loader2, Sparkles } from "lucide-react";
import { getPortalMenu } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { formaterMontantDepot } from "@/portails/Sp/components/fiche-depot/fiche-depot-affichage";
import {
  depuisCentimes,
  totalCentimes,
} from "@/portails/Sp/components/rapprochement/rapprochement";
import type { FicheDepotResumeSp } from "@/portails/Sp/types/fiche-depot.interface";
import type { EtatDepensesJour } from "@/portails/Sp/types/journee-tresorerie.interface";

function heure(dateCreation: string): string {
  // Format backend : « JJ/MM/AAAA HH:MM:SS ».
  return dateCreation.split(" ")[1]?.slice(0, 5) ?? dateCreation;
}

function Indicateur({
  libelle,
  children,
  pied,
  style,
}: {
  libelle: string;
  children: ReactNode;
  pied?: ReactNode;
  style: CSSProperties;
}) {
  return (
    <Card size="sm" className="border bg-card shadow-sm" style={style}>
      <CardContent className="space-y-0.5 px-3 py-2.5 sm:px-3.5 sm:py-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {libelle}
        </p>
        <div className="min-w-0 text-[14px] font-bold tabular-nums text-foreground">{children}</div>
        {pied ? <div className="truncate text-[11px] text-muted-foreground">{pied}</div> : null}
      </CardContent>
    </Card>
  );
}

interface SyntheseDepotsJourneeProps {
  /** Fiches de la journée, la plus récente en premier. */
  fiches: FicheDepotResumeSp[];
  etat: EtatDepensesJour | null;
  chargementEtat: boolean;
  /** Pas de journée ouverte : pas de validation ni de rapprochement. */
  avecJournee: boolean;
  lectureSeule: boolean;
  validation: boolean;
  onValider: () => void;
  onRapprochement: () => void;
}

/**
 * Synthèse de la journée : fiches reçues (souvent complémentaires), dépenses
 * uniques après fusion, état de la liste validée et avancement du rapprochement.
 */
export function SyntheseDepotsJournee({
  fiches,
  etat,
  chargementEtat,
  avecJournee,
  lectureSeule,
  validation,
  onValider,
  onRapprochement,
}: SyntheseDepotsJourneeProps) {
  const theme = getPortalMenu("sp").theme;
  const styleCarte: CSSProperties = { borderColor: `${theme.topColor}28` };
  const derniere = fiches[0] ?? null;
  const liste = etat?.depenses_jour ?? null;
  const nonIntegrees = etat?.fiches_non_integrees ?? [];

  const lignesRecues = (etat?.fiches_disponibles ?? []).reduce((s, f) => s + f.nombre_elements, 0);
  const uniques = (etat?.fiches_disponibles ?? []).reduce((s, f) => s + f.nouveaux_elements, 0);
  const rapprochees = liste?.depenses.filter((d) => d.rapprochement != null) ?? [];
  const avancement = liste && liste.nombre > 0 ? Math.round((rapprochees.length / liste.nombre) * 100) : 0;

  const peutValider = avecJournee && !lectureSeule && fiches.length > 0
    && etat != null && (liste == null || nonIntegrees.length > 0);

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Indicateur
          libelle="Fiches reçues"
          style={styleCarte}
          pied={derniere ? `Dernière à ${heure(derniere.date_creation)}` : "Aucune pour l'instant"}
        >
          <span className="flex items-center gap-1.5">
            <Layers className="size-3.5" style={{ color: theme.iconColor }} />
            {fiches.length}
          </span>
        </Indicateur>

        <Indicateur
          libelle="Dernière fiche"
          style={styleCarte}
          pied={derniere ? `${formaterMontantDepot(derniere.montant_total)} FCFA` : undefined}
        >
          <span className="block truncate font-mono text-[13px]">{derniere?.reference ?? "—"}</span>
        </Indicateur>

        <Indicateur
          libelle="Dépenses uniques"
          style={styleCarte}
          pied={
            etat && lignesRecues > uniques
              ? `${lignesRecues - uniques} ligne${lignesRecues - uniques > 1 ? "s" : ""} déjà reçue${lignesRecues - uniques > 1 ? "s" : ""}, non comptée${lignesRecues - uniques > 1 ? "s" : ""}`
              : etat ? "Aucun doublon entre les fiches" : undefined
          }
        >
          {chargementEtat && !etat ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : etat ? (
            <span>
              {uniques}
              <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                / {lignesRecues} lignes reçues
              </span>
            </span>
          ) : (
            "—"
          )}
        </Indicateur>

        <Indicateur
          libelle="Rapprochement"
          style={styleCarte}
          pied={
            liste
              ? `${formaterMontantDepot(depuisCentimes(totalCentimes(rapprochees)))} / ${formaterMontantDepot(liste.total)} FCFA`
              : avecJournee ? "Liste non validée" : "Aucune journée ouverte"
          }
        >
          {liste ? (
            <div className="space-y-1">
              <span>
                {rapprochees.length} / {liste.nombre}
                <span className="ml-1 text-[11px] font-medium text-muted-foreground">({avancement} %)</span>
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${avancement}%` }}
                />
              </div>
            </div>
          ) : (
            "—"
          )}
        </Indicateur>
      </div>

      {avecJournee && fiches.length > 0 && etat ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-[12.5px]",
            liste == null && "border-sky-200 bg-sky-50 text-sky-950",
            liste != null && nonIntegrees.length > 0 && "border-amber-300 bg-amber-50 text-amber-950",
            liste != null && nonIntegrees.length === 0 && "border-emerald-200 bg-emerald-50 text-emerald-950",
          )}
        >
          <p className="flex min-w-0 items-center gap-2">
            {liste == null ? (
              <>
                <CheckCheck className="size-4 shrink-0 text-sky-600" />
                <span>
                  Validez les dépenses de la journée pour les rapprocher de la fiche d&apos;exécution :
                  les {fiches.length} fiche{fiches.length > 1 ? "s" : ""} seront fusionnées sans doublon.
                </span>
              </>
            ) : nonIntegrees.length > 0 ? (
              <>
                <Sparkles className="size-4 shrink-0 text-amber-600" />
                <span>
                  {nonIntegrees.length > 1 ? "Fiches reçues" : "Fiche reçue"} après la validation
                  ({nonIntegrees.join(", ")}) :{" "}
                  <span className="font-semibold">
                    {etat.nouvelles} nouvelle{etat.nouvelles > 1 ? "s" : ""} dépense{etat.nouvelles > 1 ? "s" : ""}
                  </span>{" "}
                  à intégrer.
                </span>
              </>
            ) : (
              <>
                <CheckCheck className="size-4 shrink-0 text-emerald-600" />
                <span>
                  Liste validée : {liste.nombre} dépense{liste.nombre > 1 ? "s" : ""} issues de{" "}
                  {liste.fiches.length} fiche{liste.fiches.length > 1 ? "s" : ""}, à jour.
                </span>
              </>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {peutValider ? (
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 text-white hover:opacity-90"
                style={{ background: theme.ctaColor }}
                disabled={validation}
                onClick={onValider}
              >
                {validation ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
                {liste ? "Intégrer" : "Valider"}
              </Button>
            ) : null}
            {liste ? (
              <Button
                type="button"
                size="sm"
                variant={peutValider ? "outline" : "default"}
                className={cn("h-8 gap-1.5", !peutValider && "text-white hover:opacity-90")}
                style={peutValider ? undefined : { background: theme.ctaColor }}
                onClick={onRapprochement}
              >
                <ArrowRightLeft className="size-3.5" />
                Rapprochement
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
