import { createContext, useContext } from "react";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

export interface JourneeSelectionneeValue {
  /** Référence choisie dans la TopBar ; null = suivre la journée du jour. */
  reference: string | null;
  /** Journée affichée (celle choisie, ou celle du jour si elle existe). */
  journee: JourneeTresorerie | null;
  chargement: boolean;
  /** Date calendaire de la journée affichée (aujourd'hui si aucune sélection). */
  date: Date;
  dateIso: string;
  /** Vrai si la journée affichée correspond au jour calendaire. */
  estDuJour: boolean;
  /** Choisit une journée par référence (null = revenir à la journée du jour). */
  selectionner: (reference: string | null) => void;
  /** Remplace la journée affichée sans rechargement (création, mise à jour…). */
  appliquerJournee: (journee: JourneeTresorerie) => void;
  rafraichir: () => void;
}

export const JourneeSelectionneeContext = createContext<JourneeSelectionneeValue | null>(null);

export function useJourneeSelectionnee(): JourneeSelectionneeValue {
  const ctx = useContext(JourneeSelectionneeContext);
  if (!ctx) {
    throw new Error("useJourneeSelectionnee must be used within JourneeSelectionneeProvider");
  }
  return ctx;
}
