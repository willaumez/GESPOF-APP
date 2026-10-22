import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { getPortalMenu } from "@/shared/config/menu";
import type { Portail } from "@/shared/hooks/auth-context";
import { cn } from "@/shared/lib/utils";

export function isoLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const j = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${j}`;
}

export function periodeVersIso(periode: DateRange | undefined): {
  dateDebut: string;
  dateFin: string;
} {
  return {
    dateDebut: periode?.from ? isoLocal(periode.from) : "",
    dateFin: periode?.to ? isoLocal(periode.to) : "",
  };
}

function formaterJour(date: Date): string {
  return format(date, "dd/MM/yyyy", { locale: fr });
}

function periodeComplete(range: DateRange | undefined): boolean {
  return Boolean(range?.from && range.to);
}

function normaliserPlage(range: DateRange): DateRange {
  if (!range.from) return range;
  const to = range.to ?? range.from;
  if (range.from > to) {
    return { from: to, to: range.from };
  }
  return { from: range.from, to };
}

function libellePlage(range: DateRange | undefined, vide: string): string {
  if (!range?.from) return vide;
  if (!range.to) return formaterJour(range.from);
  return `${formaterJour(range.from)} → ${formaterJour(range.to)}`;
}

interface PeriodDatePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  disabled?: boolean;
  /** Portail pour le thème (bordure / icône). Défaut : admin. */
  portail?: Portail;
  /** Libellé court à gauche des dates (ex. « Exercice », « Période »). */
  libelle?: string;
  /**
   * - `topbar` : barre d'en-tête (ex. SOF)
   * - `filtre` : barre de filtres de liste
   * - `default` : formulaire générique
   */
  variant?: "default" | "topbar" | "filtre";
  className?: string;
  /** Ferme le popover dès qu'une plage complète (from + to) est choisie. */
  fermerQuandComplet?: boolean;
}

/**
 * Sélecteur de période (plage de dates) — partagé par tous les portails.
 *
 * La plage n'est propagée au parent (`onChange`) qu'une fois début et fin
 * choisis (2 clics), afin de ne pas relancer une recherche à mi-sélection.
 */
export function PeriodDatePicker({
  value,
  onChange,
  disabled,
  portail = "admin",
  libelle = "Période",
  variant = "default",
  className,
  fermerQuandComplet = true,
}: PeriodDatePickerProps) {
  const [ouvert, setOuvert] = useState(false);
  const [brouillon, setBrouillon] = useState<DateRange | undefined>(value);
  /** idle = en attente du 1er clic ; debut = début choisi, en attente de la fin. */
  const etapeRef = useRef<"idle" | "debut">("idle");
  const theme = getPortalMenu(portail).theme;
  const topbar = variant === "topbar";
  const filtre = variant === "filtre";

  const affiche = ouvert ? brouillon : value;
  const afficherLibelleDates =
    (topbar || filtre) && periodeComplete(affiche);

  useEffect(() => {
    if (!ouvert) setBrouillon(value);
  }, [value, ouvert]);

  function ouvrirChange(open: boolean) {
    setOuvert(open);
    if (open) {
      setBrouillon(value);
      etapeRef.current = "idle";
      return;
    }
    // Fermeture sans plage complète : on annule le brouillon.
    setBrouillon(value);
    etapeRef.current = "idle";
  }

  function gererSelect(range: DateRange | undefined) {
    if (!range?.from) {
      etapeRef.current = "idle";
      setBrouillon(undefined);
      onChange(undefined);
      return;
    }

    // 1er clic : on mémorise le début sans valider la recherche.
    if (etapeRef.current === "idle") {
      etapeRef.current = "debut";
      setBrouillon({ from: range.from, to: undefined });
      return;
    }

    // 2e clic : plage complète → validation.
    etapeRef.current = "idle";
    const complet = normaliserPlage({
      from: range.from,
      to: range.to ?? range.from,
    });
    setBrouillon(complet);
    onChange(complet);
    if (fermerQuandComplet) setOuvert(false);
  }

  const texteFallback = libellePlage(affiche, "Sélectionner une période");

  return (
    <Popover open={ouvert} onOpenChange={ouvrirChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start gap-2 font-normal",
            !affiche?.from && "text-muted-foreground",
            topbar &&
              "h-10 gap-2.5 rounded-xl border-2 bg-card px-2 pr-3 shadow-sm hover:bg-card hover:shadow-md aria-expanded:bg-card aria-expanded:shadow-md",
            filtre &&
              "h-9 gap-2 rounded-lg border-2 bg-white px-2 pr-3 shadow-none hover:bg-white",
            variant === "default" && "h-9 min-w-[240px]",
            className,
          )}
          style={
            topbar || filtre
              ? {
                  borderColor: ouvert ? theme.topColor : `${theme.topColor}33`,
                  boxShadow: ouvert
                    ? `0 0 0 3px ${theme.topColor}22`
                    : undefined,
                }
              : undefined
          }
          aria-label="Sélectionner une période"
        >
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg",
              topbar || filtre ? "size-7" : "size-4 bg-transparent",
            )}
            style={
              topbar || filtre
                ? { background: theme.iconBg, color: theme.iconColor }
                : undefined
            }
          >
            <CalendarDays
              className={cn(
                topbar || filtre
                  ? "size-3.5"
                  : "size-4 text-muted-foreground",
              )}
            />
          </span>
          {afficherLibelleDates ? (
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/45 sm:inline">
                {libelle}
              </span>
              <span className="font-semibold tabular-nums text-[#0f172a]">
                {formaterJour(affiche!.from!)}
              </span>
              <span className="text-[11px] font-medium text-foreground/35">
                →
              </span>
              <span className="font-semibold tabular-nums text-[#0f172a]">
                {formaterJour(affiche!.to!)}
              </span>
            </span>
          ) : (
            <span className="truncate">{texteFallback}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={topbar || filtre ? "end" : "start"}
        sideOffset={topbar ? 8 : 4}
        className="w-auto p-0"
      >
        <Calendar
          mode="range"
          locale={fr}
          selected={brouillon}
          onSelect={gererSelect}
          numberOfMonths={filtre || topbar ? 2 : 1}
          defaultMonth={brouillon?.from ?? value?.from}
          captionLayout="dropdown"
        />
      </PopoverContent>
    </Popover>
  );
}
