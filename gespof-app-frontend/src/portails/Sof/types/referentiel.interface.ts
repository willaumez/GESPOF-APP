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
  section: SectionRecette;
  section_libelle: string;
  code_synthetique: boolean;
  est_racine: boolean;
  enfants: RubriqueRecetteNoeud[];
}

export interface RubriqueDepenseNoeud {
  code: string;
  libelle: string;
  niveau: number;
  nature: NatureDepense;
  nature_libelle: string;
  code_synthetique: boolean;
  est_racine: boolean;
  enfants: RubriqueDepenseNoeud[];
}

export interface ExerciceSof {
  annee: number;
  loi_finances_en_vigueur: string | null;
  solde_ouverture: string;
}
