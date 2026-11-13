export type SectionRecette =
  | "petrole"
  | "recettes_fiscales"
  | "recettes_non_fiscales"
  | "recettes_affectees"
  | "emprunt"
  | "non_budgetaire";

export type NatureDepense =
  | "ex_anterieur"
  | "exercice_courant"
  | "sans_ordonnancement";

export interface RubriqueRecetteNoeud {
  code: string;
  libelle: string;
  niveau: number;
  niveau_libelle: string;
  ordre: number;
  code_tofe: string | null;
  actif: boolean;
  section: SectionRecette;
  section_libelle: string;
  code_synthetique: boolean;
  est_racine: boolean;
  parent_code: string | null;
  parent_libelle?: string | null;
  enfants: RubriqueRecetteNoeud[];
}

export interface RubriqueDepenseNoeud {
  code: string;
  libelle: string;
  niveau: number;
  niveau_libelle: string;
  ordre: number;
  code_tofe: string | null;
  actif: boolean;
  nature: NatureDepense;
  nature_libelle: string;
  code_synthetique: boolean;
  est_racine: boolean;
  parent_code: string | null;
  parent_libelle?: string | null;
  enfants: RubriqueDepenseNoeud[];
}

export interface RubriqueSofSaisie {
  libelle: string;
  ordre: number;
  code_tofe: string | null;
  actif: boolean;
}

export interface RubriqueSofCreation {
  code: string;
  libelle: string;
  parent_code?: string | null;
  section?: SectionRecette;
  nature?: NatureDepense;
  code_tofe?: string | null;
  actif?: boolean;
  ordre?: number;
}

/** Code TOFE (table code_tofe — plan phase 0). */
export interface CodeTofeSof {
  code: string;
  libelle: string;
}

export type DomaineFlechage =
  | "corresp_recette"
  | "corresp_depense"
  | "avance"
  | "reglement"
  | "credit_delegue";

export type OngletFlechage = "corr" | "av" | "ord" | "cd";

/** Règle de fléchage (table regle_flechage). */
export interface RegleFlechageSof {
  id: number;
  domaine: DomaineFlechage;
  domaine_libelle: string;
  onglet: OngletFlechage;
  categorie: string | null;
  compte: string | null;
  nature: string | null;
  type_exercice: string | null;
  titre: string | null;
  mdr: string | null;
  rubrique_code: string;
  titre_resultat: string | null;
  priorite: number;
  valide_du: string | null;
  valide_au: string | null;
  sens: "Recette" | "Dépense" | null;
}

export interface RegleFlechageSaisie {
  domaine: DomaineFlechage;
  categorie?: string | null;
  compte?: string | null;
  nature?: string | null;
  type_exercice?: string | null;
  titre?: string | null;
  mdr?: string | null;
  rubrique_code: string;
  titre_resultat?: string | null;
  priorite: number;
  valide_du?: string | null;
  valide_au?: string | null;
}

export interface TestFlechageResultat {
  trouve: boolean;
  code: string | null;
  motif?: string | null;
  titre?: number | null;
  meta?: Record<string, unknown>;
  priorite?: number;
  rang?: number;
  regle_id?: number;
  domaine?: string;
  compat_excel?: boolean;
  message: string;
}

export type FamilleCompteSuivi = "DOUANE" | "PETROLE";

/** Compte de suivi douanes / pétrole (table compte_suivi). */
export interface CompteSuiviSof {
  compte: string;
  nature: string;
  libelle: string;
  famille: FamilleCompteSuivi;
  famille_libelle: string;
  type: string;
  bancaire_seulement: boolean;
  ordre: number;
}

export interface CompteSuiviSaisie {
  compte: string;
  nature: string;
  libelle: string;
  famille: FamilleCompteSuivi;
  type: string;
  bancaire_seulement: boolean;
  ordre: number;
}

/** Société pétrolière (table societe_petroliere). */
export interface SocietePetroliereSof {
  matricule: string;
  nom: string;
  champ_nif: string | null;
  redevance_sup_min: string | null;
  petrole: boolean;
  perimetre: "Pétrole" | "Hors pétrole";
}

export interface SocietePetroliereSaisie {
  matricule: string;
  nom: string;
  champ_nif?: string | null;
  redevance_sup_min?: string | null;
  petrole: boolean;
}

export type CategoriePosteComptable = "TPG" | "AGC" | "ENT";

/** Poste comptable (table poste_comptable). */
export interface PosteComptableSof {
  code: string;
  libelle: string;
  categorie_defaut?: CategoriePosteComptable;
  categorie_defaut_libelle?: string;
  /** Compat. */
  categorie: CategoriePosteComptable;
  categorie_libelle: string;
  /** Depuis dernier lot XRAV — lecture seule. */
  categories_observees?: string | null;
}

export interface PosteComptableSaisie {
  code: string;
  libelle: string;
  categorie: CategoriePosteComptable;
  categorie_defaut?: CategoriePosteComptable;
}

export type StatutPeriodeSof = "ouverte" | "en_controle" | "validee" | "publiee";

/** Mois de production SROT (table periode). */
export interface PeriodeSof {
  id: number;
  exercice_annee: number;
  mois: number;
  mois_libelle: string | null;
  date_situation: string | null;
  statut: StatutPeriodeSof;
  statut_libelle: string;
}

export type LoiEnVigueur = "LFI" | "LFR";
export type StatutExercice = "ouvert" | "cloture";

/** Exercice budgétaire SOF (table exercice — plan phase 0). */
export interface ExerciceSof {
  annee: number;
  balance_initiale: string;
  loi_en_vigueur: LoiEnVigueur | null;
  loi_en_vigueur_libelle: string | null;
  /** 0–99 : 2 premiers chiffres du n° d'AD (C_REF1). */
  prefixe_ad: number | string;
  delai_arriere_jours: number;
  statut: StatutExercice;
  statut_libelle: string;
  date_ouverture: string | null;
  date_cloture: string | null;
  ouvert: boolean;
  /** Portée par la période — lecture seule sur la page Exercice. */
  date_situation?: string | null;
  dernier_mois_valide?: {
    mois: number;
    libelle: string;
    statut: string;
  } | null;
  /** Compat. */
  loi_finances_en_vigueur?: string | null;
  solde_ouverture?: string;
}

export interface ExerciceSofSaisie {
  balance_initiale: string;
  loi_en_vigueur: LoiEnVigueur;
  prefixe_ad: number | string;
  delai_arriere_jours: number;
}

/** Exclusion RAP (table sof_exclusion_rap) — ORDONNANCE | MDR | NATURE. */
export type TypeExclusionRap = "ORDONNANCE" | "MDR" | "NATURE";

export interface ExclusionRapSof {
  id: number;
  type: TypeExclusionRap | string;
  code: string;
  libelle: string | null;
  motif: string | null;
  date_exclusion: string | null;
  auteur: string | null;
  portee?: string | null;
  lecture_seule?: boolean;
}

export interface RegleFixeRap {
  numero: number;
  libelle: string;
  source: string;
}

export interface CouvertureFlechage {
  lot_id: number | null;
  lot_importe_le: string | null;
  recettes: { categorie: string; trouve: boolean; code?: string | null }[];
  depenses: { categorie: string; trouve: boolean; code?: string | null }[];
  sans_regle: { sens: string; categorie: string }[];
  message?: string | null;
}

export interface ExclusionRapSaisie {
  type: TypeExclusionRap;
  code: string;
  libelle?: string | null;
  motif?: string | null;
  date_exclusion?: string | null;
  auteur?: string | null;
}
