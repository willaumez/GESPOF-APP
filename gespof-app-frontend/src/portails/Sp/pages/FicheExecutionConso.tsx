import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { getPortalMenu } from "@/shared/config/menu";
import { chargerFicheExecutionConso } from "@/portails/Sp/api/fiche-execution-conso";
import { TableauFicheExecutionConso } from "@/portails/Sp/components/fiche-execution/TableauFicheExecutionConso";
import { SpBoutonPrimaire } from "@/portails/Sp/components/layout/SpBoutonsPage";
import { SpPageHeader } from "@/portails/Sp/components/layout/SpPageHeader";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import type {
  MatriceFicheExecutionConso,
  PeriodeConso,
  VueConso,
} from "@/portails/Sp/types/fiche-execution-conso.interface";

const theme = getPortalMenu("sp").theme;

const ONGLETS: { id: VueConso; label: string }[] = [
  { id: "semaine", label: "Semaine" },
  { id: "mois", label: "Mois" },
  { id: "annee", label: "Année" },
];

const TEXTES_VUE: Record<VueConso, string> = {
  semaine:
    "Les montants réalisés saisis dans la Fiche d'exécution alimentent la semaine en cours. La clôture fige la journée. Une nouvelle consolidation commence le lundi suivant.",
  mois: "Le mois rassemble les semaines du premier au dernier jour ouvré. La colonne TOTAL cumule le mois.",
  annee:
    "Totaux par mois de janvier à décembre. La colonne TOTAL cumule l'année.",
};

function dateDepuisCle(vue: VueConso, cle: string): string {
  if (vue === "annee") return `${cle}-01-01`;
  if (vue === "mois") return `${cle}-01`;
  return cle;
}

function groupePeriodes(
  vue: VueConso,
  periodes: PeriodeConso[],
): { groupe: string; periodes: PeriodeConso[] }[] {
  if (vue !== "mois") {
    return [{ groupe: "", periodes }];
  }
  const groupes: { groupe: string; periodes: PeriodeConso[] }[] = [];
  for (const periode of periodes) {
    const annee = periode.cle.slice(0, 4);
    const dernier = groupes[groupes.length - 1];
    if (dernier?.groupe === annee) {
      dernier.periodes.push(periode);
    } else {
      groupes.push({ groupe: annee, periodes: [periode] });
    }
  }
  return groupes;
}

/**
 * Fiche d'exécution consolidée — Prototype v2
 * (onglets Semaine / Mois / Année · note · tableau rubriques).
 */
