import type { EtatJournee } from "@/portails/Sp/types/journee-tresorerie.interface";

export type TypeEvenementJournee =
  | "ouverture"
  | "cloture"
  | "reouverture"
  | "fiche_bleue_liee"
  | "fiche_bleue_modifiee"
  | "programme_saisi"
  | "fiche_execution_creee"
  | "realise_saisi"
  | "rubrique_ajoutee"
  | "rubrique_modifiee"
  | "rubrique_supprimee"
  | "rubriques_reordonnees"
  | "fiche_depot_demandee"
  | "fiche_depot_envoyee"
  | "fiche_depot_recue"
  | "recettes_validees"
  | "depenses_validees"
  | "rapprochement"
  | "rapprochement_annule";

export interface EvenementJournee {
  id: number;
  /** Type inconnu côté interface : affiché comme « Autre ». */
  type: TypeEvenementJournee | string;
  libelle: string;
  details: Record<string, unknown> | null;
  /** ISO 8601. */
  date: string;
  /** « HH:MM:SS ». */
  heure: string;
  utilisateur: {
    id: number | null;
    nom_complet: string;
    matricule: string;
    email: string | null;
    /** Métier au moment de l'action. */
    role: string | null;
  };
}

export interface HistoriqueJournee {
  journee: {
    reference: string;
    etat: EtatJournee;
    etat_libelle: string;
    date_creation: string;
    date_derniere_mise_a_jour: string | null;
  };
  /** Du plus ancien au plus récent. */
  evenements: EvenementJournee[];
}
