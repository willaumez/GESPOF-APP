export interface CompteDouaneLigne {
  compte: string;
  libelle_compte: string;
}

export interface CompteDouanePlat extends CompteDouaneLigne {
  type: string;
  type_libelle: string;
}

export interface GroupeCompteDouane {
  type: string;
  type_libelle: string;
  comptes: CompteDouaneLigne[];
}

export interface OperationDouaniere {
  c_pca: string | null;
  n_op: string | null;
  c_guic: string | null;
  n_mattir: string | null;
  l_tiers: string | null;
  l_np: string | null;
  n_lig_op: string | null;
  c_ope: string | null;
  c_it: string | null;
  c_nat: string | null;
  c_ref1: string | null;
  c_ref2: string | null;
  m_oper: string;
  n_regl: string | null;
  n_lig_r: string | null;
  m_regl: string;
  c_nop: string | null;
  c_mdr: string | null;
  n_cheq: string | null;
  d_cpta: string | null;
  c_cais: string | null;
}

export interface LigneRusid {
  mm: string | null;
  mois: string | null;
  c_pca: string | null;
  libelle: string | null;
  c_it: string | null;
  l_compte: string | null;
  m_oper: string;
  operation: string | null;
}

export interface ExtractionCompteDouane {
  date_debut: string;
  date_fin: string;
  compte: string;
  libelle_compte: string;
  type: string;
  type_libelle: string;
  operations: OperationDouaniere[];
  rusid: LigneRusid[];
  nombre: number;
  message: string | null;
  erreur?: string | null;
}

export interface ExtractionLotDouane {
  date_debut: string;
  date_fin: string;
  nombre: number;
  echecs: number;
  comptes: ExtractionCompteDouane[];
  message: string | null;
}

export interface LigneRecetteDouaniere {
  source: "operation" | "rusid";
  compte: string;
  libelle_compte: string;
  type: string;
  type_libelle: string;
  periode: string | null;
  c_pca: string | null;
  libelle: string | null;
  n_op: string | null;
  n_regl: string | null;
  origine: string | null;
  m_oper: string;
  m_regl: string | null;
}

export interface GroupeLignesCompte {
  compte: string;
  libelle_compte: string;
  type: string;
  type_libelle: string;
  source: LigneRecetteDouaniere["source"];
  lignes: LigneRecetteDouaniere[];
  erreur?: string | null;
}

export function syntheseVide(compte: CompteDouanePlat): GroupeLignesCompte {
  return {
    compte: compte.compte,
    libelle_compte: compte.libelle_compte,
    type: compte.type,
    type_libelle: compte.type_libelle,
    source: compte.type === "RUSID" ? "rusid" : "operation",
    lignes: [],
    erreur: null,
  };
}

export function comparerComptes(a: string, b: string): number {
  return a.localeCompare(b, "fr", { numeric: true });
}

export function aplatirComptes(groupes: GroupeCompteDouane[]): CompteDouanePlat[] {
  return groupes.flatMap((groupe) =>
    groupe.comptes.map((compte) => ({
      compte: compte.compte,
      libelle_compte: compte.libelle_compte,
      type: groupe.type,
      type_libelle: groupe.type_libelle,
    })),
  );
}
