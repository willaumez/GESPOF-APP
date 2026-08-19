/**
 * Maquettes de Fiche Bleue — miroir cote client de
 * gespof-app-backend/src/Module/ServicePrevision (FicheBleueModeleService).
 *
 * Une maquette decrit la structure d'une Fiche Bleue : une liste ordonnee de
 * sections principales, chacune pouvant contenir des sous-sections. Les
 * sections proviennent d'un catalogue partage (SectionModele) : une section
 * portant un `id` designe une entree existante de ce catalogue, une section
 * sans `id` en cree une nouvelle.
 */

export type TypeSection = "principale" | "sous_section";

export interface SectionMaquette {
  id: number | null;
  code: string | null;
  nom: string;
  type_section: TypeSection;
  ordre: number;
  est_calculee: boolean;
  formule: string | null;
  sous_sections: SectionMaquette[];
}

/** Ligne de la liste des maquettes (GET /maquettes). */
export interface MaquetteResume {
  id: number;
  nom: string;
  description: string | null;
  actif: boolean;
  est_par_defaut: boolean;
  /** Date de creation, mise a jour a chaque modification (ISO 8601). */
  mis_a_jour_le: string;
  nb_sections: number;
  /** Fiches Bleues deja generees depuis cette maquette : > 0 interdit la suppression. */
  nb_fiches: number;
}

/** Maquette complete avec sa structure (GET /maquettes/{id}). */
export interface MaquetteDetail {
  id: number;
  nom: string;
  description: string | null;
  actif: boolean;
  est_par_defaut: boolean;
  /** Date de creation, mise a jour a chaque modification (ISO 8601). */
  mis_a_jour_le: string;
  nb_fiches: number;
  sections: SectionMaquette[];
}

export interface SectionPayload {
  /** Absent = nouvelle section de catalogue ; present = section existante mise a jour. */
  id?: number;
  code: string | null;
  nom: string;
  type_section: TypeSection;
  ordre: number;
  est_calculee: boolean;
  formule: string | null;
  sous_sections: SectionPayload[];
}

export interface MaquettePayload {
  nom: string;
  description: string | null;
  actif: boolean;
  est_par_defaut: boolean;
  sections: SectionPayload[];
}
