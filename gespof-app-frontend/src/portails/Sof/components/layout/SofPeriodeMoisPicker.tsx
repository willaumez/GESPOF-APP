import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listerPeriodes } from "@/portails/Sof/api/referentiel";
import type {
  PeriodeSof,
  StatutPeriodeSof,
} from "@/portails/Sof/types/referentiel.interface";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";
import { getPortalMenu } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";

const LIB_STATUT: Record<StatutPeriodeSof, string> = {
  ouverte: "Ouverte",
  en_controle: "En contrôle",
  validee: "Validée",
  publiee: "Publiée",
};

const BADGE_STATUT: Record<StatutPeriodeSof, string> = {
  ouverte: "border-transparent bg-[#e3f1ea] text-[#1e6650]",
  en_controle: "border-transparent bg-[#fef3c7] text-[#92400e]",
  validee: "border-transparent bg-[#fef3c7] text-[#92400e]",
  publiee: "border-transparent bg-[#e2e8f0] text-[#334155]",
};

const NOMS_MOIS = [
  "",
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
] as const;

function capitaliser(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function libelleMois(p: PeriodeSof): string {
  if (p.mois_libelle) {
    return `${capitaliser(p.mois_libelle)} ${p.exercice_annee}`;
  }
  const n = NOMS_MOIS[p.mois] ?? String(p.mois);
  return `${n} ${p.exercice_annee}`;
}

function dateSituationFr(iso: string | null): string {
  if (!iso) return "Fin de mois";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function finDeMois(annee: number, mois: number): Date {
  return new Date(annee, mois, 0);
}

function periodeVersRange(p: PeriodeSof) {
  const from = new Date(p.exercice_annee, p.mois - 1, 1);
  let to: Date;
  if (p.date_situation) {
    const [y, m, d] = p.date_situation.slice(0, 10).split("-").map(Number);
    to = new Date(y, m - 1, d);
  } else {
    to = finDeMois(p.exercice_annee, p.mois);
  }
  return { from, to };
}

function libelleStatut(p: PeriodeSof): string {
  return p.statut_libelle || LIB_STATUT[p.statut];
}

/**
 * Sélecteur de période SOF — même approche que SelecteurJourneeSp (SP) :
 * bouton compact h-10 dans la topbar + Popover liste.
 */
export function SofPeriodeMoisPicker() {
  const theme = getPortalMenu("sof").theme;
  const { setPeriode, setPeriodeSof, periodeSof } = usePeriode();
  const [periodes, setPeriodes] = useState<PeriodeSof[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    listerPeriodes()
      .then((res) => {
        if (!actif) return;
        const liste = [...(res.periodes ?? [])].sort(
          (a, b) =>
            b.exercice_annee - a.exercice_annee || b.mois - a.mois,
        );
        setPeriodes(liste);
        if (liste[0] && !periodeSof) {
          setPeriodeSof(liste[0]);
          setPeriode(periodeVersRange(liste[0]));
        }
      })
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger les périodes.",
        ),
      )
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once
  }, []);

  const exercice =
    periodeSof?.exercice_annee ??
    periodes[0]?.exercice_annee ??
    new Date().getFullYear();

  const duMemeExercice = useMemo(
    () => periodes.filter((p) => p.exercice_annee === exercice),
    [periodes, exercice],
  );

  function choisir(p: PeriodeSof) {
    setPeriodeSof(p);
    setPeriode(periodeVersRange(p));
    setOuvert(false);
  }

  const styleSelection = {
    background: `${theme.topColor}14`,
    borderColor: `${theme.topColor}55`,
    boxShadow: `inset 3px 0 0 ${theme.topColor}`,
  };

  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full min-w-0 max-w-full justify-start gap-2 rounded-xl border-2 bg-card px-2 pr-2.5 font-normal shadow-sm hover:bg-card hover:shadow-md aria-expanded:bg-card aria-expanded:shadow-md @2xl/topbar:gap-2.5 @4xl/topbar:w-auto @4xl/topbar:max-w-[28rem] @6xl/topbar:min-w-[18rem]"
          style={{
            borderColor: ouvert ? theme.topColor : `${theme.topColor}33`,
            boxShadow: ouvert ? `0 0 0 3px ${theme.topColor}22` : undefined,
          }}
          aria-label="Changer de mois"
        >
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: theme.iconBg, color: theme.iconColor }}
          >
            <CalendarDays className="size-3.5" />
          </span>
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="hidden text-[10px] font-semibold tracking-[0.14em] text-foreground/45 uppercase @2xl/topbar:inline">
              Mois
            </span>
            <span className="truncate font-semibold text-[#0f172a]">
              {periodeSof ? libelleMois(periodeSof) : "Sélectionner un mois"}
            </span>
            {periodeSof ? (
              <span className="hidden truncate text-[11px] text-muted-foreground @5xl/topbar:inline">
                Sit. {dateSituationFr(periodeSof.date_situation)}
              </span>
            ) : null}
          </span>
          {chargement ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : periodeSof ? (
            <Badge
              className={cn(
                "hidden shrink-0 @md/topbar:inline-flex",
                BADGE_STATUT[periodeSof.statut],
              )}
            >
              {libelleStatut(periodeSof)}
            </Badge>
          ) : null}
          <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="w-[min(22rem,calc(100vw-1rem))] min-w-(--radix-popover-trigger-width) gap-0 overflow-hidden p-0"
      >
        <div
          className="border-b px-3.5 py-2.5"
          style={{ borderColor: `${theme.topColor}22` }}
        >
          <p
            className="text-[10px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: theme.iconColor }}
          >
            Exercice {exercice}
          </p>
          {periodeSof ? (
            <p className="mt-0.5 text-[12.5px] text-[#64748b]">
              Situation au {dateSituationFr(periodeSof.date_situation)}
            </p>
          ) : null}
        </div>

        <ul className="max-h-72 overflow-y-auto p-1.5">
          {duMemeExercice.length === 0 ? (
            <li className="px-2.5 py-3 text-[13px] text-[#64748b]">
              {chargement ? "Chargement…" : "Aucune période enregistrée."}
            </li>
          ) : (
            duMemeExercice.map((p) => {
              const actif = periodeSof?.id === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => choisir(p)}
                    aria-current={actif ? "true" : undefined}
                    className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                    style={actif ? styleSelection : undefined}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13.5px] font-semibold text-[#0f172a]">
                        {libelleMois(p)}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        Situation au {dateSituationFr(p.date_situation)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Badge className={BADGE_STATUT[p.statut]}>
                        {libelleStatut(p)}
                      </Badge>
                      {actif ? (
                        <span
                          className="flex items-center gap-1 text-[10.5px] font-semibold"
                          style={{ color: theme.hoverColor }}
                        >
                          <CheckCircle2 className="size-3" />
                          Sélectionnée
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
