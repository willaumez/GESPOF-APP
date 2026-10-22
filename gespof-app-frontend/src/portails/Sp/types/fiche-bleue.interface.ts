/**
 * Fiche Bleue — miroir côté client de
 * gespof-app-backend/src/Module/ServicePrevision (FicheBleueService).
 */

import type {
  NouvelleSousSectionPayload,
  TypeSectionBibliotheque,
} from "./bibliotheque.interface";

export type StatutFicheBleue = "brouillon" | "valide" | "en_cours" | "cloture";

export interface FicheBleueResume {
  id: number;
  reference: string;
  date_creation: string;
  date_modification: string | null;
  statut: StatutFicheBleue;
  createur: string;
  montant_total_programme: string;
  montant_total_realise: string;
  montant_total_ecart: string;
  section_solde: string | null;
  nombre_sections: number;
  /** Null si la fiche n'est liée à aucune journée. */
  journee_tresorerie_reference: string | null;
}

export interface SectionFicheBleue {
  id: number;
  nom: string;
  type: TypeSectionBibliotheque;
  ordre: number;
  montant_programme: string;
  montant_realise: string;
  montant_ecart: string;
  est_affichee: boolean;
  est_selectionnable: boolean;
  sous_sections: SectionFicheBleue[];
}

export interface FicheBleueDetail extends FicheBleueResume {
  sections: SectionFicheBleue[];
}

export interface PageFichesBleues {
  fiches: FicheBleueResume[];
  total: number;
  page: number;
  pages: number;
  limite: number;
  /** Présent lorsque le filtre jour (`date`) est appliqué. */
  date?: string;
}

export interface ListerFichesBleuesParams {
  page?: number;
  limite?: number | "all";
  date?: string;
  q?: string;
  statut?: StatutFicheBleue | "";
  date_debut?: string;
  date_fin?: string;
}

/** Solde existante en bibliothèque, ou nouvelle (ajoutée à la bibliothèque). */
export type SoldeCreationPayload =
  | { bibliotheque_id: number }
  | { libelle: string; sous_sections?: NouvelleSousSectionPayload[] };

export interface CreerFicheBleuePayload {
  solde: SoldeCreationPayload;
  autres_sections: { bibliotheque_id: number }[];
}

export interface MontantProgrammePayload {
  section_id: number;
  montant_programme: string;
}

export interface MiseAJourSectionPayload {
  section_id: number;
  nom?: string;
  montant_programme?: string;
  /** Rang parmi les sœurs (1..n). */
  ordre?: number;
}

export interface InsertionSectionPayload {
  parent_id: number | null;
  position: number;
  nom: string;
  type: TypeSectionBibliotheque;
  montant_programme: string;
  enfants?: InsertionSectionPayload[];
}

export interface ProgrammationFicheBleuePayload {
  mises_a_jour: MiseAJourSectionPayload[];
  insertions: InsertionSectionPayload[];
}
