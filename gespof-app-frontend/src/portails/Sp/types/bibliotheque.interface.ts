/**
 * Bibliothèque des sections de Fiche Bleue — miroir côté client de
 * gespof-app-backend/src/Module/ServicePrevision (BibliothequeSectionService).
 *
 * La bibliothèque est un arbre de sections et sous-sections réutilisables :
 * elle sert de réservoir de libellés à la composition des Fiches Bleues.
 * Chaque entrée garde sa date d'ajout, le nom de l'agent qui l'a créée et
 * son type métier (solde | recette | depense).
 */

/** Nature métier d'une section : SOLDE (en-tête), RECETTE ou DEPENSE. */
export type TypeSectionBibliotheque = "solde" | "recette" | "depense";

export const TYPES_SECTION_BIBLIOTHEQUE: {
  valeur: TypeSectionBibliotheque;
  libelle: string;
}[] = [
  { valeur: "solde", libelle: "Solde" },
  { valeur: "recette", libelle: "Recette" },
  { valeur: "depense", libelle: "Dépense" },
];

export function libelleTypeSection(type: TypeSectionBibliotheque): string {
  return TYPES_SECTION_BIBLIOTHEQUE.find((t) => t.valeur === type)?.libelle ?? type;
}

export interface SectionBibliotheque {
  id: number;
  libelle: string;
  /** Nature métier : solde | recette | depense. */
  type: TypeSectionBibliotheque;
  /** Position parmi les sections de même niveau. */
  ordre: number;
  /** Date d'ajout à la bibliothèque (ISO 8601). */
  date_creation: string;
  /** Nom complet de l'agent SP qui a ajouté la section. */
  createur: string;
  sous_sections: SectionBibliotheque[];
}

/**
 * Réponse paginée de la liste : la pagination porte sur les sections racines
 * (chacune livrée avec toute sa descendance).
 */
export interface PageBibliotheque {
  sections: SectionBibliotheque[];
  /** Nombre total de sections racines après filtre. */
  total: number;
  page: number;
  pages: number;
  limite: number;
}

/** Sous-section à créer en même temps que sa section (récursif). */
export interface NouvelleSousSectionPayload {
  libelle: string;
  sous_sections?: NouvelleSousSectionPayload[];
}

/**
 * Création d'une section (racine) ou d'une sous-section de `parent_id`,
 * avec éventuellement ses sous-sections liées créées en une seule fois.
 * `type` est obligatoire pour une racine ; hérité du parent sinon.
 */
export interface SectionBibliothequePayload {
  libelle: string;
  type?: TypeSectionBibliotheque;
  parent_id?: number;
  sous_sections?: NouvelleSousSectionPayload[];
}

/**
 * Déplacement d'une section : `direction` la permute avec sa voisine de même
 * niveau ; `position` (1..n, glisser-déposer) la place à ce rang parmi ses
 * voisines de même niveau ; `parent_id` (id ou null pour la racine) la
 * rattache, avec toute sa descendance, à un autre parent.
 */
export interface DeplacementSectionPayload {
  direction?: "haut" | "bas";
  position?: number;
  parent_id?: number | null;
}
