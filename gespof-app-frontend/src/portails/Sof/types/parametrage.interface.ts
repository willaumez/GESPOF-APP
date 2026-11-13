/** Types paramétrage début d'exercice (0.10–0.15). */

export type TypeLoiFinances = "LFI" | "LFR";

export type TypeGrilleSof =
  | "PLAN_DGI"
  | "PLAN_DGH"
  | "PLAN_DGDDI"
  | "PLAN_DETTE"
  | "PLAN_TITRES";

export interface LfRecetteSof {
  id?: number;
  rubrique_code: string;
  libelle: string;
  montant: string;
}

export interface LfDepenseSof {
  id?: number;
  mission: string | null;
  l_mis: string | null;
  prog: string | null;
  titre: string | null;
  l_titre: string | null;
  bop: string | null;
  l_bop: string | null;
  l_prog: string | null;
  budget: string | null;
  nat: string | null;
  montant: string;
}

export interface LfFinancementSof {
  id?: number;
  code: string;
  libelle: string;
  montant: string;
  ordre: number;
}

export interface LfTauxAffectationSof {
  id?: number;
  rubrique_code: string;
  beneficiaire: string;
  nature: string;
  /** Décimal (0.074 = 7,4 %). */
  taux: string;
}

export interface LoiFinancesSof {
  id: number | null;
  exercice_annee: number;
  type: TypeLoiFinances;
  libelle: string;
  date_loi: string | null;
  total_depenses?: string;
  recettes: LfRecetteSof[];
  depenses: LfDepenseSof[];
  financements: LfFinancementSof[];
  taux_affectations: LfTauxAffectationSof[];
}

export interface GrilleLigneSof {
  id?: number;
  code: string | null;
  libelle: string;
  ordre: number;
  rubrique_code: string | null;
  niveau: number;
  calculable: boolean;
  /** 12 montants FCFA (index 0 = janvier). */
  mois: string[];
}

export interface GrilleSof {
  id: number | null;
  exercice_annee: number;
  type: TypeGrilleSof | string;
  type_libelle: string;
  unite_saisie: string;
  lignes: GrilleLigneSof[];
}

export interface ExecutionN1LigneSof {
  rubrique_code: string;
  mois: string[];
}

export interface ExecutionN1Sof {
  exercice_courant: number;
  exercice_n1: number;
  origine: string;
  lignes: ExecutionN1LigneSof[];
}

export type StatutRapAnterieur = "ARRIERE" | "INSTANCE";

export interface RapAnterieurLotSof {
  id: number;
  exercice_annee: number;
  importe_le: string;
  nb_lignes: number;
  total_brut: string;
  total_rap: string;
  fichier: string | null;
}

export interface RapAnterieurLigneSof {
  id?: number;
  statut: StatutRapAnterieur | string;
  statut_libelle?: string;
  echeance: string | null;
  exercice: number;
  ordonnance: string;
  n_lig: string | null;
  ministere: string | null;
  titre: string | null;
  nature: string | null;
  beneficiaire: string | null;
  brut: string;
  rap: string;
  c_categ: string | null;
  poste: string | null;
}

export interface RapAnterieurSof {
  lot: RapAnterieurLotSof | null;
  lignes: RapAnterieurLigneSof[];
  lignes_ignorees_ex?: number;
}
