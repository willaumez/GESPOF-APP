export type StatutLotImport = "ACTIF" | "REMPLACE" | "ANNULE";

export interface LotImportSof {
  id: number;
  reference: string;
  periode_id: number;
  periode_libelle: string;
  format: string;
  format_libelle: string;
  origine: string;
  source: string;
  parametres: Record<string, unknown>;
  fichier_nom: string | null;
  fichier_sha256: string | null;
  nb_lignes: number;
  montant_total: string;
  statut: StatutLotImport;
  statut_libelle: string;
  importe_par: string | null;
  importe_par_id: number | null;
  importe_le: string;
  nb_anomalies: number;
  peut_annuler: boolean;
}

export interface AnomalieImportSof {
  id: number;
  ligne: number;
  colonne: string | null;
  motif: string;
}

export interface ComparaisonLotsSof {
  lot_a: LotImportSof;
  lot_b: LotImportSof;
  delta_lignes: number;
  delta_montant: string;
  lignes: string[];
}
