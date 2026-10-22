import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { ButtonGroup } from "@/shared/components/ui/button-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/shared/components/ui/select";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { chargerFicheExecutionConso } from "@/portails/Sp/api/fiche-execution-conso";
import { TableauFicheExecutionConso } from "@/portails/Sp/components/fiche-execution/TableauFicheExecutionConso";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import {
  BoutonPleinEcran,
  OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import type {
  MatriceFicheExecutionConso,
  PeriodeConso,
  VueConso,
} from "@/portails/Sp/types/fiche-execution-conso.interface";

const VUES: {
  id: VueConso;
  label: string;
  icon: typeof CalendarRange;
}[] = [
  { id: "semaine", label: "Semaine", icon: CalendarRange },
  { id: "mois", label: "Mois", icon: Calendar },
  { id: "annee", label: "Année", icon: CalendarDays },
];

const TEXTES_VUE: Record<VueConso, string> = {
  semaine:
    "Les montants réalisés saisis dans la Fiche d'exécution alimentent la semaine en cours. La clôture fige la journée. Une nouvelle consolidation commence le lundi suivant.",
  mois: "Le mois rassemble les semaines du premier au dernier jour ouvré. La colonne TOTAL cumule le mois.",
  annee:
    "Totaux par mois de janvier à décembre. La colonne TOTAL cumule l'année.",
};

const LIBELLE_VUE: Record<VueConso, string> = {
  semaine: "Semaine",
  mois: "Mois",
  annee: "Année",
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

export default function FicheExecutionConso() {
  const [vue, setVue] = useState<VueConso>("semaine");
  // La période affichée part de la journée choisie dans la TopBar.
  const { dateIso: dateJournee } = useJourneeSelectionnee();
  const [datePivot, setDatePivot] = useState(dateJournee);
  const [journeeSuivie, setJourneeSuivie] = useState(dateJournee);
  if (journeeSuivie !== dateJournee) {
    setJourneeSuivie(dateJournee);
    setDatePivot(dateJournee);
  }
  const [chargement, setChargement] = useState(true);
  const [matrice, setMatrice] = useState<MatriceFicheExecutionConso | null>(null);
  const [pleinEcran, setPleinEcran] = useState(false);

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

  const navigationPeriode = (options?: { avecSelect?: boolean }) => {
    const avecSelect = options?.avecSelect ?? true;
    return (
      <div className="flex min-w-0 max-w-full items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          disabled={!periodePrecedente || chargement}
          onClick={() => {
            if (periodePrecedente) {
              setDatePivot(dateDepuisCle(vue, periodePrecedente.cle));
            }
          }}
          aria-label="Période précédente"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {avecSelect ? (
          <Select
            value={cleAffichee}
            onValueChange={(valeur) => {
              if (periodes.some((p) => p.cle === valeur)) {
                setDatePivot(dateDepuisCle(vue, valeur));
              }
            }}
            disabled={chargement || periodes.length === 0}
          >
            <SelectTrigger
              size="sm"
              aria-label="Choisir une période"
              className="h-8 w-full min-w-0 max-w-[min(100%,18rem)] justify-center border-transparent bg-transparent px-2 text-[13px] font-semibold shadow-none hover:bg-muted/60 sm:min-w-[12rem] sm:text-[14px] dark:hover:bg-input/30"
            >
              <span className="truncate">{libellePeriode}</span>
            </SelectTrigger>
            <SelectContent align="center" className="max-h-80 min-w-[min(20rem,calc(100vw-2rem))]">
              {groupes.map((groupe) => (
                <SelectGroup key={groupe.groupe || "periodes"}>
                  {groupe.groupe ? (
                    <SelectLabel>{groupe.groupe}</SelectLabel>
                  ) : null}
                  {groupe.periodes.map((periode) => (
                    <SelectItem key={periode.cle} value={periode.cle}>
                      {periode.libelle}
                      {periode.actuelle ? " · actuelle" : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="max-w-[10rem] truncate px-2 text-[12px] font-semibold sm:max-w-[14rem] sm:text-[13px]">
            {libellePeriode}
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          disabled={!periodeSuivante || chargement}
          onClick={() => {
            if (periodeSuivante) {
              setDatePivot(dateDepuisCle(vue, periodeSuivante.cle));
            }
          }}
          aria-label="Période suivante"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    );
  };

  const selecteurVue = (
    <ButtonGroup className="w-full sm:w-auto">
      {VUES.map((item) => {
        const Icone = item.icon;
        const actif = vue === item.id;
        return (
          <Button
            key={item.id}
            type="button"
            variant={actif ? "default" : "outline"}
            size="sm"
            className="flex-1 gap-1.5 sm:flex-none"
            aria-pressed={actif}
            onClick={() => {
              if (item.id !== vue) setVue(item.id);
            }}
          >
            <Icone className="size-3.5" />
            <span className="truncate">{item.label}</span>
          </Button>
        );
      })}
    </ButtonGroup>
  );

  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-xl text-[12.5px] leading-relaxed text-muted-foreground sm:text-[13px]">
            {TEXTES_VUE[vue]}
          </p>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:items-end">
            {selecteurVue}
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
              {navigationPeriode()}
              <BoutonPleinEcran
                actif={pleinEcran}
                onToggle={() => setPleinEcran((v) => !v)}
                libelleEnter="Afficher la fiche consolidée en plein écran"
              />
            </div>
          </div>
        </div>

        {chargement && !matrice ? (
          <div className="flex min-h-[200px] items-center justify-center text-muted-foreground sm:min-h-[240px]">
            <Loader2 className="size-8 animate-spin" aria-label="Chargement" />
          </div>
        ) : pleinEcran ? (
          <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-dashed px-3 text-center text-[13px] text-muted-foreground sm:min-h-[120px]">
            Tableau affiché en plein écran
          </div>
        ) : (
          <TableauFicheExecutionConso
            matrice={matrice}
            chargement={chargement}
            maxHeightClassName="max-h-[calc(100dvh-14rem)] sm:max-h-[calc(100vh-16rem)]"
          />
        )}
      </div>

      <OverlayPleinEcran
        ouvert={pleinEcran}
        titre="Fiche d'exécution consolidée"
        sousTitre={`${LIBELLE_VUE[vue]} · ${libellePeriode}`}
        onClose={() => setPleinEcran(false)}
        ariaLabel="Fiche d'exécution consolidée en plein écran"
        actions={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            {selecteurVue}
            {navigationPeriode({ avecSelect: false })}
          </div>
        }
      >
        <TableauFicheExecutionConso
          matrice={matrice}
          chargement={chargement}
          maxHeightClassName="max-h-full"
        />
      </OverlayPleinEcran>
    </TooltipProvider>
  );
}
