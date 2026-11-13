import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DateRange } from "react-day-picker";
import { isoLocal } from "@/shared/components/date/PeriodDatePicker";
import type { PeriodeSof } from "@/portails/Sof/types/referentiel.interface";

function debutMois(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export { isoLocal };

function periodeParDefaut(): DateRange {
  return { from: debutMois(new Date()), to: new Date() };
}

interface PeriodeContextValue {
  periode: DateRange | undefined;
  setPeriode: (range: DateRange | undefined) => void;
  /** Période SROT sélectionnée (API sof_periode). */
  periodeSof: PeriodeSof | null;
  setPeriodeSof: (p: PeriodeSof | null) => void;
  dateDebutIso: string | null;
  dateFinIso: string | null;
}

const PeriodeContext = createContext<PeriodeContextValue | null>(null);

/** Période unique du portail SOF — partagée par toutes les pages. */
export function PeriodeProvider({ children }: { children: ReactNode }) {
  const [periode, setPeriode] = useState<DateRange | undefined>(periodeParDefaut);
  const [periodeSof, setPeriodeSof] = useState<PeriodeSof | null>(null);
  const dateDebutIso = periode?.from ? isoLocal(periode.from) : null;
  const dateFinIso = periode?.to ? isoLocal(periode.to) : null;
  const value = useMemo(
    () => ({
      periode,
      setPeriode,
      periodeSof,
      setPeriodeSof,
      dateDebutIso,
      dateFinIso,
    }),
    [periode, periodeSof, dateDebutIso, dateFinIso],
  );

  return (
    <PeriodeContext.Provider value={value}>{children}</PeriodeContext.Provider>
  );
}

export function usePeriode(): PeriodeContextValue {
  const ctx = useContext(PeriodeContext);
  if (!ctx) {
    throw new Error("usePeriode must be used within PeriodeProvider");
  }
  return ctx;
}