export default function FicheExecutionConso() {
  const [vue, setVue] = useState<VueConso>("semaine");
  const { dateIso: dateJournee } = useJourneeSelectionnee();
  const [datePivot, setDatePivot] = useState(dateJournee);
  const [journeeSuivie, setJourneeSuivie] = useState(dateJournee);
  if (journeeSuivie !== dateJournee) {
    setJourneeSuivie(dateJournee);
    setDatePivot(dateJournee);
  }
  const [chargement, setChargement] = useState(true);
  const [matrice, setMatrice] = useState<MatriceFicheExecutionConso | null>(
    null,
  );
  const [menuPeriodeOuvert, setMenuPeriodeOuvert] = useState(false);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setMatrice(null);
    void chargerFicheExecutionConso(vue, datePivot)
      .then((data) => {
        if (actif) setMatrice(data);
      })
      .catch((e) => {
        if (actif) {
          setMatrice(null);
          toast.error(
            e instanceof Error
              ? e.message
              : "Impossible de charger la fiche consolidée.",
          );
        }
      })
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, [vue, datePivot]);

  const periodes = matrice?.periodes ?? [];
  const cleAffichee = useMemo(() => {
    if (!matrice) return "";
    if (vue === "annee") return matrice.date.slice(0, 4);
    if (vue === "mois") return matrice.date.slice(0, 7);
    return matrice.lundi ?? matrice.date;
  }, [matrice, vue]);
  const indexPeriode = periodes.findIndex((p) => p.cle === cleAffichee);
  const periodePrecedente =
    indexPeriode >= 0 ? periodes[indexPeriode + 1] : undefined;
  const periodeSuivante =
    indexPeriode > 0 ? periodes[indexPeriode - 1] : undefined;
  const groupes = useMemo(
    () => groupePeriodes(vue, periodes),
    [vue, periodes],
  );

  const libellePeriode =
    matrice?.libelle ?? matrice?.libelle_semaine ?? "Période";
  const eyebrow = chargement && !matrice ? "…" : libellePeriode;

  return (
    <div className="flex flex-col gap-6">
      <SpPageHeader
        eyebrow={eyebrow}
        title="Fiche d'exécution consolidée"
        description="Consolidation des montants réalisés par rubrique, alimentée à chaque clôture de journée."
        actions={
          <>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!periodePrecedente || chargement}
                onClick={() => {
                  if (periodePrecedente) {
                    setDatePivot(dateDepuisCle(vue, periodePrecedente.cle));
                  }
                }}
                aria-label="Période précédente"
                className="grid size-[38px] place-items-center rounded-md border border-[#cbd5e1] bg-white text-[#0f172a] hover:border-[#94a3b8] hover:bg-[#f8fafc] disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <Popover
                open={menuPeriodeOuvert}
                onOpenChange={setMenuPeriodeOuvert}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={chargement || periodes.length === 0}
                    aria-label="Choisir une période"
                    aria-expanded={menuPeriodeOuvert}
                    className="inline-flex h-[38px] min-w-[10rem] max-w-[18rem] items-center justify-between gap-2 rounded-md border border-[#cbd5e1] bg-white px-3 text-[13px] font-semibold text-[#0f172a] hover:border-[#94a3b8] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="truncate">{libellePeriode}</span>
                    <ChevronDown size={14} className="shrink-0 text-[#64748b]" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="center"
                  className="z-[80] max-h-80 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-1"
                >
                  {groupes.map((groupe) => (
                    <div key={groupe.groupe || "periodes"}>
                      {groupe.groupe ? (
                        <div className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-[#64748b] uppercase">
                          {groupe.groupe}
                        </div>
                      ) : null}
                      {groupe.periodes.map((periode) => {
                        const actif = periode.cle === cleAffichee;
                        return (
                          <button
                            key={periode.cle}
                            type="button"
                            onClick={() => {
                              setDatePivot(dateDepuisCle(vue, periode.cle));
                              setMenuPeriodeOuvert(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-[#f8fafc]"
                            style={{
                              fontWeight: actif ? 600 : 400,
                              color: actif ? theme.textColor : "#0f172a",
                              background: actif ? theme.bgColor : undefined,
                            }}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {periode.libelle}
                              {periode.actuelle ? " · actuelle" : ""}
                            </span>
                            {actif ? (
                              <Check size={14} className="shrink-0" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </PopoverContent>
              </Popover>
              <button
                type="button"
                disabled={!periodeSuivante || chargement}
                onClick={() => {
                  if (periodeSuivante) {
                    setDatePivot(dateDepuisCle(vue, periodeSuivante.cle));
                  }
                }}
                aria-label="Période suivante"
                className="grid size-[38px] place-items-center rounded-md border border-[#cbd5e1] bg-white text-[#0f172a] hover:border-[#94a3b8] hover:bg-[#f8fafc] disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <SpBoutonPrimaire
              onClick={() => toast.info("Export Excel à venir.")}
            >
              <Download size={16} />
              Exporter Excel
            </SpBoutonPrimaire>
          </>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div className="flex gap-1 overflow-x-auto border-b border-[#e2e8f0] px-3 [scrollbar-width:none]">
          {ONGLETS.map((tb) => {
            const on = vue === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                onClick={() => {
                  if (tb.id !== vue) setVue(tb.id);
                }}
                className="flex h-[46px] items-center gap-2 px-3 text-sm whitespace-nowrap"
                style={{
                  fontWeight: on ? 600 : 500,
                  color: on ? theme.textColor : "#64748b",
                  boxShadow: on
                    ? `inset 0 -2px 0 ${theme.topColor}`
                    : undefined,
                }}
              >
                {tb.label}
              </button>
            );
          })}
        </div>

        <div
          className="flex items-start gap-2.5 border-b border-[#e2e8f0] text-[13.5px] leading-[1.55] text-[#334155]"
          style={{
            padding: "12px 18px",
            background: theme.bgColor,
          }}
        >
          <span
            className="mt-0.5 flex shrink-0"
            style={{ color: theme.textColor }}
          >
            <Info size={16} />
          </span>
          <span>{TEXTES_VUE[vue]}</span>
        </div>

        {chargement && !matrice ? (
          <div className="flex min-h-[240px] items-center justify-center gap-2 text-[#64748b]">
            <Loader2 className="size-5 animate-spin" />
            Chargement…
          </div>
        ) : (
          <TableauFicheExecutionConso
            matrice={matrice}
            chargement={chargement}
          />
        )}
      </div>
    </div>
  );
}
