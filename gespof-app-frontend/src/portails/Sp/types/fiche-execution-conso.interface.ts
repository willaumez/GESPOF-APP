export type VueConso = "semaine" | "mois" | "annee";

export type TypeColonneConso = "jour" | "periode" | "total";

export interface ColonneConsoPeriode {
  type: "jour" | "periode";
  cle: string;
  date?: string;
  libelle: string;
  sous_libelle?: string | null;
  jour_semaine?: number;
  dates: string[];
}

export interface ColonneConsoTotal {
  type: "total";
  cle: string;
  libelle: string;
  dates: string[];
}

export type ColonneConso = ColonneConsoPeriode | ColonneConsoTotal;

export interface LigneConso {
  id: number;
  nom: string;
  type: "solde" | "recette" | "depense";
  niveau: number;
  est_feuille: boolean;
  est_racine: boolean;
  valeurs: Record<string, string>;
  totaux_semaine: Record<string, string>;
}

export interface SemaineConso {
  lundi: string;
  vendredi: string;
  libelle: string;
  actuelle: boolean;
}

export interface PeriodeConso {
  cle: string;
  libelle: string;
  actuelle: boolean;
}

export interface MatriceFicheExecutionConso {
  vue: VueConso;
  date: string;
  libelle: string;
  colonnes: ColonneConso[];
  lignes: LigneConso[];
  periodes: PeriodeConso[];
  lundi?: string;
  vendredi?: string;
  libelle_semaine?: string;
  semaines?: SemaineConso[];
}
