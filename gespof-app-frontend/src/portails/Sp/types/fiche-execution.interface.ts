import type { TypeSectionBibliotheque } from "./bibliotheque.interface";

export interface SectionFicheExecution {
  id: number;
  nom: string;
  type: TypeSectionBibliotheque;
  ordre: number;
  montant_programme: string;
  montant_realise: string;
  montant_ecart: string;
  est_affichee: boolean;
  est_selectionnable: boolean;
  /** true : rubrique ajoutée hors Fiche Bleue (étiquette « Non programmé »). */
  non_programme: boolean;
  sous_sections: SectionFicheExecution[];
}

export interface FicheExecutionDetail {
  id: number;
  reference: string;
  date_creation: string;
  date_dernier_mise_jour: string | null;
  statut: string;
  createur: string;
  montant_total_programme: string;
  montant_total_realise: string;
  montant_total_ecart: string;
  total_solde_bancaire_entree: string;
  solde_bancaire_cloture: string;
  section_solde: string | null;
  journee_tresorerie_reference: string | null;
  sections: SectionFicheExecution[];
}
