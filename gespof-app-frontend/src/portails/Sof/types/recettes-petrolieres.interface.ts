/** Ligne agrégée OP BEAC (STAT.VM_REC_BEAC). */
export interface LigneRecettePetroliereAgregee {
  code: string | null;
  type_recette: string | null;
  montant: string;
}

/** Ligne détaillée états par compte (OP_BEAC + E-TAX). */
export interface LigneRecettePetroliereEtatParCompte {
  d_oper: string | null;
  orig: string | null;
  c_typ: string | null;
  c_ref: string | null;
  l_tiers: string | null;
  l_obj: string | null;
  l_com: string | null;
  l_exp: string | null;
  l_dest: string | null;
  montant: string;
  c_pc: string | null;
  n_regl: string | null;
  d_cpta: string | null;
  n_mattir: string | null;
  compte: string | null;
  libelle_compte: string | null;
  ref_etax: string | null;
  motif_etax: string | null;
}

/** Ligne détaillée compte 1812-201. */
export interface LigneRecettePetroliereDetail {
  code: string | null;
  type_recette: string | null;
  montant: string;
  c_pca: string | null;
  n_op: string | null;
  d_cpta: string | null;
  n_lig_op: string | null;
  c_typ_det: string | null;
  c_it: string | null;
  c_ope: string | null;
  c_ref1: string | null;
  c_ref2: string | null;
  libelle_nature: string | null;
}

export interface LigneDetailEtax {
  nature: string | null;
  libelle_nature: string | null;
  montant: string;
}

export interface ExtractionDetailEtax {
  ref_etax: string;
  lignes: LigneDetailEtax[];
  nombre: number;
  total: string;
  message: string | null;
}

export interface ExtractionRecettesPetrolieres {
  date_debut: string;
  date_fin: string;
  etape: string;
  etape_libelle: string;
  compte: string | null;
  lignes: LigneRecettePetroliereAgregee[];
  nombre: number;
  total: string;
  message: string | null;
}

export interface ExtractionRecettesPetrolieresEtatParCompte {
  date_debut: string;
  date_fin: string;
  etape: string;
  etape_libelle: string;
  compte: string | null;
  lignes: LigneRecettePetroliereEtatParCompte[];
  /** Détails E-TAX préchargés (clé = ref_etax) — clic dialogue sans nouvel appel Oracle. */
  details_etax?: Record<string, ExtractionDetailEtax>;
  nombre: number;
  total: string;
  message: string | null;
}

export interface ExtractionRecettesPetrolieresDetail {
  date_debut: string;
  date_fin: string;
  etape: string;
  etape_libelle: string;
  compte: string | null;
  lignes: LigneRecettePetroliereDetail[];
  nombre: number;
  total: string;
  message: string | null;
}
