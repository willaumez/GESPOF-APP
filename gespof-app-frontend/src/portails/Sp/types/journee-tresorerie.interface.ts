import type { OperationsJour, RecetteBeac } from "@/portails/Sp/types/operations-jour.interface";

export type EtatJournee = "brouillon" | "en_cours" | "cloture";

export interface JourneeTresorerie {
  reference: string;
  date_creation: string;
  date_derniere_mise_a_jour: string | null;
  etat: EtatJournee;
  etat_libelle: string;
  /** Clôturée puis réouverte (et pas re-clôturée depuis). */
  reouverte?: boolean;
  solde_ouverture: string;
  total_recettes: string;
  total_depenses: string;
  solde_cloture: string;
  fiche_bleue_id: number | null;
  fiche_bleue_reference: string | null;
  fiche_execution_id: number | null;
  fiche_execution_reference?: string | null;
  nombre_fiches_depot?: number;
  /** Snapshot date d'ouverture + recettes/dépenses, null si jamais enregistré. */
  operations_jour?: OperationsJour | null;
}

/** Rapprochement enregistré côté serveur (éléments déposés ensemble = même groupe). */
export interface RapprochementElement {
  section_id: number;
  section_nom: string;
  groupe: string;
  le: string;
  par: string | null;
}

export type TypeRapprochement = "recette" | "depense";

/** Recette validée : `cle` stable (identifie la recette d'une validation à l'autre). */
export type RecetteValidee = RecetteBeac & {
  cle: string;
  rapprochement: RapprochementElement | null;
};

/** Liste des recettes Oracle validée (figée) pour une journée. */
export interface RecettesJourValidees {
  date_ouverture: string;
  validee_le: string;
  validee_par: string | null;
  total: string;
  nombre: number;
  recettes: RecetteValidee[];
}

export type FamilleDepense = "numeraire" | "sygma" | "systac";

/** Dépense validée : union dédoublonnée des fiches de dépôt de la journée. */
export interface DepenseValidee {
  cle: string;
  famille: FamilleDepense;
  beneficiaire: string;
  numero_ov: string | null;
  banque: string | null;
  date_virement: string | null;
  montant: string;
  /** Première fiche de dépôt qui contenait cette dépense. */
  fiche_reference: string;
  integree_le: string;
  /** Ajoutée par la dernière validation (fiche complémentaire). */
  nouvelle: boolean;
  rapprochement: RapprochementElement | null;
}

export interface DepensesJourValidees {
  validee_le: string;
  validee_par: string | null;
  /** Fiches de dépôt intégrées, de la plus ancienne à la plus récente. */
  fiches: string[];
  total: string;
  nombre: number;
  depenses: DepenseValidee[];
}

export interface FicheDepotDisponible {
  reference: string;
  date_creation: string;
  montant_total: string;
  /** Lignes de la fiche (numéraire + SYGMA + SYSTAC). */
  nombre_elements: number;
  /** Lignes absentes des fiches précédentes de la journée. */
  nouveaux_elements: number;
}

export interface EtatDepensesJour {
  depenses_jour: DepensesJourValidees | null;
  fiches_disponibles: FicheDepotDisponible[];
  /** Fiches reçues après la dernière validation. */
  fiches_non_integrees: string[];
  /** Dépenses de ces fiches absentes de la liste validée. */
  nouvelles: number;
}

export interface ListerJourneesParams {
  page?: number;
  limite?: number | "all";
  q?: string;
  etat?: EtatJournee;
  date?: string;
  date_debut?: string;
  date_fin?: string;
}

export interface PageJourneesTresorerie {
  journees: JourneeTresorerie[];
  total: number;
  page: number;
  pages: number;
  limite: number;
  date?: string;
}
